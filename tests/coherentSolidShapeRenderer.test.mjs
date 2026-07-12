import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COHERENT_SOLID_CONTACT_PROXY_WORDS,
  COHERENT_SOLID_REST_VERTEX_FLOATS,
  COHERENT_SOLID_STATE_MANAGER_ADMITTED,
  ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_MUTATION_CANDIDATE_SCHEMA,
  ULG_COHERENT_SOLID_FRAME_SCHEMA,
  ULG_COHERENT_SOLID_RENDER_EXECUTION_SCHEMA,
  ULG_COHERENT_SOLID_REST_MESH_SCHEMA,
  ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA
} from '../ulg-gpu-abi/src/coherentSolid.js';
import {
  coherentSolidGridBackdropWgsl,
  coherentSolidShapeRenderWgsl
} from '../ulg-gpu-abi/src/coherentSolidRenderWgsl.js';
import {
  COHERENT_SOLID_SHAPE_GPU_TIMESTAMP_STAGE,
  createCoherentSolidRenderParamsArray,
  createCoherentSolidRestMeshGpu,
  createCoherentSolidShapeRenderer
} from '../src/runtime/solid/coherentSolidShapeRenderer.js';
import {
  createAsymmetricCoherentSolidFixture,
  createAsymmetricContactProxyRows
} from '../src/runtime/solid/coherentSolidValidationFixture.js';

function createFakeDevice() {
  const buffers = [];
  const textures = [];
  const pipelines = [];
  const bindGroups = [];
  const writes = [];
  return {
    buffers,
    textures,
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
    createTexture(descriptor) {
      const texture = {
        ...descriptor,
        destroyed: false,
        createView() { return { texture }; },
        destroy() { this.destroyed = true; }
      };
      textures.push(texture);
      return texture;
    },
    createShaderModule(descriptor) {
      return descriptor;
    },
    createRenderPipeline(descriptor) {
      const pipeline = {
        ...descriptor,
        getBindGroupLayout(index) { return { pipeline: descriptor.label, index }; }
      };
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    }
  };
}

function createFakeEncoder() {
  const events = [];
  return {
    events,
    beginRenderPass(descriptor) {
      const event = { descriptor, calls: [] };
      events.push(event);
      return {
        setPipeline(pipeline) { event.calls.push(['pipeline', pipeline.label]); },
        setBindGroup(index, bindGroup) { event.calls.push(['bind-group', index, bindGroup.label]); },
        setIndexBuffer(buffer, format) { event.calls.push(['index-buffer', buffer.label, format]); },
        draw(count) { event.calls.push(['draw', count]); },
        drawIndexed(count, instances, firstIndex, baseVertex, firstInstance) {
          event.calls.push(['draw-indexed', count, instances, firstIndex, baseVertex, firstInstance]);
        },
        end() { event.calls.push(['end']); }
      };
    }
  };
}

test('asymmetric SOL-1 fixture keeps rest topology, mass members, and contact quadrature separate', () => {
  const fixture = createAsymmetricCoherentSolidFixture({ densityKgM3: 2.5 });
  assert.equal(fixture.restMesh.schema, ULG_COHERENT_SOLID_REST_MESH_SCHEMA);
  assert.equal(fixture.shapeCarrier.schema, ULG_COHERENT_SOLID_SHAPE_CARRIER_SCHEMA);
  assert.equal(fixture.restMesh.vertexStrideFloats, COHERENT_SOLID_REST_VERTEX_FLOATS);
  assert.ok(fixture.restMesh.vertexCount > 24);
  assert.ok(fixture.restMesh.indexCount > 36);
  assert.equal(fixture.materialMembers.length, 3);
  assert.equal(fixture.contactSampleCount, 16);
  assert.ok(Math.abs(fixture.exposedBoundaryAreaM2 - 123) < 1e-12);
  assert.equal(fixture.asymmetryEvidence.reflectionSymmetryBroken, true);
  const firstMoment = [0, 0, 0];
  for (const member of fixture.materialMembers) {
    for (let axis = 0; axis < 3; axis += 1) {
      firstMoment[axis] += member.massKg * member.localPositionM[axis];
    }
  }
  assert.ok(Math.hypot(...firstMoment) < 1e-12);
  assert.equal(fixture.shapeCarrier.visibleTopologySource, 'rest-mesh-not-particles-or-density-field');

  const proxies = createAsymmetricContactProxyRows(fixture, {
    bodyId: 17,
    componentGeneration: 3,
    generationId: 11
  });
  assert.equal(proxies.schema, ULG_COHERENT_SOLID_CONTACT_PROXY_SCHEMA);
  assert.equal(proxies.proxyCount, 16);
  assert.equal(proxies.rows.length, 16 * COHERENT_SOLID_CONTACT_PROXY_WORDS);
  assert.match(proxies.ownership, /independent-of-render-mesh-lod/);
});

test('rest mesh GPU upload is persistent and never creates transformed CPU vertices', () => {
  const device = createFakeDevice();
  const fixture = createAsymmetricCoherentSolidFixture();
  const mesh = createCoherentSolidRestMeshGpu(device, fixture.restMesh, {
    label: 'test-solid-rest-mesh'
  });
  assert.equal(mesh.schema, ULG_COHERENT_SOLID_REST_MESH_SCHEMA);
  assert.equal(mesh.persistent, true);
  assert.equal(mesh.cpuVertexTransformPerformed, false);
  assert.equal(mesh.uploadPolicy, 'rest-geometry-upload-once');
  assert.equal(device.writes.length, 2);
  assert.equal(mesh.allocationEntries().length, 2);
  mesh.destroy();
  assert.equal(mesh.vertexBuffer.destroyed, true);
  assert.equal(mesh.indexBuffer.destroyed, true);
});

test('shape renderer binds a resident frame and rest mesh directly on a caller encoder', () => {
  const device = createFakeDevice();
  const encoder = createFakeEncoder();
  const fixture = createAsymmetricCoherentSolidFixture();
  const mesh = createCoherentSolidRestMeshGpu(device, fixture.restMesh);
  const renderer = createCoherentSolidShapeRenderer(device, {
    format: 'bgra8unorm',
    width: 960,
    height: 540,
    label: 'test-solid-renderer'
  });
  const frameBuffer = device.createBuffer({ label: 'resident-frame', size: 320, usage: 128 });
  const timestampSpans = [];
  const execution = renderer.encode(encoder, {
    colorView: { label: 'canvas-view' },
    frameSource: {
      schema: ULG_COHERENT_SOLID_FRAME_SCHEMA,
      authorityStatus: COHERENT_SOLID_STATE_MANAGER_ADMITTED,
      device,
      buffer: frameBuffer,
      bodyCount: 1,
      generationId: 12,
      leaseId: 7,
      leaseEpoch: 2
    },
    restMesh: mesh,
    halfWidthM: 65,
    halfHeightM: 20,
    timestampProfiler: {
      beginComputePassDescriptor(label, metadata) {
        timestampSpans.push({ label, metadata });
        return { label };
      }
    },
    timestampMetadata: { presentationSerial: 7 }
  });
  assert.equal(execution.schema, ULG_COHERENT_SOLID_RENDER_EXECUTION_SCHEMA);
  assert.equal(execution.directResidentFrameStorageBinding, true);
  assert.equal(execution.persistentRestMeshBinding, true);
  assert.equal(execution.cpuFrameTransformUploadPerformed, false);
  assert.equal(execution.particleSpherePathUsed, false);
  assert.equal(execution.densityFieldPathUsed, false);
  assert.equal(execution.queueSubmissionPerformed, false);
  assert.deepEqual(encoder.events[0].calls.filter(([kind]) => kind === 'pipeline'), [
    ['pipeline', 'test-solid-renderer-grid-backdrop'],
    ['pipeline', 'test-solid-renderer-persistent-shape']
  ]);
  assert.ok(encoder.events[0].calls.some(([kind, count]) => kind === 'draw-indexed'
    && count === fixture.restMesh.indexCount));
  assert.equal(Object.hasOwn(device.queue, 'submit'), false);
  assert.deepEqual(timestampSpans, [{
    label: COHERENT_SOLID_SHAPE_GPU_TIMESTAMP_STAGE.directShapeRender,
    metadata: {
      presentationSerial: 7,
      coherentSolidStage: 'direct-shape-render',
      generationId: 12,
      leaseId: 7,
      leaseEpoch: 2
    }
  }]);
  execution.releaseTransientBuffers();
  renderer.destroy();
  mesh.destroy();
});

test('shape renderer fails closed on unadmitted mutation candidates by default', () => {
  const device = createFakeDevice();
  const fixture = createAsymmetricCoherentSolidFixture();
  const mesh = createCoherentSolidRestMeshGpu(device, fixture.restMesh);
  const renderer = createCoherentSolidShapeRenderer(device, {
    format: 'rgba8unorm',
    width: 320,
    height: 180
  });
  const candidate = {
    schema: ULG_COHERENT_SOLID_FRAME_MUTATION_CANDIDATE_SCHEMA,
    device,
    buffer: device.createBuffer({ label: 'candidate', size: 320, usage: 128 }),
    bodyCount: 1,
    generationId: 2,
    leaseId: 3,
    leaseEpoch: 4
  };
  assert.throws(() => renderer.encode(createFakeEncoder(), {
    colorView: {},
    frameSource: candidate,
    restMesh: mesh,
    halfWidthM: 10,
    halfHeightM: 10
  }), /admitted frame or explicit validation candidate/);
  const execution = renderer.encode(createFakeEncoder(), {
    colorView: {},
    frameSource: candidate,
    restMesh: mesh,
    halfWidthM: 10,
    halfHeightM: 10,
    allowUnadmittedCandidate: true
  });
  assert.match(execution.status, /validation-candidate/);
  execution.releaseTransientBuffers();
  renderer.destroy();
  mesh.destroy();
});

test('render params are fixed and shaders derive every visible vertex from frame SE(3)', () => {
  const params = createCoherentSolidRenderParamsArray({
    bodyIndex: 0,
    generationId: 9,
    leaseId: 10,
    leaseEpoch: 11,
    viewCenterM: [1, 2, 3],
    halfWidthM: 65,
    halfHeightM: 20,
    viewportWidthPx: 960,
    viewportHeightPx: 540
  });
  assert.equal(params.byteLength, 64);
  const combined = `${coherentSolidShapeRenderWgsl}\n${coherentSolidGridBackdropWgsl}`;
  assert.match(coherentSolidShapeRenderWgsl, /resident_frames\[frame_base \+ 13u\]/);
  assert.match(coherentSolidShapeRenderWgsl, /quaternion_rotate\(quaternion, local_position\)/);
  assert.match(coherentSolidShapeRenderWgsl, /center_of_mass \+ quaternion_rotate/);
  assert.doesNotMatch(combined, /particle|marching|density|metaball/i);
  assert.doesNotMatch(combined, /water|iron|sodium|cesium|fluorine/i);
});
