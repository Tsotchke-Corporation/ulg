import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  COHERENT_SOLID_STATE_MANAGER_ADMITTED,
  ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA,
  ULG_COHERENT_SOLID_DRAW_GROUP_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_SCHEMA,
  ULG_COHERENT_SOLID_GPU_DRAW_RANGE_SCHEMA,
  ULG_COHERENT_SOLID_NATIVE_EXECUTOR_SCHEMA,
  ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
  ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
  ULG_COHERENT_SOLID_STATE_MANAGER_ADMISSION_SCHEMA
} from '../ulg-gpu-abi/src/coherentSolid.js';
import { coherentSolidNativeBridgeWgsl } from '../ulg-gpu-abi/src/coherentSolidRenderWgsl.js';
import { COHERENT_SOLID_PRESENTATION_CONSUMER_LEASE_SCHEMA } from '../src/runtime/solid/coherentSolidPresentationLease.js';
import {
  coherentSolidDrawEntriesSignature,
  createCoherentSolidNativeWebGpuPipelineBundle,
  createCoherentSolidNativeWebGpuExecutor,
  resolveAdmittedCoherentSolidDrawEntries,
  validateCoherentSolidPresentationConsumerLease
} from '../src/runtime/solid/coherentSolidNativeBridge.js';

const sceneSource = readFileSync(
  new URL('../src/visualization/sphPhaseScene.js', import.meta.url),
  'utf8'
);
const productionProbeSource = readFileSync(
  new URL('../scripts/coherent-solid-production-bridge-probe.mjs', import.meta.url),
  'utf8'
);

function createFakeDevice() {
  const buffers = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  return {
    buffers,
    pipelines,
    bindGroups,
    writes,
    queue: {
      writeBuffer(buffer, offset, data) {
        writes.push({ buffer, offset, byteLength: data.byteLength });
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { this.destroyed = true; }
      };
      buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) { return descriptor; },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createRenderPipeline(descriptor) {
      pipelines.push(descriptor);
      return descriptor;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    }
  };
}

function entryFixture(device, {
  admissionId = 19,
  publicationGeneration = 7,
  generationId = 31,
  opacity = 1,
  depthWriteFlag = 1,
  bodyIndex = 0,
  geometryKey = 0x534f4c31
} = {}) {
  const frameBuffer = device.createBuffer({ label: 'frame', size: 320, usage: 128 });
  const vertexBuffer = device.createBuffer({ label: 'vertices', size: 576, usage: 128 });
  const indexBuffer = device.createBuffer({ label: 'indices', size: 144, usage: 16 });
  const restMesh = {
    schema: ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
    status: 'coherent-solid-rest-mesh-gpu-resident',
    device,
    geometryKey,
    topologyGeneration: 4,
    vertexBuffer,
    indexBuffer,
    vertexCount: 12,
    indexCount: 36,
    vertexStrideFloats: 12,
    indexFormat: 'uint32',
    persistent: true,
    cpuVertexTransformPerformed: false
  };
  const shapeCarrier = {
    schema: ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA,
    status: 'state-manager-admitted-coherent-solid-shape-carrier',
    authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED,
    stateManagerAdmissionId: admissionId,
    geometryKey,
    topologyGeneration: 4,
    carrierType: 'rest-frame-triangle-mesh'
  };
  return {
    schema: ULG_COHERENT_SOLID_DRAW_GROUP_SCHEMA,
    status: 'state-manager-admitted-solid-draw-group',
    authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED,
    stateManagerAdmissionId: admissionId,
    publicationGeneration,
    bodyId: 400,
    bodyIndex,
    componentGeneration: 3,
    generationId,
    leaseId: 22,
    leaseEpoch: 2,
    topologyGeneration: 4,
    frameSource: {
      schema: ULG_COHERENT_SOLID_FRAME_SCHEMA,
      authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED,
      stateManagerAdmissionId: admissionId,
      device,
      buffer: frameBuffer,
      bodyCount: 1,
      strideWords: 80,
      generationId,
      leaseId: 22,
      leaseEpoch: 2
    },
    restMesh,
    shapeCarrier,
    gpuDrawRange: {
      schema: ULG_COHERENT_SOLID_GPU_DRAW_RANGE_SCHEMA,
      device,
      generationId,
      leaseId: 22,
      leaseEpoch: 2,
      geometryKey,
      topologyGeneration: 4,
      instanceBodyIndexBuffer: device.createBuffer({ label: 'instances', size: 4, usage: 128 }),
      drawIndexedIndirectBuffer: device.createBuffer({ label: 'indirect', size: 20, usage: 384 }),
      indirectOffsetBytes: 0
    },
    opacity,
    depthWriteFlag,
    exposure: 1,
    renderOrder: opacity < 1 ? 200 : 100,
    presentationOwnsPhysicsCadence: false
  };
}

function collectionFixture(device, entries, {
  admissionId = 19,
  publicationGeneration = 7
} = {}) {
  return {
    schema: ULG_COHERENT_SOLID_DRAW_ENTRIES_SCHEMA,
    status: 'state-manager-admitted-solid-draw-entries',
    authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED,
    device,
    admissionId,
    publicationGeneration,
    sourceEpoch: 9,
    stateManagerAdmission: {
      schema: ULG_COHERENT_SOLID_STATE_MANAGER_ADMISSION_SCHEMA,
      accepted: true,
      committed: true,
      admissionId,
      publicationGeneration
    },
    drawGroups: entries,
    entries: []
  };
}

function createFakePass() {
  const calls = [];
  return {
    calls,
    setPipeline(pipeline) { calls.push(['pipeline', pipeline.label]); },
    setBindGroup(index, bindGroup) { calls.push(['bind-group', index, bindGroup.label]); },
    setIndexBuffer(buffer, format) { calls.push(['index-buffer', buffer.label, format]); },
    drawIndexedIndirect(...args) { calls.push(['draw-indexed-indirect', ...args]); }
  };
}

test('admitted solidDrawEntries preserve StateManager and same-device authority', () => {
  const device = createFakeDevice();
  const entry = entryFixture(device);
  const resolved = resolveAdmittedCoherentSolidDrawEntries({
    solidDrawEntries: collectionFixture(device, [entry]),
    device,
    stateManagerAdmissionValidated: true
  });
  assert.equal(resolved.ready, true);
  assert.equal(resolved.status, 'admitted-coherent-solid-draw-entries-ready');
  assert.equal(resolved.entryCount, 1);
  assert.equal(resolved.schedulerOwner, 'peercompute-node-kernel-compute-manager');
  assert.equal(resolved.residentBufferOwner, 'peercompute-gpu-hub');
  assert.equal(resolved.authoritativeMutationOwner, 'peercompute-state-manager');
  assert.equal(resolved.presentationOwnsPhysicsCadence, false);
  assert.equal(resolved.directFrameStorageBinding, true);
  assert.equal(resolved.cpuTransformRequired, false);
  assert.equal(resolved.densityFieldRequired, false);
  assert.match(coherentSolidDrawEntriesSignature(resolved), /31:22:2:4/);
  entry.generationId = 999;
  entry.frameSource.leaseEpoch = 999;
  assert.equal(resolved.drawGroups[0].generationId, 31);
  assert.equal(resolved.drawGroups[0].frameSource.leaseEpoch, 2);
  assert.equal(Object.isFrozen(resolved), true);
  assert.equal(Object.isFrozen(resolved.entries), true);
  assert.equal(Object.isFrozen(resolved.drawGroups[0].frameSource), true);
});

test('solidDrawEntries reject the whole generation on stale lease, cross-device, or CPU geometry', () => {
  const device = createFakeDevice();
  const valid = entryFixture(device);
  const stale = {
    ...valid,
    frameSource: { ...valid.frameSource, leaseEpoch: valid.leaseEpoch + 1 }
  };
  const staleResult = resolveAdmittedCoherentSolidDrawEntries({
    solidDrawEntries: collectionFixture(device, [valid, stale]),
    device,
    stateManagerAdmissionValidated: true
  });
  assert.equal(staleResult.ready, false);
  assert.equal(staleResult.entries.length, 0);
  assert.match(staleResult.reason, /lease/);

  const crossDevice = {
    ...valid,
    restMesh: { ...valid.restMesh, device: createFakeDevice() }
  };
  assert.match(resolveAdmittedCoherentSolidDrawEntries({
    solidDrawEntries: collectionFixture(device, [crossDevice]),
    device,
    stateManagerAdmissionValidated: true
  }).reason, /same-device/);

  const cpuGeometry = { ...valid, transformedVertices: new Float32Array(3) };
  assert.match(resolveAdmittedCoherentSolidDrawEntries({
    solidDrawEntries: collectionFixture(device, [cpuGeometry]),
    device,
    stateManagerAdmissionValidated: true
  }).reason, /prohibited CPU/);
});

test('native executor rejects alpha solids and composes only opaque depth-writing rest meshes', () => {
  const device = createFakeDevice();
  const opaque = entryFixture(device, { generationId: 31 });
  const rejectedAlpha = entryFixture(device, {
    generationId: 32,
    opacity: 0.45,
    depthWriteFlag: 0,
    geometryKey: 0x534f4c32
  });
  const rejectedContract = resolveAdmittedCoherentSolidDrawEntries({
    solidDrawEntries: collectionFixture(device, [opaque, rejectedAlpha]),
    device,
    stateManagerAdmissionValidated: true
  });
  assert.equal(rejectedContract.ready, false);
  assert.match(rejectedContract.reason, /invalid render parameters/);
  const secondOpaque = entryFixture(device, {
    generationId: 32,
    geometryKey: 0x534f4c32
  });
  const contract = resolveAdmittedCoherentSolidDrawEntries({
    solidDrawEntries: collectionFixture(device, [opaque, secondOpaque]),
    device,
    stateManagerAdmissionValidated: true
  });
  const cameraBuffer = device.createBuffer({ label: 'native-camera', size: 96, usage: 64 });
  const executor = createCoherentSolidNativeWebGpuExecutor({
    contract,
    device,
    format: 'rgba8unorm',
    depthFormat: 'depth24plus',
    cameraBuffer
  });
  assert.equal(executor.schema, ULG_COHERENT_SOLID_NATIVE_EXECUTOR_SCHEMA);
  assert.equal(executor.ready, true);
  assert.equal(executor.drawCommands.length, 2);
  assert.equal(executor.opaqueDrawCommands.length, 2);
  assert.equal(executor.transparentDrawCommands.length, 0);
  assert.equal(executor.surfaceAlphaMode, 'opaque');
  assert.equal(executor.surfaceBlendEnabled, false);
  assert.equal(executor.surfaceDepthWriteEnabled, true);
  assert.equal(executor.bindGroupLayout.entries[3].visibility, 3);
  assert.equal(executor.paramsBufferByteLength, 288);
  assert.equal(executor.paramStrideBytes, 256);
  assert.equal(executor.drawCommands[0].paramsBuffer, executor.drawCommands[1].paramsBuffer);
  assert.deepEqual(executor.drawCommands.map((command) => command.paramsOffsetBytes), [0, 256]);
  assert.equal(device.writes.at(-1).byteLength, 288);
  const opaquePass = createFakePass();
  const transparentPass = createFakePass();
  assert.equal(executor.executeOpaque(opaquePass).drawCommandCount, 2);
  assert.equal(executor.executeTransparent(transparentPass).drawCommandCount, 0);
  assert.ok(opaquePass.calls.some(([kind, buffer]) => kind === 'draw-indexed-indirect'
    && buffer === opaque.gpuDrawRange.drawIndexedIndirectBuffer));
  assert.equal(transparentPass.calls.length, 0);
  assert.equal(Object.hasOwn(device.queue, 'submit'), false);
  assert.equal(executor.cpuFrameTransformUploadPerformed, false);
  assert.equal(executor.densityFieldPathUsed, false);
  assert.equal(executor.gpuCompactedIndirectDraw, true);
  assert.equal(executor.perBodyCpuDrawLoopUsed, false);
  executor.destroy();
  assert.ok(executor.drawCommands.every(({ paramsBuffer }) => paramsBuffer.destroyed));
  assert.equal(opaque.restMesh.vertexBuffer.destroyed, false);
  assert.equal(opaque.frameSource.buffer.destroyed, false);
});

test('native executor revalidates its generation and admission lease before every draw', () => {
  const device = createFakeDevice();
  const entry = entryFixture(device);
  let authorityLive = true;
  const presentationLease = Object.freeze({
    schema: COHERENT_SOLID_PRESENTATION_CONSUMER_LEASE_SCHEMA,
    status: 'coherent-solid-presentation-consumer-lease-acquired',
    ready: true,
    device,
    publicationGeneration: 7,
    admissionId: 19,
    validate() {
      return authorityLive
        ? { valid: true, status: 'coherent-solid-presentation-consumer-lease-live' }
        : {
            valid: false,
            status: 'blocked-coherent-solid-presentation-consumer-lease',
            reason: 'publication-retired'
          };
    },
    release() {}
  });
  const contract = resolveAdmittedCoherentSolidDrawEntries({
    solidDrawEntries: collectionFixture(device, [entry]),
    device,
    stateManagerAdmissionValidated: true,
    presentationLease,
    presentationLeaseRequired: true
  });
  assert.equal(contract.ready, true);
  assert.equal(validateCoherentSolidPresentationConsumerLease(presentationLease, {
    device,
    publicationGeneration: 7,
    admissionId: 19
  }).valid, true);
  const executor = createCoherentSolidNativeWebGpuExecutor({
    contract,
    device,
    format: 'rgba8unorm',
    depthFormat: 'depth24plus',
    cameraBuffer: device.createBuffer({ label: 'native-camera', size: 96, usage: 64 })
  });
  assert.equal(executor.ready, true);
  const firstPass = createFakePass();
  assert.equal(executor.executeOpaque(firstPass).drawCommandCount, 1);
  assert.equal(firstPass.calls.filter(([kind]) => kind === 'draw-indexed-indirect').length, 1);

  authorityLive = false;
  const retiredPass = createFakePass();
  const retired = executor.executeOpaque(retiredPass);
  assert.equal(retired.status, 'blocked-coherent-solid-native-executor-retired-authority');
  assert.equal(retired.reason, 'publication-retired');
  assert.equal(retired.drawCommandCount, 0);
  assert.equal(retiredPass.calls.length, 0);
  executor.destroy();
  authorityLive = true;
  const destroyedPass = createFakePass();
  const destroyed = executor.executeOpaque(destroyedPass);
  assert.equal(destroyed.status, 'blocked-coherent-solid-native-executor-destroyed');
  assert.equal(destroyed.drawCommandCount, 0);
  assert.equal(destroyedPass.calls.length, 0);
});

test('native executor reuses pipelines across admitted generations', () => {
  const device = createFakeDevice();
  const cameraBuffer = device.createBuffer({ label: 'native-camera', size: 96, usage: 64 });
  const firstEntry = entryFixture(device, { publicationGeneration: 7, generationId: 31 });
  const firstContract = resolveAdmittedCoherentSolidDrawEntries({
    solidDrawEntries: collectionFixture(device, [firstEntry]),
    device,
    stateManagerAdmissionValidated: true
  });
  const pipelineBundle = createCoherentSolidNativeWebGpuPipelineBundle({
    device,
    format: 'rgba8unorm',
    depthFormat: 'depth24plus'
  });
  const first = createCoherentSolidNativeWebGpuExecutor({
    contract: firstContract,
    device,
    format: 'rgba8unorm',
    depthFormat: 'depth24plus',
    cameraBuffer,
    pipelineBundle
  });
  const secondEntry = entryFixture(device, { publicationGeneration: 8, generationId: 32 });
  const secondContract = resolveAdmittedCoherentSolidDrawEntries({
    solidDrawEntries: collectionFixture(device, [secondEntry], { publicationGeneration: 8 }),
    device,
    stateManagerAdmissionValidated: true
  });
  const second = createCoherentSolidNativeWebGpuExecutor({
    contract: secondContract,
    device,
    format: 'rgba8unorm',
    depthFormat: 'depth24plus',
    cameraBuffer,
    pipelineBundle: first.pipelineBundle
  });
  assert.equal(first.pipelineBundleReused, true);
  assert.equal(second.pipelineBundleReused, true);
  assert.equal(second.pipelineBundle, first.pipelineBundle);
  assert.equal(device.pipelines.length, 1);
  first.destroy();
  second.destroy();
});

test('native bridge shader transforms rest vertices from admitted frame storage', () => {
  assert.match(coherentSolidNativeBridgeWgsl, /resident_frames\[frame_base \+ 9u\] == params\.generation_id/);
  assert.match(coherentSolidNativeBridgeWgsl, /instance_body_indices\[instance_index\]/);
  assert.match(coherentSolidNativeBridgeWgsl, /resident_frames\[frame_base \+ 60u\] == params\.geometry_key/);
  assert.match(coherentSolidNativeBridgeWgsl, /resident_frames\[frame_base \+ 64u\] == params\.topology_generation/);
  assert.match(coherentSolidNativeBridgeWgsl, /center_of_mass \+ quaternion_rotate\(quaternion, local_position\)/);
  assert.match(coherentSolidNativeBridgeWgsl, /camera\.view_projection \* vec4<f32>\(world_position/);
  assert.match(coherentSolidNativeBridgeWgsl, /return vec4<f32>\(input\.color\.rgb \* diffuse \* params\.exposure, 1\.0\)/);
  assert.doesNotMatch(coherentSolidNativeBridgeWgsl, /params\.opacity\s*\)/);
  assert.doesNotMatch(coherentSolidNativeBridgeWgsl, /particle|density|marching|metaball/i);
  assert.doesNotMatch(coherentSolidNativeBridgeWgsl, /water|iron|sodium|cesium|fluorine/i);
});

test('production native surface profiles admitted solid draws in dedicated load passes before its single submit', () => {
  const renderStart = sceneSource.indexOf('function renderSphResidentSurfaceDrawOverlay');
  const renderEnd = sceneSource.indexOf('\n  function ', renderStart + 20);
  const renderSource = sceneSource.slice(renderStart, renderEnd);
  const refreshIndex = renderSource.indexOf('refreshCoherentSolidNativeExecutorForBridge');
  const nativeRenderSource = renderSource.slice(refreshIndex);
  const textureIndex = renderSource.indexOf('bridge.context.getCurrentTexture()', refreshIndex);
  const opaqueIndex = renderSource.indexOf('coherentSolidExecutor.executeOpaque(');
  const transparentIndex = renderSource.indexOf(
    'coherentSolidExecutor.executeTransparent('
  );
  const resolveIndex = renderSource.indexOf(
    'encodeCoherentSolidDirectShapeRenderGpuProfileResolve('
  );
  const submitIndex = renderSource.indexOf(
    'bridge.device.queue.submit([encoder.finish()])',
    transparentIndex
  );
  assert.ok(refreshIndex >= 0, 'native pass must resolve the admitted solid generation');
  assert.ok(textureIndex > refreshIndex, 'the caller must acquire its single canvas texture');
  assert.ok(opaqueIndex > textureIndex, 'opaque solid draws must use a later dedicated pass');
  assert.ok(transparentIndex > opaqueIndex, 'transparent solid draws must use a later dedicated pass');
  assert.ok(resolveIndex > transparentIndex, 'solid timestamp queries must resolve after both passes');
  assert.ok(submitIndex > resolveIndex, 'same-encoder resolve must precede the native bridge submit');
  assert.equal(
    nativeRenderSource.match(/bridge\.context\.getCurrentTexture\(\)/g)?.length,
    1,
    'the production presentation must acquire one current texture'
  );
  assert.equal(
    nativeRenderSource.match(/bridge\.device\.queue\.submit\(\[encoder\.finish\(\)\]\)/g)?.length,
    1,
    'the primary presentation encoder must have one queue submit'
  );
  assert.match(
    renderSource,
    /submittedDrawCount[\s\S]*coherentSolidOpaqueDrawCount \+ coherentSolidTransparentDrawCount/
  );
  assert.match(renderSource, /const coherentSolidOpaquePass = encoder\.beginRenderPass\(\{[\s\S]*?loadOp: 'load'[\s\S]*?depthLoadOp: 'load'/);
  assert.match(renderSource, /const coherentSolidTransparentPass = encoder\.beginRenderPass\(\{[\s\S]*?loadOp: 'load'[\s\S]*?depthLoadOp: 'load'/);
  assert.match(renderSource, /completeCoherentSolidDirectShapeRenderGpuProfile\(coherentSolidGpuProfileContext\)/);
  assert.match(renderSource, /coherentSolidExecutor\s*\n\s*}\s*\n\s*\)/);
});

test('production solid raster timestamp telemetry is stable, attributed, and single-flight', () => {
  assert.match(sceneSource, /COHERENT_SOLID_DIRECT_SHAPE_RENDER_GPU_PROFILE_LABEL\s*=\s*\n\s*'coherentSolidDirectShapeRender'/);
  assert.match(sceneSource, /let coherentSolidDirectShapeRenderGpuProfileReadbackInFlight = null/);
  assert.match(sceneSource, /if \(coherentSolidDirectShapeRenderGpuProfileReadbackInFlight\)/);
  assert.match(sceneSource, /maxSpans: 2/);
  assert.match(
    sceneSource,
    /const existingTelemetry = bridge\.coherentSolidDirectShapeRenderGpuProfileTelemetry;[\s\S]*presentationSerial: existingTelemetry\?\.presentationSerial \?\? presentationSerial/
  );
  assert.match(
    sceneSource,
    /const metadata = \{\s*passKind,\s*drawCount,\s*publicationGeneration:[\s\S]*admissionId:[\s\S]*presentationSerial:/
  );
  for (const field of [
    'Requested',
    'Supported',
    'Complete',
    'Partial',
    'Unsupported',
    'ReadbackInFlight',
    'Status',
    'Reason'
  ]) {
    assert.match(
      sceneSource,
      new RegExp(`renderBridgeCoherentSolidDirectShapeRenderGpuProfile${field}`)
    );
    assert.match(
      sceneSource,
      new RegExp(`surfaceDrawRenderBridgeCoherentSolidDirectShapeRenderGpuProfile${field}`)
    );
  }
  assert.doesNotMatch(
    sceneSource.slice(
      sceneSource.indexOf('function completeCoherentSolidDirectShapeRenderGpuProfile'),
      sceneSource.indexOf('\n  function ', sceneSource.indexOf(
        'function completeCoherentSolidDirectShapeRenderGpuProfile'
      ) + 20)
    ),
    /performance\.now|Date\.now|cpu.*tim/i
  );
  const renderStart = sceneSource.indexOf('function renderSphResidentSurfaceDrawOverlay');
  const renderEnd = sceneSource.indexOf('\n  function ', renderStart + 20);
  const renderSource = sceneSource.slice(renderStart, renderEnd);
  assert.match(
    renderSource,
    /let coherentSolidGpuProfileContext = null;\s*try \{[\s\S]*coherentSolidGpuProfileContext = beginCoherentSolidDirectShapeRenderGpuProfile/
  );
  assert.match(
    renderSource,
    /catch \(error\) \{\s*abortCoherentSolidDirectShapeRenderGpuProfile\(\s*coherentSolidGpuProfileContext/
  );
  const abortStart = sceneSource.indexOf(
    'function abortCoherentSolidDirectShapeRenderGpuProfile'
  );
  const abortEnd = sceneSource.indexOf('\n  function ', abortStart + 20);
  const abortSource = sceneSource.slice(abortStart, abortEnd);
  assert.match(abortSource, /if \(!profileContext \|\| profileContext\.submitted\) return false/);
  assert.match(
    abortSource,
    /coherentSolidDirectShapeRenderGpuProfileReadbackInFlight === profileContext/
  );
  assert.match(abortSource, /profileContext\.profiler\?\.destroy\?\.\(\)/);
  assert.match(abortSource, /identityKey: null/);
  const resolveStart = sceneSource.indexOf(
    'function encodeCoherentSolidDirectShapeRenderGpuProfileResolve'
  );
  const resolveEnd = sceneSource.indexOf('\n  function ', resolveStart + 20);
  assert.match(sceneSource.slice(resolveStart, resolveEnd), /identityKey: null/);
});

test('strict production probe requests and requires complete attributed raster timestamps', () => {
  assert.match(productionProbeSource, /if \(requireSceneBridge\) target\.searchParams\.set\('gpuProfile', '1'\)/);
  assert.match(productionProbeSource, /coherentSolidDirectShapeRenderGpuProfileReadbackInFlight/);
  assert.match(productionProbeSource, /telemetry\.status === 'timestamp-profile-complete'/);
  assert.match(productionProbeSource, /profile\.skippedSpanCount === 0/);
  assert.match(productionProbeSource, /profile\.invalidSpanCount === 0/);
  assert.match(productionProbeSource, /span\.label === 'coherentSolidDirectShapeRender'/);
  assert.match(productionProbeSource, /\['opaque', 'transparent'\]\.includes\(span\.metadata\?\.passKind\)/);
  assert.match(productionProbeSource, /id: 'production-solid-raster-gpu-profile'/);
});

test('scene exposes only admitted solid publication and retires executor resources with the bridge fence', () => {
  assert.match(sceneSource, /setAdmittedCoherentSolidDrawEntries,/);
  assert.match(sceneSource, /getAdmittedCoherentSolidDrawEntries\(\)/);
  assert.match(
    sceneSource,
    /const device = sphResidentSurfaceDrawRenderBridge\?\.device \|\| solidDrawEntries\?\.device/
  );
  const releaseStart = sceneSource.indexOf('function releaseSphResidentSurfaceDrawResources');
  const releaseEnd = sceneSource.indexOf('\n  function ', releaseStart + 20);
  const releaseSource = sceneSource.slice(releaseStart, releaseEnd);
  assert.ok(
    releaseSource.indexOf('renderBridge.coherentSolidNativeExecutor?.destroy?.()')
      < releaseSource.indexOf('renderBridge.cameraBuffer?.destroy?.()')
  );
  assert.match(
    releaseSource,
    /coherentSolidDirectShapeRenderGpuProfileReadbackInFlight\?\.bridge === renderBridge/
  );
  assert.match(
    releaseSource,
    /!coherentSolidDirectShapeRenderGpuProfileReadbackInFlight\.submitted/
  );
  const setterStart = sceneSource.indexOf('function setAdmittedCoherentSolidDrawEntries');
  const setterEnd = sceneSource.indexOf('\n  function ', setterStart + 20);
  const setterSource = sceneSource.slice(setterStart, setterEnd);
  assert.doesNotMatch(setterSource, /physicsStep|setInterval|requestAnimationFrame|queue\.submit/);
  assert.match(setterSource, /scheduleSphNativeWebGpuSurfaceConsumerFrame/);
  assert.match(setterSource, /blocked-conflicting-coherent-solid-draw-entries-publication/);
  assert.match(setterSource, /acquireCoherentSolidDrawPublicationPresentationLease/);
  assert.match(setterSource, /presentationLeaseRequired: true/);
  assert.match(setterSource, /retireCoherentSolidPresentationLease/);
  assert.match(
    setterSource,
    /previousPresentationSubmitBridge \|\| bridge,[\s\S]*previousPresentationLease/
  );

  const refreshStart = sceneSource.indexOf('function refreshCoherentSolidNativeExecutorForBridge');
  const refreshEnd = sceneSource.indexOf('\n  function ', refreshStart + 20);
  const refreshSource = sceneSource.slice(refreshStart, refreshEnd);
  assert.match(refreshSource, /validateCoherentSolidPresentationConsumerLease/);
  assert.match(refreshSource, /blocked-retired-coherent-solid-draw-publication/);
  assert.match(refreshSource, /previousExecutor\.validatePresentationAuthority\?\.\(\)\.valid === true/);

  const retireLeaseStart = sceneSource.indexOf('function retireCoherentSolidPresentationLease');
  const retireLeaseEnd = sceneSource.indexOf('\n  function ', retireLeaseStart + 20);
  assert.match(
    sceneSource.slice(retireLeaseStart, retireLeaseEnd),
    /requiresSuccessfulSubmitFence: true/
  );
  const forceDrainStart = sceneSource.indexOf(
    'function forceDrainSphNativeWebGpuSurfaceDeferredResourceReleases'
  );
  const forceDrainEnd = sceneSource.indexOf('\n  function ', forceDrainStart + 20);
  assert.match(
    sceneSource.slice(forceDrainStart, forceDrainEnd),
    /nativeSurfaceConsumerSubmitFencePending[\s\S]*fenceQuarantined\.push\(request\)/
  );

  const renderStart = sceneSource.indexOf('function renderSphResidentSurfaceDrawOverlay');
  const renderEnd = sceneSource.indexOf('\n  function ', renderStart + 20);
  const renderSource = sceneSource.slice(renderStart, renderEnd);
  const validationSubmitIndex = renderSource.indexOf(
    'bridge.device.queue.submit([validationEncoder.finish()])'
  );
  const validationFenceIndex = renderSource.indexOf(
    "reason: 'resident-surface-draw-validation-submit'"
  );
  assert.ok(validationSubmitIndex >= 0);
  assert.ok(validationFenceIndex > validationSubmitIndex);
  assert.match(
    renderSource,
    /admittedCoherentSolidPresentationLeaseLastSubmitBridge = bridge/
  );

  const extensionOwnerPreGuard = sceneSource.indexOf(
    "stage: 'extension-surface-resource-owner-commit'"
  );
  const extensionOwnerInstall = sceneSource.indexOf(
    'installSphNativeWebGpuSurfaceResourceOwner(renderBridge, {',
    extensionOwnerPreGuard
  );
  const extensionStateCommit = sceneSource.indexOf(
    'sphResidentSurfaceDraw = residentDraw;',
    extensionOwnerInstall
  );
  assert.ok(extensionOwnerPreGuard >= 0);
  assert.ok(extensionOwnerInstall > extensionOwnerPreGuard);
  assert.ok(extensionStateCommit > extensionOwnerInstall);
  assert.doesNotMatch(
    sceneSource.slice(extensionOwnerInstall, extensionStateCommit),
    /assertSphResidentRenderCommitCurrent/
  );
  assert.match(sceneSource, /pipelineBundle: bridge\.coherentSolidNativePipelineBundle/);
});
