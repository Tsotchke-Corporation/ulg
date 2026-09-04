import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  SPH_GPU_RENDER_FIELD_CELL_ROW_LANES,
  SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT,
  ULG_SPH_GPU_RENDER_FIELD_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  createUlgRenderFieldBufferVolumeDescriptor
} from '../src/runtime/sph/sphMarchingCubesSurfaceAdapter.js';
import {
  COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA
} from '../src/runtime/sph/sphOpticalRouteIdentity.js';
import {
  SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS,
  SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX,
  SPH_PARTICIPATING_MEDIUM_PACKED_FRAME_STATUS,
  SPH_PARTICIPATING_MEDIUM_TEXTURE_FORMAT,
  ULG_SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_SCHEMA,
  ULG_SPH_PARTICIPATING_MEDIUM_PACKED_FRAME_SCHEMA,
  aggregateSphParticipatingMediumMoments,
  createSphParticipatingMediumDescriptor,
  createSphParticipatingMediumGpu,
  destroySphParticipatingMediumPackedFrame,
  encodeSphParticipatingMediumPack,
  encodeSphParticipatingMediumRender,
  evaluateSphHenyeyGreensteinPhase,
  evaluateSphParticipatingMediumBeerLambert,
  sphParticipatingMediumPackWgsl,
  sphParticipatingMediumRenderWgsl
} from '../src/runtime/sph/sphParticipatingMediumGpu.js';

const IDENTITY_MATRIX = Object.freeze([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
]);

class FakeGpuResource {
  constructor(descriptor = {}) {
    Object.assign(this, descriptor);
    this.destroyCount = 0;
  }

  createView(descriptor = {}) {
    const view = { texture: this, descriptor };
    this.views ??= [];
    this.views.push(view);
    return view;
  }

  destroy() {
    this.destroyCount += 1;
  }
}

function createGpuRig() {
  const shaderModules = [];
  const computePipelineDescriptors = [];
  const renderPipelineDescriptors = [];
  const buffers = [];
  const textures = [];
  const bindGroups = [];
  const writes = [];
  const computePasses = [];
  const clears = [];
  const renderCalls = [];
  const device = {
    limits: { maxTextureDimension3D: 256 },
    createShaderModule(descriptor) {
      shaderModules.push(descriptor);
      return { descriptor };
    },
    async createComputePipelineAsync(descriptor) {
      computePipelineDescriptors.push(descriptor);
      return {
        descriptor,
        getBindGroupLayout(index) {
          return { pipeline: 'compute', index };
        }
      };
    },
    async createRenderPipelineAsync(descriptor) {
      renderPipelineDescriptors.push(descriptor);
      return {
        descriptor,
        getBindGroupLayout(index) {
          return { pipeline: 'render', index };
        }
      };
    },
    createBuffer(descriptor) {
      const buffer = new FakeGpuResource({ ...descriptor, device });
      buffers.push(buffer);
      return buffer;
    },
    createTexture(descriptor) {
      const texture = new FakeGpuResource({ ...descriptor, device });
      textures.push(texture);
      return texture;
    },
    createSampler(descriptor) {
      return { descriptor, device };
    },
    createBindGroup(descriptor) {
      const bindGroup = { descriptor };
      bindGroups.push(bindGroup);
      return bindGroup;
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
        writes.push({ buffer, offset, bytes });
      }
    }
  };
  const encoder = {
    clearBuffer(buffer, offset, size) {
      clears.push({ buffer, offset, size });
    },
    beginComputePass(descriptor) {
      const calls = [];
      const pass = {
        setPipeline(pipeline) {
          calls.push({ kind: 'pipeline', pipeline });
        },
        setBindGroup(index, bindGroup) {
          calls.push({ kind: 'bind-group', index, bindGroup });
        },
        dispatchWorkgroups(x, y, z) {
          calls.push({ kind: 'dispatch', x, y, z });
        },
        end() {
          calls.push({ kind: 'end' });
        }
      };
      computePasses.push({ descriptor, calls });
      return pass;
    }
  };
  const renderPass = {
    setPipeline(pipeline) {
      renderCalls.push({ kind: 'pipeline', pipeline });
    },
    setBindGroup(index, bindGroup) {
      renderCalls.push({ kind: 'bind-group', index, bindGroup });
    },
    drawIndirect(buffer, offset) {
      renderCalls.push({ kind: 'draw-indirect', buffer, offset });
    }
  };
  return {
    device,
    encoder,
    renderPass,
    shaderModules,
    computePipelineDescriptors,
    renderPipelineDescriptors,
    buffers,
    textures,
    bindGroups,
    writes,
    computePasses,
    clears,
    renderCalls
  };
}

function freezeMetadata(metadata) {
  const snapshot = { ...metadata };
  if (metadata.colorLinear) snapshot.colorLinear = Object.freeze([...metadata.colorLinear]);
  if (metadata.opticalScatteringSourceLinear) {
    snapshot.opticalScatteringSourceLinear = Object.freeze([
      ...metadata.opticalScatteringSourceLinear
    ]);
  }
  return Object.freeze(snapshot);
}

function createFieldFixture({
  device = { label: 'field-device' },
  resolution = 4,
  secondResolution = resolution,
  secondReady = true,
  mutateSnapshot = null
} = {}) {
  const cellCounts = [resolution ** 3, resolution ** 3, secondResolution ** 3];
  const offsets = [0, cellCounts[0], cellCounts[0] + cellCounts[1]];
  const sourceMetadata = [
    {
      index: 0,
      surfaceKey: 'ordinary-surface',
      material: 'base-medium',
      phase: 'liquid',
      renderKey: 'ordinary',
      renderDomainId: 1,
      renderDomainKey: 'base',
      resolution,
      fieldOffset: offsets[0],
      fieldCellCount: cellCounts[0],
      isolation: 14,
      colorLinear: [0.1, 0.2, 0.3],
      opticalStateId: 0,
      collectiveOpticalRoute: false,
      collectiveOpticalRouteSchema: null,
      collectiveOpticalRouteKey: null,
      collectiveOpticalRouteId: null
    },
    {
      index: 1,
      surfaceKey: 'collective-route-a',
      material: 'medium-a',
      phase: 'gas',
      renderKey: 'route-a',
      renderDomainId: 3,
      renderDomainKey: 'carrier-a',
      resolution,
      fieldOffset: offsets[1],
      fieldCellCount: cellCounts[1],
      isolation: 14,
      colorLinear: [0.72, 0.81, 0.91],
      opticalScatteringSourceLinear: [1, 1, 1],
      opticalStateId: 17,
      collectiveOpticalRoute: true,
      collectiveOpticalRouteSchema:
        COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA,
      collectiveOpticalRouteKey: 'collective-route-a',
      collectiveOpticalRouteId: 17,
      opticalResponseAuthorityFlag: 1,
      opticalResponseReady: true,
      opticalVisibilityFlag: 1,
      opticalBlockedFlag: 0
    },
    {
      index: 2,
      surfaceKey: 'collective-route-b',
      material: 'medium-b',
      phase: 'gas',
      renderKey: 'route-b',
      renderDomainId: 4,
      renderDomainKey: 'carrier-b',
      resolution: secondResolution,
      fieldOffset: offsets[2],
      fieldCellCount: cellCounts[2],
      isolation: 14,
      colorLinear: [0.86, 0.78, 0.67],
      opticalStateId: 29,
      collectiveOpticalRoute: true,
      collectiveOpticalRouteSchema:
        COLLECTIVE_DISPERSED_MEDIUM_OPTICAL_ROUTE_SCHEMA,
      collectiveOpticalRouteKey: 'collective-route-b',
      collectiveOpticalRouteId: 29,
      opticalResponseAuthorityFlag: 1,
      opticalResponseReady: secondReady,
      opticalVisibilityFlag: secondReady ? 1 : 0,
      opticalBlockedFlag: secondReady ? 0 : 1
    }
  ];
  const totalFieldCells = cellCounts.reduce((sum, count) => sum + count, 0);
  const fieldRowsBuffer = {
    label: 'render-field-rows',
    size:
      totalFieldCells
      * SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length
      * Float32Array.BYTES_PER_ELEMENT,
    device,
    destroyCount: 0,
    destroy() {
      this.destroyCount += 1;
    }
  };
  const surfaceTable = {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    surfaceCount: sourceMetadata.length,
    totalFieldCells,
    metadata: sourceMetadata
  };
  const renderField = {
    schema: ULG_SPH_GPU_RENDER_FIELD_SCHEMA,
    backend: 'webgpu',
    surfaceCount: sourceMetadata.length,
    totalFieldCells,
    surfaceTable,
    rowLayout: [...SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT],
    rowStrideFloats: SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT.length,
    fieldRowsBufferRetained: true,
    fieldRowsBuffer,
    fieldRowsBufferByteLength: fieldRowsBuffer.size,
    fieldPadding: 0.2,
    refEdgeM: 4
  };
  const surfaceDescriptors = sourceMetadata.map((metadata, index) => {
    const descriptor = createUlgRenderFieldBufferVolumeDescriptor({
      device,
      renderField,
      surfaceIndex: index
    });
    const mutableSnapshot = { ...metadata };
    if (typeof mutateSnapshot === 'function') mutateSnapshot(mutableSnapshot, index);
    return Object.freeze({
      descriptor,
      metadata: freezeMetadata(mutableSnapshot)
    });
  });
  return {
    device,
    renderField,
    surfaceDescriptors,
    sourceMetadata,
    fieldRowsBuffer
  };
}

test('render-field ABI keeps schema-v1 labels and exposes optical moment aliases', () => {
  assert.deepEqual(SPH_GPU_RENDER_FIELD_CELL_ROW_LAYOUT, [
    'density:f32',
    'paletteLinearR:f32',
    'paletteLinearG:f32',
    'paletteLinearB:f32',
    'temperatureK:f32',
    'reserved0:f32',
    'reserved1:f32',
    'reserved2:f32'
  ]);
  assert.deepEqual(SPH_GPU_RENDER_FIELD_CELL_ROW_LANES, {
    density: 0,
    paletteLinearR: 1,
    paletteLinearG: 2,
    paletteLinearB: 3,
    temperatureK: 4,
    scatteringOpticalDepth: 5,
    absorptionOpticalDepth: 6,
    scatteringAsymmetryOpticalDepth: 7,
    reserved0: 5,
    reserved1: 6,
    reserved2: 7
  });
});

test('Beer-Lambert helper is transparent at zero and invariant under substeps', () => {
  const zero = evaluateSphParticipatingMediumBeerLambert();
  assert.equal(zero.transmission, 1);
  assert.equal(zero.opacity, 0);
  assert.equal(zero.singleScatteringAlbedo, 0);

  const whole = evaluateSphParticipatingMediumBeerLambert({
    scatteringOpticalDepth: 0.75,
    absorptionOpticalDepth: 0.25
  });
  const tenth = evaluateSphParticipatingMediumBeerLambert({
    scatteringOpticalDepth: 0.75,
    absorptionOpticalDepth: 0.25,
    distanceScale: 0.1
  });
  assert.ok(Math.abs(whole.transmission - tenth.transmission ** 10) < 1e-12);
  assert.equal(whole.singleScatteringAlbedo, 0.75);
  assert.ok(whole.opacity > evaluateSphParticipatingMediumBeerLambert({
    scatteringOpticalDepth: 0.25
  }).opacity);
});

test('thick-cell aggregation preserves one common optical and color ratio', () => {
  const aggregate = aggregateSphParticipatingMediumMoments([{
    scatteringOpticalDepth: 800,
    absorptionOpticalDepth: 80,
    scatteringAsymmetryOpticalDepth: 640,
    temperatureK: 420,
    scatteringColorLinear: [0.25, 0.5, 1]
  }], { maxOpticalDepth: 80 });
  assert.ok(Math.abs(aggregate.scatteringOpticalDepth - 72.7272727) < 1e-6);
  assert.ok(Math.abs(aggregate.absorptionOpticalDepth - 7.27272727) < 1e-6);
  assert.ok(
    Math.abs(aggregate.scatteringAsymmetryOpticalDepth - 58.18181818) < 1e-6
  );
  assert.equal(aggregate.extinctionOpticalDepth, 80);
  assert.ok(Math.abs(
    aggregate.scatteringOpticalDepth / aggregate.absorptionOpticalDepth - 10
  ) < 1e-12);
  assert.ok(Math.abs(
    aggregate.scatteringAsymmetryOpticalDepth
      / aggregate.scatteringOpticalDepth - 0.8
  ) < 1e-12);
  assert.deepEqual(aggregate.scatteringColorLinear, [0.25, 0.5, 1]);
  assert.equal(aggregate.temperatureK, 420);
  assert.equal(aggregate.transmission, Math.exp(-80));
});

test('aggregate sanitizes non-finite signed moments and caps every half-float lane', () => {
  const aggregate = aggregateSphParticipatingMediumMoments([{
    scatteringOpticalDepth: Number.MAX_VALUE,
    absorptionOpticalDepth: Number.MAX_VALUE,
    scatteringAsymmetryOpticalDepth: Number.NaN,
    temperatureK: Number.MAX_VALUE,
    scatteringColorLinear: [1, 1, 1]
  }], { maxOpticalDepth: Number.MAX_VALUE });
  assert.equal(aggregate.extinctionOpticalDepth, SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX);
  assert.equal(aggregate.scatteringAsymmetryOpticalDepth, 0);
  assert.equal(aggregate.temperatureK, SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX);
  for (const value of [
    aggregate.scatteringOpticalDepth,
    aggregate.absorptionOpticalDepth,
    aggregate.scatteringAsymmetryOpticalDepth,
    aggregate.temperatureK,
    ...aggregate.scatteringColorOpticalDepth
  ]) {
    assert.ok(Number.isFinite(value));
    assert.ok(Math.abs(value) <= SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX);
  }
});

test('Henyey-Greenstein helper preserves isotropy and responds to asymmetry', () => {
  const isotropic = evaluateSphHenyeyGreensteinPhase();
  assert.ok(Math.abs(isotropic - 1 / (4 * Math.PI)) < 1e-14);
  const forward = evaluateSphHenyeyGreensteinPhase({
    asymmetry: 0.7,
    cosineAngle: 1
  });
  const backward = evaluateSphHenyeyGreensteinPhase({
    asymmetry: 0.7,
    cosineAngle: -1
  });
  assert.ok(forward > isotropic);
  assert.ok(isotropic > backward);
  assert.equal(evaluateSphHenyeyGreensteinPhase({
    asymmetry: 0,
    cosineAngle: 0.4,
    relativeToIsotropic: true
  }), 1);
});

test('descriptor consumes only authenticated collective routes from a complete surface set', () => {
  const fixture = createFieldFixture();
  const descriptor = createSphParticipatingMediumDescriptor({
    device: fixture.device,
    renderField: fixture.renderField,
    surfaceDescriptors: fixture.surfaceDescriptors
  });
  assert.equal(descriptor.schema, ULG_SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_SCHEMA);
  assert.equal(descriptor.ok, true);
  assert.equal(descriptor.status, SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS.ready);
  assert.equal(descriptor.routeCount, 2);
  assert.deepEqual(descriptor.consumedSurfaceIndices, [1, 2]);
  assert.deepEqual(descriptor.opticalStateIds, [17, 29]);
  assert.deepEqual(descriptor.dims, [4, 4, 4]);
  assert.equal(descriptor.fieldRowsBuffer, fixture.fieldRowsBuffer);
  assert.equal(descriptor.temperatureLaneIndex, 4);
  assert.equal(descriptor.scatteringOpticalDepthLaneIndex, 5);
  assert.equal(descriptor.absorptionOpticalDepthLaneIndex, 6);
  assert.equal(descriptor.scatteringAsymmetryOpticalDepthLaneIndex, 7);
  assert.equal(descriptor.aggregateTextureCount, 2);
  assert.equal(descriptor.readback, false);
  assert.equal(descriptor.activityMode, 'gpu-indirect-not-read-back');
});

test('descriptor reports ordinary-only input as empty without consuming MC surfaces', () => {
  const fixture = createFieldFixture();
  const descriptor = createSphParticipatingMediumDescriptor({
    device: fixture.device,
    renderField: fixture.renderField,
    surfaceDescriptors: [fixture.surfaceDescriptors[0]]
  });
  assert.equal(descriptor.ok, true);
  assert.equal(descriptor.status, SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS.empty);
  assert.deepEqual(descriptor.consumedSurfaceIndices, []);
});

test('descriptor consumes but blocks a collective route without optical authority', () => {
  const fixture = createFieldFixture({ secondReady: false });
  const descriptor = createSphParticipatingMediumDescriptor({
    device: fixture.device,
    renderField: fixture.renderField,
    surfaceDescriptors: fixture.surfaceDescriptors
  });
  assert.equal(descriptor.ok, false);
  assert.equal(descriptor.status, SPH_PARTICIPATING_MEDIUM_DESCRIPTOR_STATUS.blocked);
  assert.deepEqual(descriptor.consumedSurfaceIndices, [1, 2]);
  assert.equal(descriptor.blockedSurfaceIndex, 2);
});

test('descriptor fails closed on snapshot drift, cross-device buffers, and grid mismatch', () => {
  const drifted = createFieldFixture({
    mutateSnapshot(metadata, index) {
      if (index === 1) metadata.fieldOffset += 1;
    }
  });
  assert.equal(createSphParticipatingMediumDescriptor({
    device: drifted.device,
    renderField: drifted.renderField,
    surfaceDescriptors: drifted.surfaceDescriptors
  }).ok, false);

  const crossDevice = createFieldFixture();
  assert.match(createSphParticipatingMediumDescriptor({
    device: { label: 'other-device' },
    renderField: crossDevice.renderField,
    surfaceDescriptors: crossDevice.surfaceDescriptors
  }).reason, /cross-device|unauthenticated/);

  const mismatched = createFieldFixture({ secondResolution: 5 });
  assert.match(createSphParticipatingMediumDescriptor({
    device: mismatched.device,
    renderField: mismatched.renderField,
    surfaceDescriptors: mismatched.surfaceDescriptors
  }).reason, /shared grid transform/);
});

test('pack rejects source or descriptor mutation after authority was captured', async () => {
  const rig = createGpuRig();
  const fixture = createFieldFixture({ device: rig.device });
  const descriptor = createSphParticipatingMediumDescriptor({
    device: rig.device,
    renderField: fixture.renderField,
    surfaceDescriptors: fixture.surfaceDescriptors
  });
  const runtime = createSphParticipatingMediumGpu(rig.device);
  fixture.sourceMetadata[1].opticalResponseReady = false;
  await assert.rejects(
    encodeSphParticipatingMediumPack(runtime, rig.encoder, descriptor),
    /authority changed/
  );
  assert.equal(rig.textures.length, 0);
  runtime.destroy();
});

test('pack rejects wholesale surface-table, metadata-array, and row replacement', async () => {
  const assertReplacementBlocked = async (replace) => {
    const rig = createGpuRig();
    const fixture = createFieldFixture({ device: rig.device });
    const descriptor = createSphParticipatingMediumDescriptor({
      device: rig.device,
      renderField: fixture.renderField,
      surfaceDescriptors: fixture.surfaceDescriptors
    });
    const runtime = createSphParticipatingMediumGpu(rig.device);
    replace(fixture);
    await assert.rejects(
      encodeSphParticipatingMediumPack(runtime, rig.encoder, descriptor),
      /identity|authority changed|revalidation/
    );
    assert.equal(rig.textures.length, 0);
    runtime.destroy();
  };

  await assertReplacementBlocked(({ renderField }) => {
    renderField.surfaceTable = {
      ...renderField.surfaceTable,
      metadata: renderField.surfaceTable.metadata
    };
  });
  await assertReplacementBlocked(({ renderField }) => {
    renderField.surfaceTable.metadata = [...renderField.surfaceTable.metadata];
  });
  await assertReplacementBlocked(({ renderField }) => {
    const prior = renderField.surfaceTable.metadata[1];
    renderField.surfaceTable.metadata[1] = {
      ...prior,
      colorLinear: [...prior.colorLinear],
      opticalScatteringSourceLinear: [...prior.opticalScatteringSourceLinear]
    };
  });
});

test('GPU pack writes aggregate route rows, gates an indirect draw, and performs no readback', async () => {
  const rig = createGpuRig();
  const fixture = createFieldFixture({ device: rig.device, resolution: 5 });
  const descriptor = createSphParticipatingMediumDescriptor({
    device: rig.device,
    renderField: fixture.renderField,
    surfaceDescriptors: fixture.surfaceDescriptors
  });
  const runtime = createSphParticipatingMediumGpu(rig.device, {
    colorFormat: 'rgba8unorm',
    maxOpticalDepth: Number.MAX_VALUE
  });
  const frame = await encodeSphParticipatingMediumPack(
    runtime,
    rig.encoder,
    descriptor
  );

  assert.equal(frame.schema, ULG_SPH_PARTICIPATING_MEDIUM_PACKED_FRAME_SCHEMA);
  assert.equal(frame.status, SPH_PARTICIPATING_MEDIUM_PACKED_FRAME_STATUS);
  assert.equal(frame.routeCount, 2);
  assert.equal(frame.readback, false);
  assert.equal(frame.drawCountMode, 'gpu-indirect-not-read-back');
  assert.equal(frame.sourceBufferConsumptionEncoded, true);
  assert.equal(runtime.maxOpticalDepth, SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX);
  assert.equal(rig.textures.length, 2);
  for (const texture of rig.textures) {
    assert.equal(texture.format, SPH_PARTICIPATING_MEDIUM_TEXTURE_FORMAT);
    assert.deepEqual(texture.size, {
      width: 5,
      height: 5,
      depthOrArrayLayers: 5
    });
  }
  assert.equal(rig.clears.length, 1);
  assert.equal(rig.clears[0].buffer, frame.drawIndirectBuffer);
  const dispatch = rig.computePasses[0].calls.find((call) => call.kind === 'dispatch');
  assert.deepEqual(dispatch, { kind: 'dispatch', x: 2, y: 2, z: 2 });
  const routeWrite = rig.writes.find((write) => write.buffer.label.endsWith('route-rows'));
  const routeWords = new Uint32Array(
    routeWrite.bytes.buffer,
    routeWrite.bytes.byteOffset,
    routeWrite.bytes.byteLength / Uint32Array.BYTES_PER_ELEMENT
  );
  assert.deepEqual([...routeWords].filter((_value, index) => index % 8 < 4), [
    5 ** 3, 5, 17, 1,
    2 * 5 ** 3, 5, 29, 2
  ]);
  const paramsWrite = rig.writes.find((write) => write.buffer.label.endsWith('pack-params'));
  const paramsFloats = new Float32Array(
    paramsWrite.bytes.buffer,
    paramsWrite.bytes.byteOffset,
    paramsWrite.bytes.byteLength / Float32Array.BYTES_PER_ELEMENT
  );
  assert.equal(paramsFloats[4], SPH_PARTICIPATING_MEDIUM_HALF_FLOAT_MAX);
  await assert.rejects(
    encodeSphParticipatingMediumPack(runtime, rig.encoder, descriptor),
    /consumed/
  );
  runtime.destroy();
});

test('volume render writes uniforms and issues only GPU-indirect presentation', async () => {
  const rig = createGpuRig();
  const fixture = createFieldFixture({ device: rig.device });
  const descriptor = createSphParticipatingMediumDescriptor({
    device: rig.device,
    renderField: fixture.renderField,
    surfaceDescriptors: fixture.surfaceDescriptors
  });
  const runtime = createSphParticipatingMediumGpu(rig.device, {
    colorFormat: 'rgba8unorm'
  });
  const frame = await encodeSphParticipatingMediumPack(runtime, rig.encoder, descriptor);
  const depthTextureView = { label: 'stored-opaque-depth-view' };
  const receipt = await encodeSphParticipatingMediumRender(
    runtime,
    rig.renderPass,
    {
      packedFrame: frame,
      inverseViewProjectionMatrix: IDENTITY_MATRIX,
      cameraPositionM: [2, 2, 6],
      viewportSize: [1280, 720],
      depthTextureView,
      lightDirection: [0.3, 0.8, 0.4],
      stepCount: 32
    }
  );
  assert.equal(receipt.status, 'participating-medium-render-encoded');
  assert.equal(receipt.stepCount, 32);
  assert.equal(receipt.readback, false);
  const draw = rig.renderCalls.find((call) => call.kind === 'draw-indirect');
  assert.equal(draw.buffer, frame.drawIndirectBuffer);
  assert.equal(draw.offset, 0);
  const renderBindGroup = rig.bindGroups.at(-1).descriptor;
  assert.equal(renderBindGroup.entries[4].resource, depthTextureView);
  const target = rig.renderPipelineDescriptors[0].fragment.targets[0];
  assert.deepEqual(target.blend.color, {
    operation: 'add',
    srcFactor: 'one',
    dstFactor: 'one-minus-src-alpha'
  });
  assert.equal(rig.writes.at(-1).bytes.byteLength, 40 * Float32Array.BYTES_PER_ELEMENT);

  assert.equal(destroySphParticipatingMediumPackedFrame(frame), true);
  assert.equal(destroySphParticipatingMediumPackedFrame(frame), false);
  assert.equal(frame.destroyed, true);
  assert.equal(frame.opticalTexture.destroyCount, 1);
  assert.equal(frame.scatteringTexture.destroyCount, 1);
  await assert.rejects(
    encodeSphParticipatingMediumRender(runtime, rig.renderPass, {
      packedFrame: frame,
      inverseViewProjectionMatrix: IDENTITY_MATRIX,
      cameraPositionM: [2, 2, 6],
      viewportSize: [1280, 720],
      depthTextureView
    }),
    /live packed frame/
  );
  assert.equal(runtime.destroy(), true);
  assert.equal(runtime.destroy(), false);
});

test('WGSL aggregates conserved moments, reverses depth remap, and source stays generic', () => {
  assert.match(sphParticipatingMediumPackWgsl, /moments\.y/);
  assert.match(sphParticipatingMediumPackWgsl, /moments\.z/);
  assert.match(sphParticipatingMediumPackWgsl, /moments\.w/);
  assert.match(sphParticipatingMediumPackWgsl, /common_scale/);
  assert.match(sphParticipatingMediumPackWgsl, /normalized_extinction/);
  assert.match(sphParticipatingMediumPackWgsl, /value == value/);
  assert.match(sphParticipatingMediumPackWgsl, /HALF_FLOAT_MAX: f32 = 65504\.0/);
  assert.match(sphParticipatingMediumPackWgsl, /atomicMax\(&draw_indirect\[0\], 3u\)/);
  assert.match(sphParticipatingMediumRenderWgsl, /exp\(-extinction_depth\)/);
  assert.match(sphParticipatingMediumRenderWgsl, /relative_henyey_greenstein/);
  assert.match(sphParticipatingMediumRenderWgsl, /scene_depth \* 2\.0 - 1\.0/);
  assert.match(sphParticipatingMediumRenderWgsl, /transmittance < 0\.00390625/);
  assert.match(sphParticipatingMediumRenderWgsl, /finite_signed_sample\(optical\.z\)/);
  assert.match(sphParticipatingMediumRenderWgsl, /raw_asymmetry == raw_asymmetry/);

  const source = readFileSync(resolve(
    'src/runtime/sph/sphParticipatingMediumGpu.js'
  ), 'utf8');
  assert.doesNotMatch(
    source,
    /\b(?:h2o|water|steam|naoh|sodium|preset|scenario)\b/i
  );
  assert.doesNotMatch(source, /mapAsync|getMappedRange/);
});
