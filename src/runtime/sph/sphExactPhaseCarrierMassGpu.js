import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { computeBufferBinding, prewarmCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';
import { webGpuBufferDevice } from './sphGpuDeviceIdentity.js';
import { createSphExactPhaseCarrierMassWgsl } from './sphExactPhaseCarrierMassWgsl.js';

// Numerical substage only. The physical phase producer owns allocation,
// validation, submission, matched extensive quantities and retirement.
export async function prepareSphExactPhaseCarrierMass({ device, format, lineageCapacity,
  sourceMassBuffer, sourceThermoBuffer, allocate, validate }) {
  validateSphExactMassFormat(format);
  if (typeof allocate !== 'function' || typeof validate !== 'function') {
    throw new TypeError('Phase mass preparation requires producer allocation and validation');
  }
  validate();
  const count = lineageCapacity * 4, massBytes = count * format.wordCount * 4;
  const packetBytes = massBytes * 4;
  if (!Number.isSafeInteger(lineageCapacity) || lineageCapacity < 1
      || count > 0xffffffff || !Number.isSafeInteger(packetBytes)
      || packetBytes / 4 > 0xffffffff
      || packetBytes > device.limits.maxStorageBufferBindingSize
      || packetBytes > device.limits.maxBufferSize
      || Math.ceil(count / 32) > device.limits.maxComputeWorkgroupsPerDimension
      || device.limits.maxStorageBuffersPerShaderStage < 6
      || sourceMassBuffer?.size !== massBytes || sourceThermoBuffer?.size !== count * 48
      || [sourceMassBuffer, sourceThermoBuffer].some(buffer =>
        webGpuBufferDevice(buffer) !== device || (buffer.usage & 128) === 0)) {
    throw new RangeError('Phase mass requires complete same-device four-lane inputs within capacity');
  }
  const make = (suffix, size, usage = 128 | 4 | 8) => allocate({
    label: `ulg-exact-phase-${suffix}`, size, usage
  });
  const packetMassBuffer = make('packets', packetBytes);
  const sumBuffer = make('sum', massBytes);
  const massBuffer = make('mass', massBytes);
  const validationBuffer = make('validation', 16);
  const params = make('params', 16, 64 | 8);
  device.queue.writeBuffer(params, 0, new Uint32Array([lineageCapacity, count, 0, 0]));
  const code = createSphExactPhaseCarrierMassWgsl(format);
  const types = ['read-only-storage', 'read-only-storage', 'storage', 'storage', 'storage', 'storage', 'uniform'];
  const resources = [sourceMassBuffer, sourceThermoBuffer, packetMassBuffer, sumBuffer, massBuffer, validationBuffer, params];
  const stages = [];
  for (const entryPoint of ['select_phase_packets', 'gather_phase_mass', 'commit_phase_mass']) {
    const pipeline = await prewarmCachedExplicitComputePipeline(device, { code, entryPoint,
      cacheKey: `ulg-exact-phase-mass-v4:${format.wordCount}:${format.quantumExponent}:${entryPoint}`,
      label: `ulg-exact-phase-${entryPoint}`, bindings: types.map((type, binding) => computeBufferBinding(binding, type)) });
    if (!pipeline.pipeline) throw pipeline.error ?? new Error(`Phase mass pipeline unavailable: ${entryPoint}`);
    validate();
    stages.push({ pipeline: pipeline.pipeline, bindGroup: device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: resources.map((buffer, binding) => ({ binding, resource: { buffer } }))
    }) });
  }
  return Object.freeze({ massBuffer, packetMassBuffer, validationBuffer, particleCount: count, format,
    transientBuffers: Object.freeze([sumBuffer, params]),
    encode(encoder) {
      validate(); encoder.clearBuffer(validationBuffer);
      for (let index = 0; index < stages.length; index++) {
        const pass = encoder.beginComputePass({ label: `ulg-exact-phase-mass-${index}` });
        pass.setPipeline(stages[index].pipeline); pass.setBindGroup(0, stages[index].bindGroup);
        pass.dispatchWorkgroups(Math.ceil((index === 0 ? lineageCapacity : count) / 32)); pass.end();
      }
    }
  });
}
