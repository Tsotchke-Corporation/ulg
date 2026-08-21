import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  planSphReactionProductPlacementDispatchWorkgroups
} from '../src/runtime/sph/schroederSpatialReactionProductPlacementGpu.js';

const RUN_NATIVE =
  process.env.ULG_RUN_NATIVE_REACTION_PRODUCT_PLACEMENT === '1';
const BASE_URL = process.env.ULG_REACTION_PRODUCT_PLACEMENT_BASE_URL
  || 'https://127.0.0.1:5174/';
const CHROME = process.env.ULG_REACTION_PRODUCT_PLACEMENT_CHROME
  || '/usr/bin/google-chrome';

test('segmented placement rejects explicit 1-D dispatches beyond the device limit', () => {
  const device = { limits: { maxComputeWorkgroupsPerDimension: 2 } };
  assert.deepEqual(
    planSphReactionProductPlacementDispatchWorkgroups({
      device,
      eventCount: 128,
      particleCount: 64,
      productTermCount: 1
    }),
    {
      eventWorkgroups: 2,
      particleWorkgroups: 1,
      termWorkgroups: 1,
      maxComputeWorkgroupsPerDimension: 2
    }
  );
  assert.throws(() => planSphReactionProductPlacementDispatchWorkgroups({
    device,
    eventCount: 129,
    particleCount: 64,
    productTermCount: 1
  }), (error) => (
    error?.code === 'ERR_SPH_REACTION_PRODUCT_PLACEMENT_DISPATCH_LIMIT'
    && error.dispatchClass === 'event'
    && error.requiredWorkgroups === 3
  ));
});

function nearestRank(values, quantile) {
  assert.ok(values.length > 0, 'percentile requires at least one sample');
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(1, Math.ceil(sorted.length * quantile));
  return sorted[Math.min(sorted.length - 1, rank - 1)];
}

test('native segmented reaction-product placement matches its CPU oracle and remains bounded at 65,536 conflicts', {
  skip: RUN_NATIVE
    ? false
    : 'set ULG_RUN_NATIVE_REACTION_PRODUCT_PLACEMENT=1 for native Vulkan WebGPU',
  timeout: 900_000
}, async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });

  let native;
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true });
    await page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    native = await page.evaluate(async () => {
      if (!navigator.gpu) {
        return { status: 'unsupported', reason: 'navigator.gpu unavailable' };
      }
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) {
        return { status: 'unsupported', reason: 'WebGPU adapter unavailable' };
      }
      if (!adapter.features.has('timestamp-query')) {
        return {
          status: 'unsupported',
          reason: 'timestamp-query unavailable on the selected adapter'
        };
      }
      const nativeDevice = await adapter.requestDevice({
        requiredFeatures: ['timestamp-query'],
        requiredLimits: {
          maxStorageBuffersPerShaderStage: 12
        }
      });
      const uncapturedErrors = [];
      nativeDevice.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error?.message || String(event.error));
      });
      nativeDevice.pushErrorScope('validation');
      nativeDevice.pushErrorScope('internal');
      nativeDevice.pushErrorScope('out-of-memory');

      const instrumentation = {
        bufferCreateCount: 0,
        createdBufferLabels: [],
        createdBufferDescriptors: [],
        queueSubmitCount: 0,
        queueWriteCount: 0
      };
      const queueFacade = new Proxy(nativeDevice.queue, {
        get(target, property) {
          if (property === 'submit') {
            return (commandBuffers) => {
              instrumentation.queueSubmitCount += 1;
              return target.submit(commandBuffers);
            };
          }
          if (property === 'writeBuffer') {
            return (...args) => {
              instrumentation.queueWriteCount += 1;
              return target.writeBuffer(...args);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
      const device = new Proxy(nativeDevice, {
        get(target, property) {
          if (property === 'queue') return queueFacade;
          if (property === 'createBuffer') {
            return (descriptor) => {
              instrumentation.bufferCreateCount += 1;
              instrumentation.createdBufferLabels.push(descriptor.label || '');
              instrumentation.createdBufferDescriptors.push({
                label: descriptor.label || '',
                usage: descriptor.usage
              });
              return target.createBuffer(descriptor);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });

      const createBuffer = (
        label,
        valuesOrByteLength,
        usage = GPUBufferUsage.STORAGE
          | GPUBufferUsage.COPY_SRC
          | GPUBufferUsage.COPY_DST
      ) => {
        const values = ArrayBuffer.isView(valuesOrByteLength)
          ? valuesOrByteLength
          : null;
        const byteLength = values
          ? values.byteLength
          : Number(valuesOrByteLength);
        const buffer = device.createBuffer({
          label,
          size: Math.max(4, Math.ceil(byteLength / 4) * 4),
          usage
        });
        if (values?.byteLength) device.queue.writeBuffer(buffer, 0, values);
        return buffer;
      };
      const readBuffer = async (source, byteLength, label) => {
        const size = Math.max(4, Math.ceil(byteLength / 4) * 4);
        const readback = createBuffer(
          label,
          size,
          GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        );
        const encoder = device.createCommandEncoder({
          label: `${label}-copy-encoder`
        });
        encoder.copyBufferToBuffer(source, 0, readback, 0, size);
        device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ, 0, size);
        const bytes = readback.getMappedRange(0, size).slice(0, byteLength);
        readback.unmap();
        readback.destroy();
        return bytes;
      };
      const createTimestampRecorder = (queryCapacity = 4096) => {
        const querySet = device.createQuerySet({
          label: 'ulg-native-placement-timestamp-queries',
          type: 'timestamp',
          count: queryCapacity
        });
        const byteCapacity = queryCapacity * BigUint64Array.BYTES_PER_ELEMENT;
        const resolveBuffer = createBuffer(
          'ulg-native-placement-timestamp-resolve',
          byteCapacity,
          GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        );
        const readbackBuffer = createBuffer(
          'ulg-native-placement-timestamp-readback',
          byteCapacity,
          GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        );
        const spans = [];
        const pending = new Set();
        const encoderTokens = new WeakMap();
        let nextQueryIndex = 0;
        const allocateQuery = () => {
          if (nextQueryIndex >= queryCapacity) {
            throw new RangeError('native placement timestamp capacity exhausted');
          }
          const index = nextQueryIndex;
          nextQueryIndex += 1;
          return index;
        };
        const recorder = {
          active: true,
          beginEncoderSpan(encoder, descriptor = {}) {
            const token = {
              descriptor: { ...descriptor },
              startQueryIndex: allocateQuery(),
              endQueryIndex: null,
              encoder
            };
            encoder.writeTimestamp(querySet, token.startQueryIndex);
            spans.push(token);
            pending.add(token);
            const tokens = encoderTokens.get(encoder) || [];
            tokens.push(token);
            encoderTokens.set(encoder, tokens);
            return token;
          },
          endEncoderSpan(encoder, token) {
            if (
              token?.encoder !== encoder
              || !pending.delete(token)
              || token.endQueryIndex !== null
            ) {
              throw new Error('native placement timestamp token replay/mismatch');
            }
            token.endQueryIndex = allocateQuery();
            encoder.writeTimestamp(querySet, token.endQueryIndex);
          },
          discardEncoderSpans(encoder) {
            const tokens = encoderTokens.get(encoder) || [];
            if (tokens.length === 0) return 0;
            const suffixStart = spans.length - tokens.length;
            if (tokens.some((token, index) => spans[suffixStart + index] !== token)) {
              throw new Error('discarded timestamp spans were not a suffix');
            }
            const indices = tokens.flatMap((token) => [
              token.startQueryIndex,
              ...(token.endQueryIndex === null ? [] : [token.endQueryIndex])
            ]).sort((left, right) => left - right);
            const rollback = indices[0];
            if (
              indices.length !== nextQueryIndex - rollback
              || indices.some((index, offset) => index !== rollback + offset)
            ) {
              throw new Error('discarded timestamp queries were not a suffix');
            }
            for (const token of tokens) pending.delete(token);
            spans.splice(suffixStart, tokens.length);
            nextQueryIndex = rollback;
            encoderTokens.delete(encoder);
            return tokens.length;
          }
        };
        return {
          recorder,
          async complete() {
            if (pending.size !== 0) {
              throw new Error(`${pending.size} timestamp spans remain open`);
            }
            if (nextQueryIndex === 0) return [];
            const byteLength = nextQueryIndex
              * BigUint64Array.BYTES_PER_ELEMENT;
            const encoder = device.createCommandEncoder({
              label: 'ulg-native-placement-timestamp-resolve-encoder'
            });
            encoder.resolveQuerySet(
              querySet,
              0,
              nextQueryIndex,
              resolveBuffer,
              0
            );
            encoder.copyBufferToBuffer(
              resolveBuffer,
              0,
              readbackBuffer,
              0,
              byteLength
            );
            device.queue.submit([encoder.finish()]);
            await readbackBuffer.mapAsync(GPUMapMode.READ, 0, byteLength);
            const timestamps = new BigUint64Array(
              readbackBuffer.getMappedRange(0, byteLength).slice(0)
            );
            readbackBuffer.unmap();
            return spans.map((span) => {
              const start = timestamps[span.startQueryIndex];
              const end = timestamps[span.endQueryIndex];
              const durationNs = end > start ? Number(end - start) : 0;
              return {
                ...span.descriptor,
                startTimestampNs: start.toString(),
                endTimestampNs: end.toString(),
                durationNs,
                durationMs: durationNs / 1e6
              };
            });
          },
          destroy() {
            querySet.destroy?.();
            resolveBuffer.destroy();
            readbackBuffer.destroy();
          }
        };
      };
      const f32 = Math.fround;
      const f32Add = (left, right) => f32(f32(left) + f32(right));
      const f32Mul = (left, right) => f32(f32(left) * f32(right));
      const AVOGADRO_PER_MOL = f32(6.02214076e23);
      const makeProductEvent = ({
        position = [0.5, 0.5, 0.5],
        massKg = 0.125,
        placedMassKg = 0,
        materialId = 11,
        productTermIndex = 0,
        reactionIndex = 0,
        sourceParticleIndex = 1,
        partnerParticleIndex = 2,
        moles = null,
        molarMassKgPerMol = 0.05,
        routingId = 0,
        phaseId = 2,
        temperatureK = 400,
        restDensityKgPerM3 = 1000,
        status = 1,
        specificInternalEnergyJPerKg = 20,
        velocityMPerS = [0, 0, 0],
        effectiveBulkModulusPa = 100,
        shearModulusPa = 0,
        lameLambdaPa = 100,
        soundSpeedMPerS = 10,
        eosModelId = 1,
        solidFlag = 0,
        mechanicsStatus = 1,
        dispositionId = 0,
        currentVolumeM3 = null
      } = {}) => {
        const unplacedMassKg = f32(Math.max(0, massKg - placedMassKg));
        const eventMoles = moles == null
          ? f32(massKg / molarMassKgPerMol)
          : f32(moles);
        const supportVolumeM3 = currentVolumeM3 == null
          ? (restDensityKgPerM3 > 0
            ? f32(unplacedMassKg / restDensityKgPerM3)
            : 0)
          : f32(currentVolumeM3);
        return new Float32Array([
          ...position.map(f32), f32(massKg),
          f32(materialId), f32(productTermIndex), f32(reactionIndex),
          f32(sourceParticleIndex),
          f32(partnerParticleIndex), eventMoles, f32(routingId), f32(phaseId),
          f32(placedMassKg), unplacedMassKg, 1, f32(molarMassKgPerMol),
          f32(temperatureK), f32(restDensityKgPerM3), f32(status),
          f32(specificInternalEnergyJPerKg),
          ...velocityMPerS.map(f32), supportVolumeM3,
          f32(effectiveBulkModulusPa), f32(shearModulusPa),
          f32(lameLambdaPa), f32(soundSpeedMPerS),
          f32(eosModelId), f32(solidFlag), f32(mechanicsStatus),
          f32(dispositionId)
        ]);
      };
      const packProductEvents = (events) => {
        const values = new Float32Array(events.length * 32);
        events.forEach((event, index) => values.set(event, index * 32));
        return values;
      };
      const makeDestinationFamily = ({
        particleCount = 4,
        carrierIndex = 0,
        carrierMassKg = 2,
        carrierPosition = [0.25, 0.5, 0.75],
        carrierVelocity = [1, -0.5, 0.25],
        carrierTemperatureK = 300,
        carrierInternalEnergyJPerKg = 10,
        carrierRepresentedEntityCount = 7.5e22,
        materialId = 11,
        phaseId = 2,
        restDensityKgPerM3 = 1000,
        carrierRestVolumeM3 = carrierMassKg / restDensityKgPerM3,
        carrierVolumeRatioJ = 1
      } = {}) => {
        const state = new Float32Array(particleCount * 8);
        const thermo = new Float32Array(particleCount * 12);
        const mechanics = new Float32Array(particleCount * 32);
        const stateBase = carrierIndex * 8;
        state.set([
          ...carrierPosition.map(f32), f32(carrierMassKg),
          ...carrierVelocity.map(f32), f32(carrierInternalEnergyJPerKg)
        ], stateBase);
        const thermoBase = carrierIndex * 12;
        thermo.set([
          f32(materialId), f32(phaseId), f32(carrierTemperatureK),
          f32(restDensityKgPerM3),
          phaseId === 1 ? 1 : 0,
          phaseId === 2 ? 1 : 0,
          phaseId === 3 ? 1 : 0,
          phaseId >= 4 ? 1 : 0,
          0.05, f32(carrierRepresentedEntityCount), 1, 0.05
        ], thermoBase);
        const mechanicsBase = carrierIndex * 32;
        const deformationScale = f32(Math.cbrt(carrierVolumeRatioJ));
        mechanics.set([
          deformationScale, 0, 0, 0,
          deformationScale, 0, 0, 0,
          deformationScale, 0, 0, 0,
          0, 0, 0, 0,
          0, 0, f32(carrierVolumeRatioJ), f32(carrierRestVolumeM3),
          0, 1, 100, 0,
          100, 10, 1, 1,
          0, 0, 0, 0
        ], mechanicsBase);
        return { state, thermo, mechanics };
      };
      const captureMergeOracle = ({
        destination,
        events,
        carrierIndex = 0
      }) => {
        const state = destination.state.slice();
        const thermo = destination.thermo.slice();
        const mechanics = destination.mechanics.slice();
        const productEvents = packProductEvents(events);
        const stateBase = carrierIndex * 8;
        const thermoBase = carrierIndex * 12;
        const mechanicsBase = carrierIndex * 32;
        const reduceFixedTree = (selector) => {
          if (events.length === 0) return 0;
          let input = Float32Array.from(events, selector);
          for (let stride = 1; stride < input.length; stride *= 2) {
            const output = input.slice();
            for (let index = stride; index < input.length; index += 1) {
              output[index] = f32Add(input[index], input[index - stride]);
            }
            input = output;
          }
          return input[input.length - 1];
        };
        const aggregateMass = reduceFixedTree((event) => event[13]);
        const aggregatePositionMoment = [0, 1, 2].map((axis) => (
          reduceFixedTree((event) => f32Mul(event[axis], event[13]))
        ));
        const aggregateMomentum = [0, 1, 2].map((axis) => (
          reduceFixedTree((event) => f32Mul(event[20 + axis], event[13]))
        ));
        const aggregateTotalEnergy = reduceFixedTree((event) => {
          const speedSquared = f32Add(
            f32Add(
              f32Mul(event[20], event[20]),
              f32Mul(event[21], event[21])
            ),
            f32Mul(event[22], event[22])
          );
          return f32Mul(
            f32Add(event[19], f32Mul(0.5, speedSquared)),
            event[13]
          );
        });
        const aggregateTemperatureMoment = reduceFixedTree((event) => (
          f32Mul(event[16], event[13])
        ));
        const aggregateRestVolume = reduceFixedTree((event) => (
          f32(event[13] / event[17])
        ));
        // Event row 5.w is support/routing geometry. Materialized product
        // mass starts at its target reference density, so its incoming
        // mechanics current volume equals its rest volume (J = 1).
        const aggregateReferenceBornCurrentVolume = aggregateRestVolume;
        const aggregateRepresentedEntityCount = reduceFixedTree((event) => (
          f32Mul(
            f32(event[13] / event[15]),
            AVOGADRO_PER_MOL
          )
        ));
        for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
          const eventBase = eventIndex * 32;
          productEvents[eventBase + 13] = 0;
          productEvents[eventBase + 18] = 0;
          productEvents[eventBase + 31] = 4;
        }
        if (events.length === 0) {
          return { state, thermo, mechanics, productEvents };
        }
        const sourceMass = state[stateBase + 3];
        const sourceVelocity = [
          state[stateBase + 4],
          state[stateBase + 5],
          state[stateBase + 6]
        ];
        const sourceInternalEnergy = state[stateBase + 7];
        const mass = f32Add(sourceMass, aggregateMass);
        const inverseMass = f32(1 / Math.max(mass, 1.0e-20));
        for (let axis = 0; axis < 3; axis += 1) {
          state[stateBase + axis] = f32Mul(
            f32Add(
              f32Mul(state[stateBase + axis], sourceMass),
              aggregatePositionMoment[axis]
            ),
            inverseMass
          );
          state[stateBase + 4 + axis] = f32Mul(
            f32Add(
              f32Mul(state[stateBase + 4 + axis], sourceMass),
              aggregateMomentum[axis]
            ),
            inverseMass
          );
        }
        state[stateBase + 3] = mass;
        const sourceSpeedSquared = f32Add(
          f32Add(
            f32Mul(sourceVelocity[0], sourceVelocity[0]),
            f32Mul(sourceVelocity[1], sourceVelocity[1])
          ),
          f32Mul(sourceVelocity[2], sourceVelocity[2])
        );
        const destinationTotalEnergy = f32Mul(
          sourceMass,
          f32Add(
            sourceInternalEnergy,
            f32Mul(0.5, sourceSpeedSquared)
          )
        );
        const outputSpeedSquared = f32Add(
          f32Add(
            f32Mul(state[stateBase + 4], state[stateBase + 4]),
            f32Mul(state[stateBase + 5], state[stateBase + 5])
          ),
          f32Mul(state[stateBase + 6], state[stateBase + 6])
        );
        state[stateBase + 7] = f32Mul(
          f32Add(
            f32Add(destinationTotalEnergy, aggregateTotalEnergy),
            -f32Mul(0.5, f32Mul(mass, outputSpeedSquared))
          ),
          inverseMass
        );
        thermo[thermoBase + 2] = f32Mul(
          f32Add(
            f32Mul(thermo[thermoBase + 2], sourceMass),
            aggregateTemperatureMoment
          ),
          inverseMass
        );
        thermo[thermoBase + 9] = f32Add(
          thermo[thermoBase + 9],
          aggregateRepresentedEntityCount
        );
        const previousJ = mechanics[mechanicsBase + 18];
        const previousRestVolume = mechanics[mechanicsBase + 19];
        const previousCurrentVolume = f32Mul(previousJ, previousRestVolume);
        const nextRestVolume = f32Add(previousRestVolume, aggregateRestVolume);
        const nextCurrentVolume = f32Add(
          previousCurrentVolume,
          aggregateReferenceBornCurrentVolume
        );
        const nextJ = f32(nextCurrentVolume / nextRestVolume);
        const deformationScale = f32(Math.cbrt(f32(nextJ / previousJ)));
        for (let index = 0; index <= 8; index += 1) {
          mechanics[mechanicsBase + index] = f32Mul(
            mechanics[mechanicsBase + index],
            deformationScale
          );
        }
        mechanics[mechanicsBase + 18] = nextJ;
        mechanics[mechanicsBase + 19] = nextRestVolume;
        return { state, thermo, mechanics, productEvents };
      };
      const makeAllToOneCaptureSpec = (eventCount) => {
        const destination = makeDestinationFamily({
          particleCount: 4,
          carrierVolumeRatioJ: 2
        });
        const events = Array.from({ length: eventCount }, (_, index) => (
          makeProductEvent({
            position: [
              f32(0.5 + (index % 7) / 128),
              f32(0.5 - (index % 5) / 256),
              f32(0.5 + (index % 3) / 512)
            ],
            massKg: f32(1 / 1024),
            currentVolumeM3: f32((index % 3 + 2) / 1048576),
            temperatureK: f32(350 + (index % 11)),
            specificInternalEnergyJPerKg: f32(20 + (index % 13)),
            velocityMPerS: [
              f32((index % 5) / 16),
              f32(-(index % 3) / 32),
              f32((index % 7) / 64)
            ]
          })
        ));
        const decisions = new Float32Array(eventCount * 4);
        for (let index = 0; index < eventCount; index += 1) {
          decisions.set([0, 0, 1, 4], index * 4);
        }
        return {
          name: `all-to-one-capture-${eventCount}`,
          eventCount,
          particleCount: 4,
          productTermCount: 1,
          events: packProductEvents(events),
          decisions,
          destination,
          oracle: captureMergeOracle({ destination, events })
        };
      };
      const makeSpareExhaustionSpec = () => {
        const eventCount = 5;
        const particleCount = 4;
        const availableSpareCount = 2;
        const destination = {
          state: new Float32Array(particleCount * 8),
          thermo: new Float32Array(particleCount * 12),
          mechanics: new Float32Array(particleCount * 32)
        };
        const events = Array.from({ length: eventCount }, (_, index) => (
          makeProductEvent({
            position: [f32(0.1 + index * 0.1), 0.5, 0.5],
            massKg: f32((index + 1) / 128),
            currentVolumeM3: f32((index + 2) / 32768),
            velocityMPerS: [f32(index / 8), 0, 0]
          })
        ));
        const decisions = new Float32Array(eventCount * 4);
        for (let index = 0; index < eventCount; index += 1) {
          decisions.set([
            particleCount,
            3.0e38,
            1,
            index < availableSpareCount ? index : particleCount
          ], index * 4);
        }
        return {
          name: 'spare-exhaustion-prefix-assignment',
          eventCount,
          particleCount,
          productTermCount: 1,
          events: packProductEvents(events),
          decisions,
          destination,
          expectedSpareCount: availableSpareCount,
          expectedNoCarrierCount: eventCount - availableSpareCount,
          expectedRollback: true,
          expectedClassifierRejectedCount: 0,
          expectedRejectedCount: 0,
          expectedSpeculativeDestinationMutationCount: availableSpareCount
        };
      };
      const makeInvalidPayloadSpec = () => {
        const particleCount = 4;
        const destination = makeDestinationFamily({ particleCount });
        const invalidTerm = makeProductEvent({ productTermIndex: 9 });
        const invalidNan = makeProductEvent();
        invalidNan[13] = Number.NaN;
        const invalidInfinity = makeProductEvent();
        invalidInfinity[20] = Number.POSITIVE_INFINITY;
        const inconsistentMoles = makeProductEvent({ moles: 9 });
        const events = [
          invalidTerm,
          invalidNan,
          invalidInfinity,
          inconsistentMoles
        ];
        const decisions = new Float32Array(events.length * 4);
        for (let index = 0; index < events.length; index += 1) {
          decisions.set([0, 0, 1, particleCount], index * 4);
        }
        return {
          name: 'invalid-term-nan-infinity-terminal-rejection',
          eventCount: events.length,
          particleCount,
          productTermCount: 1,
          events: packProductEvents(events),
          decisions,
          destination,
          expectedRollback: true,
          expectedClassifierRejectedCount: events.length,
          expectedRejectedCount: events.length
        };
      };
      const makeFiniteMomentOverflowSpec = () => {
        const particleCount = 4;
        const destination = makeDestinationFamily({ particleCount });
        const events = [makeProductEvent({
          massKg: 1.0e20,
          restDensityKgPerM3: 1.0e23,
          currentVolumeM3: 1.0e-3,
          velocityMPerS: [1.0e20, 0, 0],
          specificInternalEnergyJPerKg: 1
        })];
        const decisions = new Float32Array([0, 0, 1, particleCount]);
        return {
          name: 'finite-input-moment-overflow-terminal-rejection',
          eventCount: 1,
          particleCount,
          productTermCount: 1,
          events: packProductEvents(events),
          decisions,
          destination,
          expectedRollback: true,
          expectedClassifierRejectedCount: 0,
          expectedRejectedCount: 1
        };
      };
      const makeDirectOverlapSpec = () => {
        const particleCount = 4;
        const destination = {
          state: new Float32Array(particleCount * 8),
          thermo: new Float32Array(particleCount * 12),
          mechanics: new Float32Array(particleCount * 32)
        };
        const positions = [0.3, 0.5, 0.7, 0.4];
        for (let index = 0; index < positions.length; index += 1) {
          destination.state.set([
            positions[index], 0.5, 0.5, 1,
            0, 0, 0, 10
          ], index * 8);
          destination.thermo.set([
            11, 3, 400, 1000,
            0, 0, 1, 0,
            0.05, 1, 1, 0.05
          ], index * 12);
          destination.mechanics.set([
            1, 0, 0, 0,
            1, 0, 0, 0,
            1, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 1, 0.001,
            0, 1, 100, 0,
            100, 10, 1, 1,
            0, 0, 0, 0
          ], index * 32);
        }
        const events = [
          makeProductEvent({
            massKg: 0.1,
            placedMassKg: 0.1,
            phaseId: 3,
            sourceParticleIndex: 0,
            partnerParticleIndex: 1,
            position: [0.4, 0.5, 0.5]
          }),
          makeProductEvent({
            massKg: 0.1,
            placedMassKg: 0.1,
            phaseId: 3,
            sourceParticleIndex: 0,
            partnerParticleIndex: 2,
            position: [0.5, 0.5, 0.5]
          }),
          makeProductEvent({
            massKg: 0.05,
            phaseId: 3,
            sourceParticleIndex: 1,
            partnerParticleIndex: 2,
            position: [0.6, 0.5, 0.5]
          })
        ];
        const decisions = new Float32Array(events.length * 4);
        decisions.set([particleCount, 3.0e38, 1, particleCount], 0);
        decisions.set([particleCount, 3.0e38, 1, particleCount], 4);
        decisions.set([3, 0, 1, particleCount], 8);
        return {
          name: 'capture-before-overlapping-direct-pair-arbitration',
          eventCount: events.length,
          particleCount,
          productTermCount: 1,
          events: packProductEvents(events),
          decisions,
          destination,
          expectedCaptureCount: 1,
          expectedDirectCount: 2,
          expectedDestinationMutationCount: 2
        };
      };

      const runReactionEntityCountProof = async () => {
        const { sphReactionStepWgsl } = await import(
          '/ulg-gpu-abi/src/wgsl.js'
        );
        const module = device.createShaderModule({
          label: 'ulg-native-reaction-entity-count-proof-shader',
          code: sphReactionStepWgsl
        });
        const compilation = await module.getCompilationInfo();
        const compilationErrors = compilation.messages
          .filter((message) => message.type === 'error')
          .map((message) => message.message);
        if (compilationErrors.length > 0) {
          return {
            status: 'shader-compilation-failed',
            compilationErrors
          };
        }
        const pipeline = device.createComputePipeline({
          label: 'ulg-native-reaction-entity-count-proof-resolve',
          layout: 'auto',
          compute: { module, entryPoint: 'resolve' }
        });
        const particleCount = 2;
        const packedParticleFloats = 13 * 4;
        const particles = new Float32Array(
          particleCount * packedParticleFloats
        );
        const writeParticle = ({
          index,
          position,
          massKg,
          materialId,
          representedEntityCount
        }) => {
          const base = index * packedParticleFloats;
          particles.set([
            ...position.map(f32), f32(massKg),
            0, 0, 0, 0,
            f32(materialId), 1, 300, 1,
            1, 0, 0, 0,
            0.05, f32(representedEntityCount), 1, 0.05,
            1, 0, 0, 0,
            1, 0, 0, 0,
            1, 0, 0, 0,
            0, 0, 0, 0,
            0, 0, 1, f32(massKg),
            1, 1, 100, 0,
            100, 10, 1, 1,
            0, 0, 0, 0
          ], base);
        };
        writeParticle({
          index: 0,
          position: [0.45, 0.5, 0.5],
          massKg: 2,
          materialId: 1,
          representedEntityCount: 2 * AVOGADRO_PER_MOL
        });
        writeParticle({
          index: 1,
          position: [0.55, 0.5, 0.5],
          massKg: 1,
          materialId: 2,
          representedEntityCount: AVOGADRO_PER_MOL
        });
        const reactionRecords = new Float32Array([
          // Legacy reaction row.
          1, 2, 3, 0,
          0, 1, 0, 0,
          1, 0, 0, 0,
          // Product material/phase mechanics.
          3, 2, 1, 100,
          0, 100, 10, 1,
          0, 1, 0, 0,
          // Extended reaction header.
          0, 0, 2, 0,
          1, 0, 0, 0,
          0, 1, 1, 3,
          0, 0, 1, 1,
          // Reactant A: 1 molar-mass unit, particle 0 has one unit left.
          0, 1, 1, 1,
          0, 1, 0, 1,
          1, 1, 1, 0,
          // Reactant B: wholly consumed.
          0, 2, 1, 1,
          0, 2, 0, 1,
          2, 2, 1, 0,
          // Product C: one product mole has mass 2.
          0, 3, 1, 2,
          1, 0, 2, 1,
          3, 3, 0, 0,
          1, 0, 0, 0
        ]);
        const phaseResponseRecords = new Float32Array([
          3, 0, 1, 1,
          0, 0, 0, 0
        ]);
        const phaseResponses = new Float32Array([
          3, 1, 0, 1,
          -1.0e6, 1.0e6, 2, 2,
          1, 1, 0, 0,
          0, 1, 0, 0
        ]);
        const thermalGraphNodes = new Float32Array([
          0, 0, 0, 0,
          0, 2, -1.0e6, 1.0e6,
          0, 0, 0, 0,
          0, 0, 0, 0
        ]);
        const thermalGraphSamples = new Float32Array([
          -1.0e6, 250, 0, 0,
          1.0e6, 350, 0, 0
        ]);
        const proposals = new Float32Array([
          1, 0, 1, 0.01,
          0, 0, 2, 0.01
        ]);
        const paramsBytes = new ArrayBuffer(48);
        const paramsWords = new Uint32Array(paramsBytes);
        const paramsFloats = new Float32Array(paramsBytes);
        paramsWords.set([
          particleCount,
          1,
          1,
          1,
          1,
          1,
          2,
          1,
          0
        ], 0);
        paramsFloats[9] = 0;
        paramsWords[10] = 1;
        paramsWords[11] = 0;

        const particleBuffer = createBuffer(
          'ulg-native-reaction-entity-count-source',
          particles
        );
        const reactionBuffer = createBuffer(
          'ulg-native-reaction-entity-count-table',
          reactionRecords
        );
        const phaseResponseRecordBuffer = createBuffer(
          'ulg-native-reaction-entity-count-phase-records',
          phaseResponseRecords
        );
        const phaseResponseBuffer = createBuffer(
          'ulg-native-reaction-entity-count-phase-responses',
          phaseResponses
        );
        const proposalBuffer = createBuffer(
          'ulg-native-reaction-entity-count-proposals',
          proposals
        );
        const outputBuffer = createBuffer(
          'ulg-native-reaction-entity-count-output',
          particles.byteLength
        );
        const paramsBuffer = createBuffer(
          'ulg-native-reaction-entity-count-params',
          new Uint8Array(paramsBytes),
          GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        const graphNodeBuffer = createBuffer(
          'ulg-native-reaction-entity-count-graph-nodes',
          thermalGraphNodes
        );
        const graphSampleBuffer = createBuffer(
          'ulg-native-reaction-entity-count-graph-samples',
          thermalGraphSamples
        );
        const bindGroup = device.createBindGroup({
          label: 'ulg-native-reaction-entity-count-proof-bind-group',
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: particleBuffer } },
            { binding: 3, resource: { buffer: reactionBuffer } },
            { binding: 5, resource: { buffer: phaseResponseRecordBuffer } },
            { binding: 6, resource: { buffer: phaseResponseBuffer } },
            { binding: 7, resource: { buffer: proposalBuffer } },
            { binding: 8, resource: { buffer: outputBuffer } },
            { binding: 11, resource: { buffer: paramsBuffer } },
            { binding: 12, resource: { buffer: graphNodeBuffer } },
            { binding: 13, resource: { buffer: graphSampleBuffer } }
          ]
        });
        const encoder = device.createCommandEncoder({
          label: 'ulg-native-reaction-entity-count-proof-encoder'
        });
        const pass = encoder.beginComputePass({
          label: 'ulg-native-reaction-entity-count-proof-pass'
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(1);
        pass.end();
        device.queue.submit([encoder.finish()]);
        const outputBytes = await readBuffer(
          outputBuffer,
          particles.byteLength,
          'ulg-native-reaction-entity-count-proof-readback'
        );
        const output = new Float32Array(outputBytes);
        const remainderBase = 0;
        const directBase = packedParticleFloats;
        const expectedRemainderEntities = f32Mul(
          f32(2 * AVOGADRO_PER_MOL),
          0.5
        );
        const expectedDirectEntities = f32Mul(
          f32(2 / 2),
          AVOGADRO_PER_MOL
        );
        const result = {
          status: 'complete',
          remainderMassKg: output[remainderBase + 3],
          remainderMaterialId: output[remainderBase + 8],
          remainderRepresentedEntityCount: output[remainderBase + 17],
          expectedRemainderRepresentedEntityCount: expectedRemainderEntities,
          directMassKg: output[directBase + 3],
          directMaterialId: output[directBase + 8],
          directRepresentedEntityCount: output[directBase + 17],
          expectedDirectRepresentedEntityCount: expectedDirectEntities,
          directVolumeRatioJ: output[directBase + 38],
          directRestVolumeM3: output[directBase + 39]
        };
        for (const buffer of [
          particleBuffer,
          reactionBuffer,
          phaseResponseRecordBuffer,
          phaseResponseBuffer,
          proposalBuffer,
          outputBuffer,
          paramsBuffer,
          graphNodeBuffer,
          graphSampleBuffer
        ]) {
          buffer.destroy();
        }
        return result;
      };

      const reactionEntityCountProof = await runReactionEntityCountProof();

      const summaryUrl = '/src/runtime/sph/sphReactionGpuSummary.js';
      const summarySource = await fetch(summaryUrl).then((response) => (
        response.text()
      ));
      const dependencyUrl = (sources, path) => {
        const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        for (const source of sources) {
          const match = source.match(new RegExp(
            `["']([^"']*${escaped}(?:\\?[^"']*)?)["']`
          ));
          if (match) return match[1];
        }
        throw new Error(`Vite dependency URL not found for ${path}`);
      };
      const placementUrl = dependencyUrl(
        [summarySource],
        '/schroederSpatialReactionProductPlacementGpu.js'
      );
      const placementSource = await fetch(placementUrl).then((response) => (
        response.text()
      ));
      const placementEpochUrl = dependencyUrl(
        [placementSource],
        '/schroederSpatialReactionPlacementEpochGpu.js'
      );
      const placementEpochSource = await fetch(placementEpochUrl).then(
        (response) => response.text()
      );
      const modules = await Promise.all([
        import(summaryUrl),
        import(placementUrl),
        import(placementEpochUrl),
        import(dependencyUrl(
          [placementEpochSource, placementSource, summarySource],
          '/sphGpuDeviceIdentity.js'
        )),
        import(dependencyUrl([summarySource], '/ulg-gpu-abi/src/index.js')),
        import(dependencyUrl([summarySource], '/ulg-gpu-abi/src/wgsl.js')),
        import(dependencyUrl([placementEpochSource], '/sphGpuBuffers.js')),
        import(dependencyUrl([placementEpochSource], '/schroederSpatialEpochGpu.js'))
      ]);
      const [
        summary,
        placement,
        placementEpoch,
        identity,
        abi,
        wgsl,
        gpuBuffers,
        spatial
      ] = modules;
      const legacyPlacementModule = device.createShaderModule({
        label: 'ulg-native-legacy-placement-entity-count-proof-shader',
        code: wgsl.sphReactionProductEventPlacementWgsl
      });
      const legacyPlacementCompilationErrors = (
        await legacyPlacementModule.getCompilationInfo()
      ).messages
        .filter((message) => message.type === 'error')
        .map((message) => message.message);
      const createTaggedBuffer = (label, values, usage) => (
        identity.tagWebGpuBufferDevice(
          createBuffer(label, values, usage),
          device
        )
      );
      const storageSeedModule = device.createShaderModule({
        label: 'ulg-native-placement-storage-seed',
        code: `
@group(0) @binding(0) var<storage, read> source_rows: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> destination_rows: array<vec4<f32>>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= arrayLength(&source_rows) || index >= arrayLength(&destination_rows)) {
    return;
  }
  destination_rows[index] = source_rows[index];
}
`
      });
      const storageSeedPipeline = device.createComputePipeline({
        label: 'ulg-native-placement-storage-seed',
        layout: 'auto',
        compute: { module: storageSeedModule, entryPoint: 'main' }
      });
      const encodeStorageSeed = ({ encoder, source, destination, rowCount }) => {
        const bindGroup = device.createBindGroup({
          label: 'ulg-native-placement-storage-seed-bind-group',
          layout: storageSeedPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: source } },
            { binding: 1, resource: { buffer: destination } }
          ]
        });
        const pass = encoder.beginComputePass({
          label: 'ulg-native-placement-storage-seed'
        });
        pass.setPipeline(storageSeedPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.max(1, Math.ceil(rowCount / 64)));
        pass.end();
      };
      const makeManufacturedReceiptSeed = ({
        eventCapacity,
        particleCount,
        activeEventCount,
        classifierReadyCount = activeEventCount,
        classifierRejectedCount = 0,
        captureHitCount = 0,
        spareAvailableCount = 0,
        spareAssignedCount = 0,
        privateLookupBuildCount = 0,
        transactionalCommittedParticleCountSeed = 0
      }) => {
        const words = new Uint32Array(
          abi.SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS
        );
        const index = abi.SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX;
        words[index.compactCountPassCount] = 1;
        words[index.compactScanPassCount] = 1;
        words[index.compactScatterPassCount] = 1;
        words[index.activeEventCount] = activeEventCount;
        words[index.compactionInputVisitCount] = eventCapacity;
        words[index.compactionLiveFlagCount] = activeEventCount;
        words[index.envelopePartialPassCount] = 1;
        words[index.envelopeFinalizePassCount] = 1;
        words[index.envelopeInputVisitCount] = particleCount;
        words[index.envelopeAdmitted] = 1;
        words[index.classifierPassCount] = 1;
        words[index.classifierReadyCount] = classifierReadyCount;
        words[index.classifierRejectedCount] = classifierRejectedCount;
        words[index.ssCellVisitCount] = classifierReadyCount > 0 ? 1 : 0;
        words[index.ssMemberVisitCount] = classifierReadyCount;
        words[index.ssMaterialPhaseFilterCount] = classifierReadyCount;
        words[index.ssCaptureHitCount] = captureHitCount;
        words[index.spareFlagPassCount] = 2;
        words[index.spareScanPassCount] = 2;
        words[index.spareAssignPassCount] = 2;
        words[index.spareCandidateVisitCount] = particleCount;
        words[index.spareAvailableCount] = spareAvailableCount;
        words[index.spareAssignedCount] = spareAssignedCount;
        words[index.privateLookupBuildCount] = privateLookupBuildCount;
        words[index.transactionalCommittedParticleCount] =
          transactionalCommittedParticleCountSeed;
        return words;
      };
      const createAuthenticPlacementAuthority = async ({
        productEventCapacity,
        destination = makeDestinationFamily({ particleCount: 4 })
      }) => {
        const particleCount = destination.state.length / 8;
        if (
          !Number.isInteger(particleCount)
          || particleCount < 1
          || destination.thermo.length !== particleCount * 12
          || destination.mechanics.length !== particleCount * 32
        ) {
          throw new TypeError('native placement destination family is misaligned');
        }
        const state = destination.state;
        const thermo = destination.thermo;
        const mechanics = destination.mechanics;
        const identityValues = new Uint32Array(particleCount).fill(1);
        const sphParticleState = {
          schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          status: 'cpu-derived-gpu-buffer-ready',
          particleCount,
          dimension: 3,
          step: 19,
          time: 0.19,
          physicsSubstep: 0,
          positionEpoch: 12,
          topologyEpoch: 5,
          chartEpoch: 2,
          levelEpoch: 9,
          supportEpoch: 10,
          storageGeneration: 7,
          smoothingLengthM: 0.1,
          stateStrideFloats: 8,
          thermoStrideFloats: 12,
          identityStrideUints: 1,
          stateStrideBytes: 32,
          thermoStrideBytes: 48,
          identityStrideBytes: 4,
          identityRequired: true,
          identityRevision: 'native-segmented-placement',
          renderDomainKeys: { 1: 'native-segmented-placement' },
          state,
          thermo,
          identity: identityValues,
          metadata: []
        };
        const mlsMpmParticleState = {
          schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          status: 'cpu-derived-gpu-buffer-ready',
          particleCount,
          step: sphParticleState.step,
          time: sphParticleState.time,
          physicsSubstep: sphParticleState.physicsSubstep,
          storageGeneration: sphParticleState.storageGeneration,
          mechanicsStrideFloats: 32,
          mechanicsStrideBytes: 128,
          mechanicsDtS: 0,
          mechanicalSubsteps: 1,
          gridCflFactor: 0.4,
          gravityMPerS2: [0, 0, 0],
          particleSeparationRelaxation: 0,
          particleSeparationVelocityDamping: 0,
          mechanics,
          metadata: [],
          algorithmMaterialContactRows: null
        };
        const sphParticleUpload = gpuBuffers.uploadSphGpuParticleBuffers(
          device,
          sphParticleState
        );
        const mlsMpmParticleUpload = gpuBuffers.uploadMlsMpmGpuParticleBuffers(
          device,
          mlsMpmParticleState
        );
        sphParticleUpload.slot = 0;
        mlsMpmParticleUpload.slot = 0;
        const activeRows = new Float32Array(particleCount * 16);
        for (let index = 0; index < particleCount; index += 1) {
          const stateBase = index * 8;
          activeRows.set([
            0, 0, 0, 0,
            0, 0, 0, 0,
            0.1, 0.2, index, 1,
            state[stateBase], state[stateBase + 1], state[stateBase + 2], 3
          ], index * 16);
        }
        const activeNodeBuffer = createTaggedBuffer(
          'ulg-native-placement-ancestor-active-nodes',
          activeRows,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        const activeNodeList = {
          schema: 'peercompute.ulg.schroeder-active-node-list-execution.v0',
          status: 'schroeder-active-node-list-submitted',
          particleCount,
          activeCandidateCount: particleCount,
          activeNodeStrideFloats: 16,
          activeNodeBuffer,
          sourceStateBuffer: sphParticleUpload.stateBuffer,
          phaseVolumeAssignmentOverlayEnabled: false,
          spatialDirectorySourceSchema:
            'peercompute.ulg.schroeder-spatial-directory-active-node-source.v1',
          spatialDirectorySourceStatus:
            'schroeder-spatial-directory-source-ready',
          spatialDirectorySourceReady: true,
          spatialEpochSourceSchema:
            'peercompute.ulg.schroeder-spatial-active-node-source.v1',
          spatialEpochSourceStatus:
            'schroeder-spatial-active-node-source-ready',
          spatialEpochSourceReady: true,
          spatialEpochLevelSpacingMode:
            'base-grid-spacing-times-pow2-level',
          spatialEpochPositionAuthority:
            'same-epoch-pre-integration-particle-state',
          spatialEpochMinLevel: -1,
          spatialEpochMaxLevel: 2,
          spatialEpochBaseGridSpacingM: 0.1,
          spatialEpochChartId: 3,
          spatialEpochStorageGeneration: sphParticleState.storageGeneration,
          spatialEpochPhysicsTick: sphParticleState.step,
          spatialEpochPhysicsSubstep: sphParticleState.physicsSubstep,
          spatialEpochPositionEpoch: sphParticleState.positionEpoch,
          spatialEpochTopologyEpoch: sphParticleState.topologyEpoch,
          spatialEpochChartEpoch: sphParticleState.chartEpoch,
          spatialEpochLevelEpoch: sphParticleState.levelEpoch,
          spatialEpochSupportEpoch: sphParticleState.supportEpoch
        };
        const ancestor = spatial.runSchroederSpatialEpochGenerationWebGpu({
          device,
          activeNodeList,
          particleCount,
          particleIdentityBuffer: sphParticleUpload.identityBuffer,
          particleIdentityStrideWords: 1,
          laneId: 'native-segmented-placement-ancestor',
          sourceFamily: 'native-segmented-placement-ancestor',
          mechanicsLevels: []
        });
        const sourceUsage = GPUBufferUsage.STORAGE
          | GPUBufferUsage.COPY_SRC
          | GPUBufferUsage.COPY_DST;
        const frozenState = createTaggedBuffer(
          'ulg-native-placement-frozen-state',
          state,
          sourceUsage
        );
        const frozenThermo = createTaggedBuffer(
          'ulg-native-placement-frozen-thermo',
          thermo,
          sourceUsage
        );
        const frozenMechanics = createTaggedBuffer(
          'ulg-native-placement-frozen-mechanics',
          mechanics,
          sourceUsage
        );
        const positionInvariantCertificate =
          placementEpoch.createSphReactionResolvePositionInvariantCertificate({
            device,
            ancestorGeneration: ancestor,
            reactionInputStateBuffer: sphParticleUpload.stateBuffer,
            frozenResolvedStateBuffer: frozenState,
            particleCount
          });
        const placementSourceFamily =
          await placementEpoch.runSchroederSpatialReactionPlacementEpochWebGpu({
            device,
            ancestorPublicGeneration: ancestor,
            sphParticleState,
            mlsMpmParticleState,
            sphParticleUpload,
            frozenSourceStateBuffer: frozenState,
            frozenSourceThermoBuffer: frozenThermo,
            frozenSourceMechanicsBuffer: frozenMechanics,
            positionInvariantCertificate
          });
        const authority =
          placement.createSchroederSpatialReactionProductPlacementAuthorityWebGpu({
            device,
            placementSourceFamily,
            particleCount,
            productEventCapacity,
            sourceStateBuffer: sphParticleUpload.stateBuffer,
            sourceThermoBuffer: sphParticleUpload.thermoBuffer
          });
        return {
          authority,
          ancestor,
          activeNodeList,
          placementSourceFamily,
          sphParticleUpload,
          mlsMpmParticleUpload,
          frozenState,
          frozenThermo,
          frozenMechanics
        };
      };
      const adapterInfo = typeof adapter.info === 'object'
        ? {
            vendor: adapter.info.vendor || null,
            architecture: adapter.info.architecture || null,
            device: adapter.info.device || null,
            description: adapter.info.description || null
          }
        : null;

      // Keep all production modules on the same runtime device identity. This
      // is also a smoke check that the Vite graph did not fork WeakMap brands.
      const smokeBuffer = identity.tagWebGpuBufferDevice(device.createBuffer({
        label: 'ulg-native-placement-module-identity-smoke',
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      }), device);
      const moduleIdentityShared = identity.webGpuBufferMatchesDevice(
        smokeBuffer,
        device
      );
      smokeBuffer.destroy();

      const EVENT_CAPACITY = 65_536;
      const ARENA_LABEL_PREFIX =
        'ulg-sph-reaction-placement-segmented-arena-';
      const decodeReceipt = (bytes) => {
        const words = new Uint32Array(bytes);
        return {
          words,
          decoded: Object.fromEntries(
            abi.SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_LAYOUT.map(
              (field, index) => [
                field.slice(0, field.indexOf(':')),
                words[index]
              ]
            )
          )
        };
      };
      const fnv1a = (bytes) => {
        const view = bytes instanceof Uint8Array
          ? bytes
          : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let hash = 0x811c9dc5;
        for (let index = 0; index < view.length; index += 1) {
          hash = Math.imul(hash ^ view[index], 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, '0');
      };
      const normalizedReceiptHash = (words) => {
        const normalized = words.slice();
        normalized[
          abi.SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX.generationId
        ] = 0;
        return fnv1a(new Uint8Array(normalized.buffer));
      };
      const near = (actual, expected, absolute = 5.0e-6) => (
        Number.isFinite(actual)
        && Number.isFinite(expected)
        && Math.abs(actual - expected)
          <= Math.max(absolute, Math.abs(expected) * 2.0e-5)
      );
      const arraysNear = (actual, expected, absolute) => {
        if (actual.length !== expected.length) return false;
        for (let index = 0; index < actual.length; index += 1) {
          if (!near(actual[index], expected[index], absolute)) return false;
        }
        return true;
      };
      const arraysByteEqual = (actual, expected) => {
        if (actual.byteLength !== expected.byteLength) return false;
        const actualBytes = new Uint8Array(
          actual.buffer,
          actual.byteOffset,
          actual.byteLength
        );
        const expectedBytes = new Uint8Array(
          expected.buffer,
          expected.byteOffset,
          expected.byteLength
        );
        for (let index = 0; index < actualBytes.length; index += 1) {
          if (actualBytes[index] !== expectedBytes[index]) return false;
        }
        return true;
      };
      const particleMass = (state) => {
        let total = 0;
        for (let index = 3; index < state.length; index += 8) {
          total += Number(state[index]);
        }
        return total;
      };
      const unplacedMass = (events) => {
        let total = 0;
        for (let index = 13; index < events.length; index += 32) {
          const value = Number(events[index]);
          if (Number.isFinite(value)) total += value;
        }
        return total;
      };
      const particleRepresentedEntityCount = (thermo) => {
        let total = 0;
        for (let index = 9; index < thermo.length; index += 12) {
          const value = Number(thermo[index]);
          if (Number.isFinite(value)) total += value;
        }
        return total;
      };
      const liveEventRepresentedEntityCount = (events) => {
        let total = 0;
        for (let base = 0; base < events.length; base += 32) {
          const mass = Number(events[base + 13]);
          const molarMass = Number(events[base + 15]);
          if (!(mass > 0) || !(molarMass > 0)) continue;
          total += mass / molarMass * AVOGADRO_PER_MOL;
        }
        return total;
      };
      const particleCurrentVolume = (state, mechanics) => {
        let total = 0;
        const particleCount = Math.min(
          Math.floor(state.length / 8),
          Math.floor(mechanics.length / 32)
        );
        for (let index = 0; index < particleCount; index += 1) {
          if (!(state[index * 8 + 3] > 0)) continue;
          const volume = Number(mechanics[index * 32 + 18])
            * Number(mechanics[index * 32 + 19]);
          if (Number.isFinite(volume) && volume > 0) total += volume;
        }
        return total;
      };
      const liveEventReferenceVolume = (events) => {
        let total = 0;
        for (let base = 0; base < events.length; base += 32) {
          const mass = Number(events[base + 13]);
          const restDensity = Number(events[base + 17]);
          if (!(mass > 0) || !(restDensity > 0)) continue;
          const volume = mass / restDensity;
          if (Number.isFinite(volume) && volume > 0) total += volume;
        }
        return total;
      };
      const particleMomentum = (state) => {
        const momentum = [0, 0, 0];
        for (let base = 0; base < state.length; base += 8) {
          const mass = Number(state[base + 3]);
          if (!(mass > 0)) continue;
          for (let axis = 0; axis < 3; axis += 1) {
            momentum[axis] += mass * Number(state[base + 4 + axis]);
          }
        }
        return momentum;
      };
      const liveEventMomentum = (events) => {
        const momentum = [0, 0, 0];
        for (let base = 0; base < events.length; base += 32) {
          const mass = Number(events[base + 13]);
          if (!(mass > 0)) continue;
          for (let axis = 0; axis < 3; axis += 1) {
            momentum[axis] += mass * Number(events[base + 20 + axis]);
          }
        }
        return momentum;
      };
      const particleTotalEnergy = (state) => {
        let total = 0;
        for (let base = 0; base < state.length; base += 8) {
          const mass = Number(state[base + 3]);
          if (!(mass > 0)) continue;
          const speedSquared =
            Number(state[base + 4]) ** 2
            + Number(state[base + 5]) ** 2
            + Number(state[base + 6]) ** 2;
          total += mass * (Number(state[base + 7]) + 0.5 * speedSquared);
        }
        return total;
      };
      const liveEventTotalEnergy = (events) => {
        let total = 0;
        for (let base = 0; base < events.length; base += 32) {
          const mass = Number(events[base + 13]);
          if (!(mass > 0)) continue;
          const speedSquared =
            Number(events[base + 20]) ** 2
            + Number(events[base + 21]) ** 2
            + Number(events[base + 22]) ** 2;
          total += mass * (
            Number(events[base + 19])
            + 0.5 * speedSquared
          );
        }
        return total;
      };
      const deformationDeterminant = (mechanics, particleIndex) => {
        const base = particleIndex * 32;
        const a = mechanics[base];
        const b = mechanics[base + 1];
        const c = mechanics[base + 2];
        const d = mechanics[base + 3];
        const e = mechanics[base + 4];
        const f = mechanics[base + 5];
        const g = mechanics[base + 6];
        const h = mechanics[base + 7];
        const i = mechanics[base + 8];
        return a * (e * i - f * h)
          - b * (d * i - f * g)
          + c * (d * h - e * g);
      };
      const browserNearestRank = (values, quantile) => {
        const sorted = [...values].sort((left, right) => left - right);
        const rank = Math.max(1, Math.ceil(sorted.length * quantile));
        return sorted[Math.min(sorted.length - 1, rank - 1)];
      };
      const receiptCommonValid = (receipt, spec, diagnostic) => (
        receipt.eventCapacity === EVENT_CAPACITY
        && receipt.activeEventCount === spec.eventCount
        && receipt.compactionInputVisitCount === EVENT_CAPACITY
        && receipt.compactionLiveFlagCount === spec.eventCount
        && receipt.applyPassCount === 1
        && receipt.applyVisitedCount === spec.eventCount
        && receipt.applyPreflightPassCount === 1
        && receipt.intentEmitPassCount === 1
        && receipt.mutationIntentCapacity === EVENT_CAPACITY * 2
        && receipt.destinationRadixPassCount === 24
        && receipt.destinationSegmentReducePassCount === 32
        && receipt.destinationApplyPassCount === 2
        && receipt.destinationIntentVisitedCount === EVENT_CAPACITY * 2
        && receipt.summaryRadixPassCount === 8
        && receipt.summarySegmentReducePassCount === 16
        && receipt.summaryApplyPassCount === 1
        && receipt.summaryContributionCount === spec.eventCount
        && receipt.globalSerialEventFoldCount === 0
        && receipt.serialConflictFoldPassCount === 0
        && receipt.serialConflictFoldEventCount === 0
        && receipt.fallbackEventCount === 0
        && receipt.unknownDispositionCount === 0
        && receipt.status === (
          spec.expectedRollback === true ? 3 : 1
        )
        && receipt.transactionalTerminalStatus === (
          spec.expectedRollback === true ? 2 : 1
        )
        && receipt.hostCompletionReadbackCount === (diagnostic ? 1 : 0)
      );
      const verifyOutput = (spec, output) => {
        const { state, thermo, mechanics, events, receipt } = output;
        let cpuOracleParity = receiptCommonValid(
          receipt,
          spec,
          output.diagnostic
        );
        let conserved = true;
        const initialMass = particleMass(spec.destination.state)
          + unplacedMass(spec.events);
        const finalMass = particleMass(state) + unplacedMass(events);
        const initialRepresentedEntityCount =
          particleRepresentedEntityCount(spec.destination.thermo)
          + liveEventRepresentedEntityCount(spec.events);
        const finalRepresentedEntityCount =
          particleRepresentedEntityCount(thermo)
          + liveEventRepresentedEntityCount(events);
        const initialParticleCurrentVolume = particleCurrentVolume(
          spec.destination.state,
          spec.destination.mechanics
        );
        const finalParticleCurrentVolume = particleCurrentVolume(
          state,
          mechanics
        );
        const materializedReferenceVolume =
          liveEventReferenceVolume(spec.events)
          - liveEventReferenceVolume(events);
        const referenceBirthVolumeConsistent = near(
          finalParticleCurrentVolume,
          initialParticleCurrentVolume + materializedReferenceVolume,
          2.0e-5
        );
        const initialParticleMomentum = particleMomentum(
          spec.destination.state
        );
        const initialEventMomentum = liveEventMomentum(spec.events);
        const finalParticleMomentum = particleMomentum(state);
        const finalEventMomentum = liveEventMomentum(events);
        const initialMomentum = initialParticleMomentum.map(
          (value, axis) => value + initialEventMomentum[axis]
        );
        const finalMomentum = finalParticleMomentum.map(
          (value, axis) => value + finalEventMomentum[axis]
        );
        const initialTotalEnergy =
          particleTotalEnergy(spec.destination.state)
          + liveEventTotalEnergy(spec.events);
        const finalTotalEnergy =
          particleTotalEnergy(state)
          + liveEventTotalEnergy(events);

        if (spec.oracle) {
          cpuOracleParity = cpuOracleParity
            && arraysNear(state, spec.oracle.state)
            && arraysNear(thermo, spec.oracle.thermo)
            && arraysNear(mechanics, spec.oracle.mechanics)
            && arraysNear(events, spec.oracle.productEvents)
            && receipt.captureMergeEventCount === spec.eventCount
            && receipt.ssCaptureHitCount === spec.eventCount
            && receipt.destinationMutationCount === (spec.eventCount > 0 ? 1 : 0)
            && receipt.maxDestinationSegmentSize === spec.eventCount;
          conserved = near(finalMass, initialMass, 2.0e-3)
            && referenceBirthVolumeConsistent
            && near(
              deformationDeterminant(mechanics, 0),
              mechanics[18],
              2.0e-5
            );
        } else if (spec.expectedRollback === true) {
          const expectedDestinationMutationCount =
            spec.expectedSpeculativeDestinationMutationCount ?? 0;
          cpuOracleParity = cpuOracleParity
            && receipt.classifierRejectedCount
              === spec.expectedClassifierRejectedCount
            && receipt.rejectedEventCount === spec.expectedRejectedCount
            && receipt.destinationMutationCount
              === expectedDestinationMutationCount
            && (
              spec.expectedSpareCount == null
              || (
                receipt.sparePlacementEventCount === spec.expectedSpareCount
                && receipt.spareAssignedCount === spec.expectedSpareCount
                && receipt.noCarrierEventCount === spec.expectedNoCarrierCount
              )
            )
            && fnv1a(new Uint8Array(state.buffer))
              === fnv1a(new Uint8Array(spec.destination.state.buffer))
            && fnv1a(new Uint8Array(thermo.buffer))
              === fnv1a(new Uint8Array(spec.destination.thermo.buffer))
            && fnv1a(new Uint8Array(mechanics.buffer))
              === fnv1a(new Uint8Array(spec.destination.mechanics.buffer))
            && arraysByteEqual(events, spec.events);
          conserved = near(finalMass, initialMass, 5.0e-6)
            && referenceBirthVolumeConsistent;
        } else if (spec.expectedSpareCount != null) {
          const dispositions = Array.from(
            { length: spec.eventCount },
            (_, index) => events[index * 32 + 31]
          );
          cpuOracleParity = cpuOracleParity
            && receipt.sparePlacementEventCount === spec.expectedSpareCount
            && receipt.spareAssignedCount === spec.expectedSpareCount
            && receipt.noCarrierEventCount === spec.expectedNoCarrierCount
            && receipt.destinationMutationCount === spec.expectedSpareCount
            && dispositions.every((value, index) => (
              value === (index < spec.expectedSpareCount ? 3 : 7)
            ));
          for (let index = 0; index < spec.expectedSpareCount; index += 1) {
            const restVolume = mechanics[index * 32 + 19];
            const deformationJ = mechanics[index * 32 + 18];
            cpuOracleParity = cpuOracleParity
              && near(state[index * 8 + 3], spec.events[index * 32 + 13])
              && events[index * 32 + 13] === 0
              && near(
                restVolume,
                state[index * 8 + 3] / spec.events[index * 32 + 17]
              )
              && near(
                restVolume * deformationJ,
                restVolume
              )
              && near(deformationJ, 1)
              && near(
                deformationDeterminant(mechanics, index),
                deformationJ
              )
              && near(
                thermo[index * 12 + 9],
                spec.events[index * 32 + 13]
                  / spec.events[index * 32 + 15]
                  * AVOGADRO_PER_MOL
              );
          }
          conserved = near(finalMass, initialMass, 5.0e-6)
            && referenceBirthVolumeConsistent;
        } else {
          const dispositions = Array.from(
            { length: spec.eventCount },
            (_, index) => events[index * 32 + 31]
          );
          cpuOracleParity = cpuOracleParity
            && receipt.captureMergeEventCount === spec.expectedCaptureCount
            && receipt.directOnlyEventCount === spec.expectedDirectCount
            && receipt.destinationMutationCount
              === spec.expectedDestinationMutationCount
            && receipt.mutationConflictRetryCount === 1
            && dispositions[0] === 2
            && dispositions[1] === 2
            && dispositions[2] === 4
            && near(state[3 * 8 + 3], 1.05)
            && near(state[2 * 8], 0.7)
            && Array.from(state).every(Number.isFinite)
            && Array.from(thermo).every(Number.isFinite)
            && Array.from(mechanics).every(Number.isFinite);
          conserved = near(finalMass, initialMass, 5.0e-6)
            && referenceBirthVolumeConsistent;
        }
        if (spec.expectedRollback !== true) {
          conserved = conserved
            && near(
              finalRepresentedEntityCount,
              initialRepresentedEntityCount,
              1.0e16
            )
            && initialMomentum.every(
              (value, axis) => near(finalMomentum[axis], value, 2.0e-3)
            )
            && near(finalTotalEnergy, initialTotalEnergy, 2.0e-2);
        }
        return {
          cpuOracleParity,
          conserved,
          conservation: {
            initialRepresentedEntityCount,
            finalRepresentedEntityCount,
            initialMomentum,
            finalMomentum,
            initialTotalEnergy,
            finalTotalEnergy
          }
        };
      };

      let retainedArena = null;
      let firstArenaBufferCreationCount = null;
      let bufferCreatesAfterWarmup = 0;
      let diagnosticReadbackBufferCreatesAfterWarmup = 0;
      let backpressureCode = null;
      let backpressureChecked = false;
      let diagnosticObservationBackpressureCode = null;
      let diagnosticObservationBackpressureMessage = null;
      let diagnosticObservationRetryFenceAbsent = null;
      let diagnosticObservationGateDeferredUntilRelease = null;
      let runOrdinal = 0;
      let placementSubmitCount = 0;
      let placementFenceCount = 0;
      const runManufacturedCase = async (spec, {
        diagnostic = false,
        injectDiagnosticMapFailure = false,
        trackWarmArena = true,
        timestamp = false,
        retainFullEvents = true,
        publishedSummarySeed = null,
        receiptPrivateLookupBuildCount = 0,
        transactionalCommittedParticleCountSeed = 0,
        skipPositionFloor = false
      } = {}) => {
        runOrdinal += 1;
        const paddedEvents = new Float32Array(EVENT_CAPACITY * 32);
        paddedEvents.set(spec.events);
        const paddedDecisions = new Float32Array(EVENT_CAPACITY * 4);
        paddedDecisions.set(spec.decisions);
        const authentic = await createAuthenticPlacementAuthority({
          productEventCapacity: EVENT_CAPACITY,
          destination: spec.destination
        });
        const arenaLabelsBefore = instrumentation.createdBufferLabels.filter(
          (label) => label.startsWith(ARENA_LABEL_PREFIX)
        ).length;
        const arenaLease =
          placement.acquireSphReactionProductPlacementSegmentedArenaWebGpu({
            device,
            authority: authentic.authority,
            particleCapacity: spec.particleCount,
            eventCapacity: EVENT_CAPACITY,
            productTermCapacity: spec.productTermCount,
            eventStrideVec4: 8,
            diagnosticReadbackRequested: diagnostic
          });
        const arenaLabelsAfter = instrumentation.createdBufferLabels.filter(
          (label) => label.startsWith(ARENA_LABEL_PREFIX)
        ).length;
        const arenaCreatesThisAcquire = arenaLabelsAfter - arenaLabelsBefore;
        if (trackWarmArena) {
          if (retainedArena === null) {
            retainedArena = arenaLease.arena;
            firstArenaBufferCreationCount = arenaLease.bufferCreationCount;
          } else {
            if (arenaLease.arena !== retainedArena) {
              throw new Error('segmented placement arena identity was not reused');
            }
            if (diagnostic) {
              diagnosticReadbackBufferCreatesAfterWarmup += arenaCreatesThisAcquire;
              if (
                arenaLease.diagnosticReadbackBufferCreationCount
                  !== arenaCreatesThisAcquire
                || arenaLease.completionReadbackBuffer == null
              ) {
                throw new Error('diagnostic placement acquisition did not create its exact lazy readback');
              }
            } else {
              bufferCreatesAfterWarmup += arenaCreatesThisAcquire;
              if (!arenaLease.warmReuse || arenaLease.bufferCreationCount !== 0) {
                throw new Error('warm placement arena reported a cold acquisition');
              }
            }
          }
        }
        if (!backpressureChecked) {
          backpressureChecked = true;
          try {
            placement.acquireSphReactionProductPlacementSegmentedArenaWebGpu({
              device,
              authority: authentic.authority,
              particleCapacity: spec.particleCount,
              eventCapacity: EVENT_CAPACITY,
              productTermCapacity: spec.productTermCount,
              eventStrideVec4: 8
            });
          } catch (error) {
            backpressureCode = error?.code || String(error);
          }
          if (!String(backpressureCode).endsWith('ARENA_BACKPRESSURE')) {
            throw new Error(`arena backpressure failed closed as ${backpressureCode}`);
          }
        }

        const labelBase = `ulg-native-placement-run-${runOrdinal}`;
        const eventBuffer = createTaggedBuffer(
          `${labelBase}-product-events`,
          paddedEvents,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST
        );
        const summaryBuffer = createTaggedBuffer(
          `${labelBase}-summary`,
          publishedSummarySeed
            ?? spec.productTermCount * 32 * Float32Array.BYTES_PER_ELEMENT,
          GPUBufferUsage.STORAGE
            | GPUBufferUsage.COPY_SRC
            | GPUBufferUsage.COPY_DST
        );
        const decisionSource = createTaggedBuffer(
          `${labelBase}-decision-source`,
          paddedDecisions,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        device.queue.writeBuffer(
          arenaLease.arena.buffers.compactCount,
          0,
          new Uint32Array([spec.eventCount])
        );
        const captureHitCount = spec.oracle
          ? spec.eventCount
          : (spec.expectedCaptureCount ?? 0);
        const classifierRejectedCount =
          spec.expectedClassifierRejectedCount ?? 0;
        const classifierReadyCount =
          spec.eventCount - classifierRejectedCount;
        device.queue.writeBuffer(
          authentic.authority.completionReceiptBuffer,
          0,
          makeManufacturedReceiptSeed({
            eventCapacity: EVENT_CAPACITY,
            particleCount: spec.particleCount,
            activeEventCount: spec.eventCount,
            classifierReadyCount,
            classifierRejectedCount,
            captureHitCount,
            spareAvailableCount: spec.expectedSpareCount ?? 0,
            spareAssignedCount: spec.expectedSpareCount ?? 0,
            privateLookupBuildCount: receiptPrivateLookupBuildCount,
            transactionalCommittedParticleCountSeed
          })
        );
        const timestampRecorder = timestamp ? createTimestampRecorder(4096) : null;
        const encoder = device.createCommandEncoder({
          label: `${labelBase}-production-encoder`
        });
        encodeStorageSeed({
          encoder,
          source: decisionSource,
          destination: arenaLease.arena.buffers.decisions,
          rowCount: EVENT_CAPACITY
        });
        const chainTimestamp = timestampRecorder?.recorder.beginEncoderSpan(
          encoder,
          {
            producerId: 'native-slice8-verification',
            stage: 'segmented-placement-exact-chain',
            spanClass: 'same-production-command-encoder-profiled-chain'
          }
        ) ?? null;
        const segmented =
          placement.encodeSphReactionProductPlacementSegmentedWebGpu({
            device,
            encoder,
            authority: authentic.authority,
            arenaLease,
            productEventBuffer: eventBuffer,
            nextStateBuffer:
              authentic.authority.placedDestinationStateBuffer,
            nextThermoBuffer:
              authentic.authority.placedDestinationThermoBuffer,
            nextMechanicsBuffer:
              authentic.authority.placedDestinationMechanicsBuffer,
            placementSummaryBuffer: summaryBuffer,
            productTermCount: spec.productTermCount,
            boxDimsM: [1, 1, 1],
            gpuTimestampRecorder: timestampRecorder?.recorder ?? null,
            diagnosticReadbackRequested: diagnostic
          });
        if (chainTimestamp) {
          timestampRecorder.recorder.endEncoderSpan(encoder, chainTimestamp);
        }
        const sealed =
          placement.sealSchroederSpatialReactionProductPlacementEncoding(
            authentic.authority,
            {
              segmentedEncoding: segmented,
              completionReadbackBuffer: diagnostic
                ? arenaLease.completionReadbackBuffer
                : null
            }
          );
        const submission =
          placement.submitSchroederSpatialReactionProductPlacementWebGpu({
            authority: authentic.authority,
            encoding: sealed
          });
        placementSubmitCount += 1;
        const artifactAuthentic = placement
          .isSubmittedSchroederSpatialReactionProductPlacementArtifact(
            submission
          );
        const releaseArena = () => (
          placement.releaseSphReactionProductPlacementSegmentedArenaAfterQueue(
            arenaLease,
            {
              device,
              authority: authentic.authority,
              submissionArtifact: submission
            }
          )
        );
        let arenaRelease = diagnostic ? null : releaseArena();
        await submission.queueFence;
        let arenaReleaseConfirmed = null;
        placementFenceCount += 1;
        let timestampMs = null;
        let timestampSpans = [];
        if (timestampRecorder) {
          timestampSpans = await timestampRecorder.complete();
          const chainSpan = timestampSpans.find(
            (span) => span.stage === 'segmented-placement-exact-chain'
          );
          timestampMs = chainSpan?.durationMs ?? null;
          timestampRecorder.destroy();
        }
        let completionObservation = null;
        let finalizedPlacement = null;
        let diagnosticObservationError = null;
        let diagnosticFailureRecovery = null;
        if (diagnostic) {
          if (!injectDiagnosticMapFailure) {
            diagnosticObservationGateDeferredUntilRelease = placement
              .sphReactionProductPlacementSegmentedArenaStats(arenaLease.arena)
              ?.diagnosticObservationPending !== true;
            try {
              placement.acquireSphReactionProductPlacementSegmentedArenaWebGpu({
                device,
                authority: authentic.authority,
                particleCapacity: spec.particleCount,
                eventCapacity: EVENT_CAPACITY,
                productTermCapacity: spec.productTermCount,
                eventStrideVec4: 8
              });
            } catch (error) {
              diagnosticObservationBackpressureCode = error?.code || String(error);
              diagnosticObservationBackpressureMessage =
                error?.message || String(error);
              diagnosticObservationRetryFenceAbsent =
                error?.retryAfterFence == null;
            }
            if (
              !String(diagnosticObservationBackpressureCode)
                .endsWith('ARENA_BACKPRESSURE')
              || diagnosticObservationRetryFenceAbsent !== true
            ) {
              throw new Error(
                `diagnostic readback did not hold the arena until observation: ${JSON.stringify({
                  diagnosticObservationGateDeferredUntilRelease,
                  diagnosticObservationBackpressureCode,
                  diagnosticObservationBackpressureMessage,
                  diagnosticObservationRetryFenceAbsent
                })}`
              );
            }
          }
          if (injectDiagnosticMapFailure) {
            const readback = arenaLease.completionReadbackBuffer;
            const ownMapAsyncDescriptor = Object.getOwnPropertyDescriptor(
              readback,
              'mapAsync'
            );
            try {
              Object.defineProperty(readback, 'mapAsync', {
                configurable: true,
                value: () => Promise.reject(
                  new Error('injected diagnostic placement mapAsync failure')
                )
              });
              try {
                await placement
                  .observeSchroederSpatialReactionProductPlacementCompletion(
                    authentic.authority,
                    { submissionArtifact: submission }
                  );
              } catch (error) {
                diagnosticObservationError =
                  error instanceof Error ? error.message : String(error);
              }
            } finally {
              if (ownMapAsyncDescriptor) {
                Object.defineProperty(
                  readback,
                  'mapAsync',
                  ownMapAsyncDescriptor
                );
              } else {
                delete readback.mapAsync;
              }
            }
            if (
              !diagnosticObservationError?.includes(
                'injected diagnostic placement mapAsync failure'
              )
            ) {
              throw new Error(
                `diagnostic mapAsync failure injection was not observed: ${diagnosticObservationError}`
              );
            }
          } else {
            completionObservation = await placement
              .observeSchroederSpatialReactionProductPlacementCompletion(
                authentic.authority,
                { submissionArtifact: submission }
              );
            finalizedPlacement = placement
              .finalizeSchroederSpatialReactionProductPlacementAuthority(
                authentic.authority,
                {
                  submissionArtifact: submission,
                  placementDecisionBuffer: segmented.placementDecisionBuffer,
                  placementControlBuffer: segmented.placementControlBuffer,
                  productEventBuffer: segmented.productEventBuffer,
                  completionObservation,
                  dispatchCount: 1
                }
              );
          }
        }
        if (diagnostic && !injectDiagnosticMapFailure) {
          // Queue-ordered diagnostic reuse is authorized only after the exact
          // completion observation has settled.
          arenaRelease = releaseArena();
        }
        if (injectDiagnosticMapFailure) {
          // Match the summary caller's failure ordering: observation throws,
          // then its finally block installs the exact arena release.
          arenaRelease = releaseArena();
          let releaseTimeout = null;
          const releaseTimeoutPromise = new Promise((resolve) => {
            releaseTimeout = setTimeout(
              () => resolve('diagnostic-arena-release-timeout'),
              5_000
            );
          });
          try {
            arenaReleaseConfirmed = await Promise.race([
              arenaRelease,
              releaseTimeoutPromise
            ]);
          } finally {
            clearTimeout(releaseTimeout);
          }
          const failedArenaStats = placement
            .sphReactionProductPlacementSegmentedArenaStats(arenaLease.arena);
          const recoveryLease = placement
            .acquireSphReactionProductPlacementSegmentedArenaWebGpu({
              device,
              authority: authentic.authority,
              particleCapacity: spec.particleCount,
              eventCapacity: EVENT_CAPACITY,
              productTermCapacity: spec.productTermCount,
              eventStrideVec4: 8
            });
          const recoveryDiscarded = placement
            .discardSphReactionProductPlacementSegmentedArenaLease(
              recoveryLease,
              { device, authority: authentic.authority }
            );
          const recoveryDestroyed = placement
            .destroySphReactionProductPlacementSegmentedArenaWebGpu(
              recoveryLease.arena
            );
          diagnosticFailureRecovery = {
            failedArenaRelease: arenaReleaseConfirmed,
            failedArenaStatus: failedArenaStats?.status ?? null,
            failedArenaInFlight: failedArenaStats?.inFlight ?? null,
            failedArenaObservationPending:
              failedArenaStats?.diagnosticObservationPending ?? null,
            replacementArenaAllocated:
              recoveryLease.arena !== arenaLease.arena,
            recoveryDiscarded,
            recoveryDestroyed
          };
        } else {
          arenaReleaseConfirmed = await arenaRelease;
        }
        const eventReadLength = retainFullEvents
          ? spec.events.byteLength
          : 0;
        const [
          stateBytes,
          thermoBytes,
          mechanicsBytes,
          eventBytes,
          summaryBytes,
          receiptBytes
        ] =
          await Promise.all([
            readBuffer(
              authentic.authority.placedDestinationStateBuffer,
              spec.destination.state.byteLength,
              `${labelBase}-state-readback`
            ),
            readBuffer(
              authentic.authority.placedDestinationThermoBuffer,
              spec.destination.thermo.byteLength,
              `${labelBase}-thermo-readback`
            ),
            readBuffer(
              authentic.authority.placedDestinationMechanicsBuffer,
              spec.destination.mechanics.byteLength,
              `${labelBase}-mechanics-readback`
            ),
            readBuffer(
              eventBuffer,
              eventReadLength,
              `${labelBase}-event-readback`
            ),
            readBuffer(
              summaryBuffer,
              spec.productTermCount * 32 * Float32Array.BYTES_PER_ELEMENT,
              `${labelBase}-summary-readback`
            ),
            readBuffer(
              authentic.authority.completionReceiptBuffer,
              abi.SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_BYTES,
              `${labelBase}-receipt-readback`
            )
          ]);
        const positionReceipt = skipPositionFloor
          ? null
          : await placementEpoch
            .finalizeSchroederSpatialReactionPlacementPositionEpochFloor(
              authentic.placementSourceFamily,
              { placementArtifact: submission }
            );
        const positionReceiptValid = skipPositionFloor
          ? null
          : placementEpoch
            .validateSchroederSpatialReactionPlacementPositionEpochFloor(
              positionReceipt,
              {
                device,
                ancestorPublicGeneration: authentic.ancestor
              }
            );
        const { words: receiptWords, decoded: receipt } = decodeReceipt(
          receiptBytes
        );
        const state = new Float32Array(stateBytes);
        const thermo = new Float32Array(thermoBytes);
        const mechanics = new Float32Array(mechanicsBytes);
        const events = new Float32Array(eventBytes);
        const placementSummary = new Float32Array(summaryBytes);
        const signature = [
          fnv1a(new Uint8Array(stateBytes)),
          fnv1a(new Uint8Array(thermoBytes)),
          fnv1a(new Uint8Array(mechanicsBytes)),
          fnv1a(new Uint8Array(eventBytes)),
          normalizedReceiptHash(receiptWords)
        ].join(':');

        const placementReleaseStarted = placementEpoch
          .releaseSchroederSpatialReactionPlacementSourceFamilyAfterQueue(
            authentic.placementSourceFamily,
            {
              placementArtifact: submission,
              // The manufactured authority owns its placement destinations;
              // terminal release must explicitly retire them under the
              // queue-ordered final-consumer capability.
              retireDestinations: true
            }
          );
        await Promise.resolve();
        const placementReleaseStatus = placementEpoch
          .schroederSpatialReactionPlacementSourceFamilyLiveness(
            authentic.placementSourceFamily,
            { device }
          ).releaseStatus;
        const placementReleaseConfirmed = [
          'released-after-final-consumer',
          'released-after-final-consumer-queue-ordered'
        ].includes(placementReleaseStatus);
        const ancestorReleaseStarted = spatial
          .releaseSchroederSpatialEpochGenerationAfterQueue(
            authentic.ancestor,
            device
          );
        const ancestorReleaseConfirmed = authentic.ancestor.releasePromise?.then
          ? await authentic.ancestor.releasePromise
          : null;
        eventBuffer.destroy();
        summaryBuffer.destroy();
        decisionSource.destroy();
        gpuBuffers.destroySphGpuParticleBuffers(authentic.sphParticleUpload);
        gpuBuffers.destroyMlsMpmGpuParticleBuffers(
          authentic.mlsMpmParticleUpload
        );
        authentic.activeNodeList.activeNodeBuffer.destroy();

        if (
          arenaReleaseConfirmed !== (injectDiagnosticMapFailure ? false : true)
          || placementReleaseStarted !== true
          || placementReleaseConfirmed !== true
          || ancestorReleaseStarted !== true
          || ancestorReleaseConfirmed !== true
          || !artifactAuthentic
          || (!skipPositionFloor && !positionReceiptValid)
        ) {
          throw new Error(`native placement lifecycle failed for ${spec.name}: ${JSON.stringify({
            arenaReleaseConfirmed,
            placementReleaseStarted,
            placementReleaseConfirmed,
            placementReleaseStatus,
            ancestorReleaseStarted,
            ancestorReleaseConfirmed,
            artifactAuthentic,
            positionReceiptValid
          })}`);
        }
        return {
          diagnostic,
          state,
          thermo,
          mechanics,
          events,
          placementSummary,
          receipt,
          signature,
          timestampMs,
          timestampSpanCount: timestampSpans.length,
          artifactAuthentic,
          positionReceiptValid,
          positionMutationObserved:
            positionReceipt?.positionMutationObserved ?? null,
          positionMayHaveChanged:
            positionReceipt?.positionMayHaveChanged ?? null,
          sourcePositionEpoch: positionReceipt?.sourcePositionEpoch ?? null,
          positionEpochFloor: positionReceipt?.positionEpochFloor ?? null,
          arenaStats: placement.sphReactionProductPlacementSegmentedArenaStats(
            arenaLease.arena
          ),
          completionObserved: completionObservation?.gpuCompleted === true,
          completionObservationStatus: completionObservation?.status ?? null,
          finalizedPlacementReady: finalizedPlacement?.ready === true,
          transactionalFailClosedRecoveryEncoded:
            submission.transactionalFailClosedRecoveryEncoded === true,
          transactionalAuxiliaryMaterializationEncoded:
            submission.transactionalAuxiliaryMaterializationEncoded === true,
          diagnosticObservationError,
          diagnosticFailureRecovery
        };
      };

      const boundarySpecs = [0, 1, 63, 64, 65].map(
        makeAllToOneCaptureSpec
      );
      const adversarialSpecs = [
        makeSpareExhaustionSpec(),
        makeInvalidPayloadSpec(),
        makeFiniteMomentOverflowSpec(),
        makeDirectOverlapSpec()
      ];
      const cases = [];
      for (const spec of [...boundarySpecs, ...adversarialSpecs]) {
        const first = await runManufacturedCase(spec);
        const second = await runManufacturedCase(spec);
        const verified = verifyOutput(spec, first);
        cases.push({
          name: spec.name,
          eventCount: spec.eventCount,
          cpuOracleParity: verified.cpuOracleParity,
          conserved: verified.conserved,
          deterministic: first.signature === second.signature,
          outputSignature: first.signature,
          receiptStatus: first.receipt.status,
          receipt: {
            activeEventCount: first.receipt.activeEventCount,
            classifierReadyCount: first.receipt.classifierReadyCount,
            classifierRejectedCount: first.receipt.classifierRejectedCount,
            directOnlyEventCount: first.receipt.directOnlyEventCount,
            sparePlacementEventCount:
              first.receipt.sparePlacementEventCount,
            captureMergeEventCount: first.receipt.captureMergeEventCount,
            noCarrierEventCount: first.receipt.noCarrierEventCount,
            rejectedEventCount: first.receipt.rejectedEventCount,
            mutationIntentCount: first.receipt.mutationIntentCount,
            destinationMutationCount:
              first.receipt.destinationMutationCount,
            maxDestinationSegmentSize:
              first.receipt.maxDestinationSegmentSize,
            mutationConflictRetryCount:
              first.receipt.mutationConflictRetryCount,
            globalSerialEventFoldCount:
              first.receipt.globalSerialEventFoldCount,
            hostCompletionReadbackCount:
              first.receipt.hostCompletionReadbackCount,
            status: first.receipt.status
          },
          destinationMutationCount: first.receipt.destinationMutationCount,
          mutationConflictRetryCount:
            first.receipt.mutationConflictRetryCount,
          globalSerialEventFoldCount:
            first.receipt.globalSerialEventFoldCount,
          hostCompletionReadbackCount:
            first.receipt.hostCompletionReadbackCount,
          debug: verified.cpuOracleParity && verified.conserved
            ? null
            : {
                state: Array.from(first.state),
                eventMassAndDisposition: Array.from(
                  { length: spec.eventCount },
                  (_, index) => [
                    first.events[index * 32 + 13],
                    first.events[index * 32 + 31]
                  ]
                ),
                receipt: first.receipt,
                initialMass: particleMass(spec.destination.state)
                  + unplacedMass(spec.events),
                finalMass: particleMass(first.state)
                  + unplacedMass(first.events)
              }
        });
      }

      const completionReadbackCreatesBeforeDiagnostic =
        instrumentation.createdBufferLabels.filter((label) => (
          label.startsWith(ARENA_LABEL_PREFIX)
          && label.endsWith('-completion-readback')
        )).length;
      if (completionReadbackCreatesBeforeDiagnostic !== 0) {
        throw new Error('normal placement acquisition allocated a MAP_READ completion buffer');
      }

      const diagnosticSpec = makeAllToOneCaptureSpec(1);
      const diagnosticOutput = await runManufacturedCase(diagnosticSpec, {
        diagnostic: true
      });
      const diagnosticVerification = verifyOutput(
        diagnosticSpec,
        diagnosticOutput
      );
      const diagnostic = {
        cpuOracleParity: diagnosticVerification.cpuOracleParity,
        conserved: diagnosticVerification.conserved,
        completionObserved: diagnosticOutput.completionObserved,
        completionObservationStatus:
          diagnosticOutput.completionObservationStatus,
        finalizedPlacementReady: diagnosticOutput.finalizedPlacementReady,
        hostCompletionReadbackCount:
          diagnosticOutput.receipt.hostCompletionReadbackCount
      };

      const performanceSpec = makeAllToOneCaptureSpec(EVENT_CAPACITY);
      const performanceOutputs = [];
      for (let sample = 0; sample < 5; sample += 1) {
        performanceOutputs.push(await runManufacturedCase(performanceSpec, {
          timestamp: true,
          retainFullEvents: true
        }));
      }
      const performanceVerification = verifyOutput(
        performanceSpec,
        performanceOutputs[0]
      );
      const performanceDeterministic = performanceOutputs.every(
        (output) => output.signature === performanceOutputs[0].signature
      );
      const samplesMs = performanceOutputs.map((output) => output.timestampMs);
      const receipt = performanceOutputs.at(-1).receipt;
      const rollbackSpec = makeAllToOneCaptureSpec(1);
      const rollbackSummarySeed = Float32Array.from(
        { length: rollbackSpec.productTermCount * 32 },
        (_, index) => f32((index + 1) * 0.125)
      );
      const rollbackOutput = await runManufacturedCase(rollbackSpec, {
        publishedSummarySeed: rollbackSummarySeed,
        receiptPrivateLookupBuildCount: 1
      });
      const rollbackReceipt = rollbackOutput.receipt;
      const rollback = {
        particleFamilyRestored:
          arraysByteEqual(rollbackOutput.state, rollbackSpec.destination.state)
          && arraysByteEqual(
            rollbackOutput.thermo,
            rollbackSpec.destination.thermo
          )
          && arraysByteEqual(
            rollbackOutput.mechanics,
            rollbackSpec.destination.mechanics
          ),
        eventLedgerRetained:
          arraysByteEqual(rollbackOutput.events, rollbackSpec.events),
        summaryLedgerRetained:
          arraysByteEqual(
            rollbackOutput.placementSummary,
            rollbackSummarySeed
          ),
        speculativeMutationObserved:
          rollbackReceipt.captureMergeEventCount === 1
          && rollbackReceipt.destinationMutationCount === 1
          && rollbackReceipt.summaryContributionCount === 1,
        coreStatus: rollbackReceipt.status,
        terminalStatus: rollbackReceipt.transactionalTerminalStatus,
        particleVisited: rollbackReceipt.transactionalVisitedParticleCount,
        particleCommitted:
          rollbackReceipt.transactionalCommittedParticleCount,
        particleFallback:
          rollbackReceipt.transactionalFallbackParticleCount,
        eventRowsVisited:
          rollbackReceipt.transactionalVisitedEventRowCount,
        eventRowsCommitted:
          rollbackReceipt.transactionalCommittedEventRowCount,
        eventRowsFallback:
          rollbackReceipt.transactionalFallbackEventRowCount,
        summaryRowsVisited:
          rollbackReceipt.transactionalVisitedSummaryRowCount,
        summaryRowsCommitted:
          rollbackReceipt.transactionalCommittedSummaryRowCount,
        summaryRowsFallback:
          rollbackReceipt.transactionalFallbackSummaryRowCount,
        particlePublishPassCount:
          rollbackReceipt.transactionalPublishPassCount,
        eventPublishPassCount:
          rollbackReceipt.transactionalEventPublishPassCount,
        summaryPublishPassCount:
          rollbackReceipt.transactionalSummaryPublishPassCount,
        terminalSealPassCount:
          rollbackReceipt.transactionalTerminalSealPassCount
      };
      const lateUnsafeSummarySeed = Float32Array.from(
        rollbackSummarySeed,
        (value) => f32(value + 0.03125)
      );
      const lateUnsafeOutput = await runManufacturedCase(rollbackSpec, {
        publishedSummarySeed: lateUnsafeSummarySeed,
        transactionalCommittedParticleCountSeed: 1
      });
      const lateUnsafeReceipt = lateUnsafeOutput.receipt;
      const lateUnsafe = {
        particleFamilyRestored:
          arraysByteEqual(lateUnsafeOutput.state, rollbackSpec.destination.state)
          && arraysByteEqual(
            lateUnsafeOutput.thermo,
            rollbackSpec.destination.thermo
          )
          && arraysByteEqual(
            lateUnsafeOutput.mechanics,
            rollbackSpec.destination.mechanics
          ),
        eventLedgerRetained:
          arraysByteEqual(lateUnsafeOutput.events, rollbackSpec.events),
        summaryLedgerRetained:
          arraysByteEqual(
            lateUnsafeOutput.placementSummary,
            lateUnsafeSummarySeed
          ),
        speculativeMutationObserved:
          lateUnsafeReceipt.captureMergeEventCount === 1
          && lateUnsafeReceipt.destinationMutationCount === 1
          && lateUnsafeReceipt.summaryContributionCount === 1,
        coreStatus: lateUnsafeReceipt.status,
        terminalStatus: lateUnsafeReceipt.transactionalTerminalStatus,
        particleVisited:
          lateUnsafeReceipt.transactionalVisitedParticleCount,
        particleCommitted:
          lateUnsafeReceipt.transactionalCommittedParticleCount,
        particleFallback:
          lateUnsafeReceipt.transactionalFallbackParticleCount,
        eventRowsCommitted:
          lateUnsafeReceipt.transactionalCommittedEventRowCount,
        summaryRowsCommitted:
          lateUnsafeReceipt.transactionalCommittedSummaryRowCount,
        failClosedRecoveryEncoded:
          lateUnsafeOutput.transactionalFailClosedRecoveryEncoded,
        auxiliaryMaterializationEncoded:
          lateUnsafeOutput.transactionalAuxiliaryMaterializationEncoded
      };
      const arenaStatsBeforeDestroy =
        placement.sphReactionProductPlacementSegmentedArenaStats(retainedArena);
      const firstDestroy =
        placement.destroySphReactionProductPlacementSegmentedArenaWebGpu(
          retainedArena
        );
      const secondDestroy =
        placement.destroySphReactionProductPlacementSegmentedArenaWebGpu(
          retainedArena
        );
      const arenaStatsAfterDestroy =
        placement.sphReactionProductPlacementSegmentedArenaStats(retainedArena);
      const diagnosticFailureOutput = await runManufacturedCase(
        makeAllToOneCaptureSpec(1),
        {
          diagnostic: true,
          injectDiagnosticMapFailure: true,
          trackWarmArena: false
        }
      );
      const diagnosticFailure = {
        observationError: diagnosticFailureOutput.diagnosticObservationError,
        ...diagnosticFailureOutput.diagnosticFailureRecovery
      };

      await nativeDevice.queue.onSubmittedWorkDone();
      const outOfMemoryError = await nativeDevice.popErrorScope();
      const internalError = await nativeDevice.popErrorScope();
      const validationError = await nativeDevice.popErrorScope();
      nativeDevice.destroy();
      return {
        status: 'complete',
        adapterInfo,
        moduleIdentityShared,
        reactionEntityCountProof,
        cases,
        boundaryEventCounts: boundarySpecs.map((spec) => spec.eventCount),
        diagnostic,
        diagnosticFailure,
        rollback,
        lateUnsafe,
        warmArena: {
          firstBufferCreationCount: firstArenaBufferCreationCount,
          bufferCreatesAfterWarmup,
          diagnosticReadbackBufferCreatesAfterWarmup,
          completionReadbackCreatesBeforeDiagnostic,
          diagnosticObservationBackpressureCode,
          diagnosticObservationRetryFenceAbsent,
          diagnosticObservationGateDeferredUntilRelease,
          backpressureCode,
          statsBeforeDestroy: arenaStatsBeforeDestroy,
          statsAfterDestroy: arenaStatsAfterDestroy,
          destroyedExactlyOnce: firstDestroy === true && secondDestroy === false
        },
        receipt,
        timestamps: {
          eventCount: EVENT_CAPACITY,
          samplesMs,
          p50Ms: browserNearestRank(samplesMs, 0.5),
          p95Ms: browserNearestRank(samplesMs, 0.95),
          spanCounts: performanceOutputs.map(
            (output) => output.timestampSpanCount
          ),
          cpuOracleParity: performanceVerification.cpuOracleParity,
          conserved: performanceVerification.conserved,
          deterministic: performanceDeterministic
        },
        timestampQueryEnabled: nativeDevice.features.has('timestamp-query'),
        summaryExports: Object.keys(summary).sort(),
        placementExports: Object.keys(placement).sort(),
        placementEpochExports: Object.keys(placementEpoch).sort(),
        abiHasPlacementReceipt: Boolean(
          abi.SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_LAYOUT
        ),
        wgslHasPlacementCommit: typeof wgsl.sphReactionProductEventPlacementWgsl
          === 'string',
        legacyPlacementCompilationErrors,
        instrumentation: {
          bufferCreateCount: instrumentation.bufferCreateCount,
          queueSubmitCount: instrumentation.queueSubmitCount,
          queueWriteCount: instrumentation.queueWriteCount,
          spareControlBufferCount: instrumentation.createdBufferDescriptors.filter(
            ({ label }) => label.endsWith('-spare-control')
          ).length,
          spareControlCopyDstReady: instrumentation.createdBufferDescriptors
            .filter(({ label }) => label.endsWith('-spare-control'))
            .every(({ usage }) => (usage & GPUBufferUsage.COPY_DST) !== 0)
        },
        placementSubmission: {
          submitCount: placementSubmitCount,
          exactQueueFenceCount: placementFenceCount
        },
        errorCounts: {
          validation: validationError ? 1 : 0,
          internal: internalError ? 1 : 0,
          outOfMemory: outOfMemoryError ? 1 : 0,
          uncaptured: uncapturedErrors.length
        },
        validationError: validationError?.message || null,
        internalError: internalError?.message || null,
        outOfMemoryError: outOfMemoryError?.message || null,
        uncapturedErrors
      };
    });
  } finally {
    await browser.close();
  }

  console.log('native segmented placement report', JSON.stringify({
    adapterInfo: native.adapterInfo,
    reactionEntityCountProof: native.reactionEntityCountProof,
    timestamps: native.timestamps,
    cases: native.cases.map(({ debug, ...caseResult }) => caseResult),
    warmArena: native.warmArena,
    diagnostic: native.diagnostic,
    diagnosticFailure: native.diagnosticFailure,
    rollback: native.rollback,
    lateUnsafe: native.lateUnsafe,
    placementSubmission: native.placementSubmission,
    instrumentation: native.instrumentation,
    errorCounts: native.errorCounts
  }));
  assert.equal(native.status, 'complete', native.reason || JSON.stringify(native));
  assert.equal(native.moduleIdentityShared, true);
  assert.equal(native.timestampQueryEnabled, true);
  assert.equal(native.validationError, null);
  assert.equal(native.internalError, null);
  assert.equal(native.outOfMemoryError, null);
  assert.deepEqual(native.uncapturedErrors, []);
  assert.equal(native.abiHasPlacementReceipt, true);
  assert.equal(native.wgslHasPlacementCommit, true);
  assert.deepEqual(native.legacyPlacementCompilationErrors, []);
  assert.equal(native.reactionEntityCountProof.status, 'complete');
  assert.equal(native.reactionEntityCountProof.remainderMassKg, 1);
  assert.equal(native.reactionEntityCountProof.remainderMaterialId, 1);
  assert.ok(
    Math.abs(
      native.reactionEntityCountProof.remainderRepresentedEntityCount
        - native.reactionEntityCountProof.expectedRemainderRepresentedEntityCount
    ) <= Math.abs(
      native.reactionEntityCountProof.expectedRemainderRepresentedEntityCount
    ) * 2.0e-5
  );
  assert.equal(native.reactionEntityCountProof.directMassKg, 2);
  assert.equal(native.reactionEntityCountProof.directMaterialId, 3);
  assert.equal(native.reactionEntityCountProof.directVolumeRatioJ, 1);
  assert.equal(native.reactionEntityCountProof.directRestVolumeM3, 2);
  assert.ok(
    Math.abs(
      native.reactionEntityCountProof.directRepresentedEntityCount
        - native.reactionEntityCountProof.expectedDirectRepresentedEntityCount
    ) <= Math.abs(
      native.reactionEntityCountProof.expectedDirectRepresentedEntityCount
    ) * 2.0e-5
  );
  assert.ok(native.cases.length >= 8);
  assert.deepEqual(
    native.boundaryEventCounts,
    [0, 1, 63, 64, 65]
  );
  const failedCases = native.cases.filter((caseResult) => (
    !caseResult.cpuOracleParity
    || !caseResult.deterministic
    || !caseResult.conserved
  ));
  assert.deepEqual(
    failedCases,
    [],
    JSON.stringify({
      failedCases,
      diagnostic: native.diagnostic,
      timestamps: native.timestamps,
      warmArena: native.warmArena,
      errorCounts: native.errorCounts
    })
  );
  assert.equal(native.diagnostic.cpuOracleParity, true);
  assert.equal(native.diagnostic.conserved, true);
  assert.equal(native.diagnostic.completionObserved, true);
  assert.equal(native.diagnostic.finalizedPlacementReady, true);
  assert.equal(native.diagnostic.hostCompletionReadbackCount, 1);
  assert.match(
    native.diagnosticFailure.observationError,
    /injected diagnostic placement mapAsync failure/
  );
  assert.equal(native.diagnosticFailure.failedArenaRelease, false);
  assert.equal(native.diagnosticFailure.failedArenaStatus, 'destroyed');
  assert.equal(native.diagnosticFailure.failedArenaInFlight, false);
  assert.equal(native.diagnosticFailure.failedArenaObservationPending, false);
  assert.equal(native.diagnosticFailure.replacementArenaAllocated, true);
  assert.equal(native.diagnosticFailure.recoveryDiscarded, true);
  assert.equal(native.diagnosticFailure.recoveryDestroyed, true);
  assert.equal(native.rollback.particleFamilyRestored, true);
  assert.equal(native.rollback.eventLedgerRetained, true);
  assert.equal(native.rollback.summaryLedgerRetained, true);
  assert.equal(native.rollback.speculativeMutationObserved, true);
  assert.equal(
    native.rollback.coreStatus,
    3
  );
  assert.equal(native.rollback.terminalStatus, 2);
  assert.equal(native.rollback.particleVisited, 4);
  assert.equal(native.rollback.particleCommitted, 0);
  assert.equal(native.rollback.particleFallback, 4);
  assert.equal(native.rollback.eventRowsVisited, 65_536 * 8);
  assert.equal(native.rollback.eventRowsCommitted, 0);
  assert.equal(native.rollback.eventRowsFallback, 65_536 * 8);
  assert.equal(native.rollback.summaryRowsVisited, 8);
  assert.equal(native.rollback.summaryRowsCommitted, 0);
  assert.equal(native.rollback.summaryRowsFallback, 8);
  assert.equal(native.rollback.particlePublishPassCount, 1);
  assert.equal(native.rollback.eventPublishPassCount, 1);
  assert.equal(native.rollback.summaryPublishPassCount, 1);
  assert.equal(native.rollback.terminalSealPassCount, 1);
  assert.equal(native.lateUnsafe.particleFamilyRestored, true);
  assert.equal(native.lateUnsafe.eventLedgerRetained, true);
  assert.equal(native.lateUnsafe.summaryLedgerRetained, true);
  assert.equal(native.lateUnsafe.speculativeMutationObserved, true);
  assert.equal(native.lateUnsafe.coreStatus, 1);
  assert.equal(native.lateUnsafe.terminalStatus, 3);
  assert.equal(native.lateUnsafe.particleVisited, 4);
  assert.equal(native.lateUnsafe.particleCommitted, 5);
  assert.equal(native.lateUnsafe.particleFallback, 0);
  assert.equal(native.lateUnsafe.eventRowsCommitted, 65_536 * 8);
  assert.equal(native.lateUnsafe.summaryRowsCommitted, 8);
  assert.equal(native.lateUnsafe.failClosedRecoveryEncoded, true);
  assert.equal(native.lateUnsafe.auxiliaryMaterializationEncoded, true);
  assert.equal(native.warmArena.bufferCreatesAfterWarmup, 0);
  assert.equal(native.warmArena.diagnosticReadbackBufferCreatesAfterWarmup, 1);
  assert.equal(native.warmArena.completionReadbackCreatesBeforeDiagnostic, 0);
  assert.equal(
    String(native.warmArena.diagnosticObservationBackpressureCode)
      .endsWith('ARENA_BACKPRESSURE'),
    true
  );
  assert.equal(native.warmArena.diagnosticObservationRetryFenceAbsent, true);
  assert.equal(
    native.warmArena.diagnosticObservationGateDeferredUntilRelease,
    true
  );
  assert.equal(native.warmArena.destroyedExactlyOnce, true);
  assert.ok(native.instrumentation.spareControlBufferCount > 0);
  assert.equal(native.instrumentation.spareControlCopyDstReady, true);
  assert.equal(native.receipt.globalSerialEventFoldCount, 0);
  assert.equal(native.receipt.hostCompletionReadbackCount, 0);
  assert.equal(native.timestamps.eventCount, 65_536);
  assert.equal(native.timestamps.cpuOracleParity, true);
  assert.equal(native.timestamps.deterministic, true);
  assert.equal(native.timestamps.conserved, true);
  assert.ok(native.timestamps.samplesMs.length >= 5);
  assert.ok(native.timestamps.samplesMs.every((value) => (
    Number.isFinite(value) && value > 0
  )));
  assert.equal(
    native.timestamps.p95Ms,
    nearestRank(native.timestamps.samplesMs, 0.95)
  );
  assert.ok(
    native.timestamps.p95Ms < 5,
    `65,536-event all-to-one placement p95 ${native.timestamps.p95Ms} ms`
  );
});
