import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ULG_SPH_GPU_REACTION_TABLE_SCHEMA
} from '../ulg-gpu-abi/src/index.js';
import {
  SPH_REACTION_MOTION_ENVELOPE_DYNAMIC_REST_DIAMETER_STATUS,
  SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT,
  SPH_REACTION_MOTION_ENVELOPE_MAX_FUTURE_SUBSTEPS,
  SPH_REACTION_MOTION_ENVELOPE_NUMERIC_SAFETY_REVISION,
  SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION,
  SPH_REACTION_MOTION_ENVELOPE_STATIC_REST_DIAMETER_STATUS,
  SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_LATCH_COUNT_POLICY,
  SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_LATCH_REVISION,
  SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_POLICY,
  ULG_SPH_REACTION_ACTIVATION_OBSERVATION_SCHEMA,
  ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE,
  ULG_SPH_REACTION_MOTION_ENVELOPE_SCHEMA,
  createSphReactionMotionEnvelope,
  isExactSphReactionMotionEnvelope,
  isSphReactionMotionEnvelopeReceipt
} from '../src/runtime/sph/sphReactionMotionEnvelope.js';
import {
  SPH_CANONICAL_CONTACT_MOTION_BOUND_REVISION,
  SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER,
  SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS,
  SPH_CANONICAL_CONTACT_SQRT_THREE_UPPER_F32_BITS
} from '../src/runtime/sph/sphCanonicalContactMotionBound.js';
import {
  SPH_REACTION_MOTION_ENVELOPE_WATCH_PIPELINE_REVISION,
  ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA,
  encodeSphReactionMotionEnvelopeWatchWebGpu,
  markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted,
  observeSphReactionMotionEnvelopeWatch,
  runCanonicalSphReactionMotionEnvelopeWatchWebGpu,
  sphReactionMotionEnvelopeWatchMatchesTerminalStorageFamily,
  sphReactionMotionEnvelopeWatchPrepareWgsl,
  sphReactionMotionEnvelopeWatchScanWgsl,
  sphReactionMotionEnvelopeWatchSealWgsl,
  sphReactionMotionEnvelopeWatchWgsl
} from '../src/runtime/sph/sphReactionMotionEnvelopeWatchGpu.js';
import {
  tagWebGpuBufferDevice
} from '../src/runtime/sph/sphGpuDeviceIdentity.js';
import {
  encodeMlsMpmParticleMotionWatchBins,
  encodeMlsMpmParticleSeparationPasses
} from '../src/runtime/sph/sphG2pGpuKernel.js';

function fakeDevice(observationWord = 0) {
  const submissions = [];
  const mapCalls = [];
  const copies = [];
  const passes = [];
  const writes = [];
  const buffers = [];
  const clears = [];
  const fences = [];
  const bindGroups = [];
  const shaderModules = [];
  const device = {
    submissions,
    mapCalls,
    copies,
    passes,
    writes,
    buffers,
    clears,
    fences,
    bindGroups,
    shaderModules,
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
      maxStorageBufferBindingSize: 128 * 1024 * 1024,
      maxUniformBufferBindingSize: 64 * 1024,
      maxStorageBuffersPerShaderStage: 8,
      maxComputeWorkgroupsPerDimension: 65535,
      minUniformBufferOffsetAlignment: 256
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = data instanceof ArrayBuffer
          ? new Uint8Array(data.slice(0))
          : new Uint8Array(
              data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
            );
        buffer.writtenBytes = bytes;
        if (
          buffer.label === 'ulg-tier0-reaction-motion-watch-readback'
          && bytes.byteLength >= Uint32Array.BYTES_PER_ELEMENT
        ) {
          buffer.mappedWords = new Uint32Array(
            bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
          );
        }
        writes.push({ buffer, offset, bytes });
      },
      submit(commandBuffers) { submissions.push(commandBuffers); },
      onSubmittedWorkDone() {
        fences.push(true);
        return Promise.resolve();
      }
    },
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        async mapAsync(mode) { mapCalls.push({ buffer: this, mode }); },
        getMappedRange() {
          const words = this.mappedWords ?? new Uint32Array([0]);
          return words.buffer.slice(
            words.byteOffset,
            words.byteOffset + words.byteLength
          );
        },
        unmap() { this.unmapped = true; },
        destroy() {
          this.destroyCount = (this.destroyCount ?? 0) + 1;
          this.destroyed = true;
        }
      };
      buffers.push(buffer);
      return tagWebGpuBufferDevice(buffer, device);
    },
    createShaderModule(descriptor) {
      shaderModules.push(descriptor);
      return descriptor;
    },
    createBindGroupLayout(descriptor) { return descriptor; },
    createPipelineLayout(descriptor) { return descriptor; },
    createComputePipeline(descriptor) {
      return {
        ...descriptor,
        getBindGroupLayout(index) {
          return { index, entryPoint: descriptor.compute.entryPoint };
        }
      };
    },
    createBindGroup(descriptor) {
      bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder() {
      return {
        clearBuffer(buffer, offset = 0, size = null) {
          clears.push({ buffer, offset, size });
        },
        beginComputePass(descriptor = {}) {
          const pass = { descriptor, dispatches: [] };
          passes.push(pass);
          return {
            setPipeline(pipeline) { pass.pipeline = pipeline; },
            setBindGroup(index, bindGroup) {
              pass.bindGroup = { index, bindGroup };
            },
            dispatchWorkgroups(x, y = 1, z = 1) {
              pass.dispatches.push([x, y, z]);
            },
            end() { pass.ended = true; }
          };
        },
        copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size) {
          destination.mappedWords = new Uint32Array([
            observationWord === 0xffff_ffff ? 0 : observationWord + 1
          ]);
          copies.push({ source, sourceOffset, destination, destinationOffset, size });
        },
        finish() { return { passes, copies }; }
      };
    }
  };
  return device;
}

function reactionTable() {
  return {
    schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
    reactionCount: 1,
    records: new Float32Array([
      1, 2, 0, 300,
      0, 0.1, 0, 0,
      1, 0, 0, 0
    ])
  };
}

function motionEnvelope(overrides = {}) {
  return createSphReactionMotionEnvelope({
    maxFutureSubsteps: 4,
    dtS: 1 / 120,
    gridSpacingM: 0.05,
    cflFactor: 0.4,
    boxDimsM: [1, 1, 1],
    separationDisplacementEnabled: true,
    ...overrides
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function watchInputs(device, encoder = null, particleCount = 2) {
  const buffer = (label, size) => device.createBuffer({
    label,
    size,
    usage: 128
  });
  const terminalStateBuffer = buffer(
    'terminal-state',
    particleCount * 2 * 16
  );
  const terminalMechanicsBuffer = buffer(
    'terminal-mechanics',
    particleCount * 8 * 16
  );
  const trustedBins = encoder
    ? encodeMlsMpmParticleSeparationPasses(device, encoder, {
        stateBuffer: terminalStateBuffer,
        mechanicsBuffer: terminalMechanicsBuffer,
        particleCount,
        boxDimsM: [1, 1, 1],
        relaxation: 0.5,
        normalVelocityDamping: 0,
        maxPairRestDistanceM: 0.2,
        gridSpacingM: 0.05
      }).postSeparationThermalBinCandidate
    : null;
  return {
    boxDimsM: [1, 1, 1],
    terminalStateBuffer,
    terminalThermoBuffer: buffer(
      'terminal-thermo',
      particleCount * 3 * 16
    ),
    terminalMechanicsBuffer,
    neighborBins: trustedBins
  };
}

test('reaction motion envelope seals exact f32 schedule bits and rejects coercion', () => {
  const envelope = motionEnvelope();
  assert.equal(isExactSphReactionMotionEnvelope(envelope), true);
  assert.equal(
    isSphReactionMotionEnvelopeReceipt(structuredClone(envelope)),
    true
  );
  assert.equal(envelope.maxFutureSubsteps, 4);
  assert.equal(envelope.dtS, Math.fround(1 / 120));
  assert.equal(envelope.gridSpacingM, Math.fround(0.05));
  assert.equal(envelope.cflFactor, Math.fround(0.4));
  assert.equal(
    envelope.schema,
    'peercompute.ulg.sph-reaction-motion-envelope.v2'
  );
  assert.equal(envelope.schema, ULG_SPH_REACTION_MOTION_ENVELOPE_SCHEMA);
  assert.equal(
    envelope.predicateRevision,
    'canonical-reaction-motion-envelope-cfl-separation-contact-thermal-phase-latch-v3'
  );
  assert.equal(
    envelope.predicateRevision,
    SPH_REACTION_MOTION_ENVELOPE_PREDICATE_REVISION
  );
  assert.deepEqual(envelope.boxDimsM, [1, 1, 1]);
  assert.deepEqual(envelope.boxDimsF32Bits, [0x3f80_0000, 0x3f80_0000, 0x3f80_0000]);
  assert.equal(envelope.contactCorrectionEnabled, false);
  assert.equal(envelope.thermalPhaseEvolutionEnabled, false);
  assert.equal(
    envelope.thermalPhaseLatchRevision,
    'target-horizon-thermal-phase-rest-volume-trigger-positive-v1'
  );
  assert.equal(
    envelope.thermalPhaseLatchRevision,
    SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_LATCH_REVISION
  );
  assert.equal(
    envelope.thermalPhaseEvolutionPolicy,
    'terminal-exact-when-static-trigger-positive-before-evolution'
  );
  assert.equal(
    envelope.thermalPhaseEvolutionPolicy,
    SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_POLICY
  );
  assert.equal(
    envelope.thermalPhaseLatchCountPolicy,
    'all-fixed-phase-carrier-slots'
  );
  assert.equal(
    envelope.thermalPhaseLatchCountPolicy,
    SPH_REACTION_MOTION_ENVELOPE_THERMAL_PHASE_LATCH_COUNT_POLICY
  );
  assert.equal(
    envelope.futureRestDiameterPolicy,
    'terminal-upper-only-with-no-rest-volume-writer-else-trigger-positive'
  );
  assert.equal(
    envelope.futureRestDiameterBoundStatus,
    SPH_REACTION_MOTION_ENVELOPE_STATIC_REST_DIAMETER_STATUS
  );
  const dynamicEnvelope = motionEnvelope({
    thermalPhaseEvolutionEnabled: true
  });
  assert.equal(dynamicEnvelope.thermalPhaseEvolutionEnabled, true);
  assert.equal(
    dynamicEnvelope.futureRestDiameterBoundStatus,
    SPH_REACTION_MOTION_ENVELOPE_DYNAMIC_REST_DIAMETER_STATUS
  );
  assert.equal(
    envelope.contactMotionBoundRevision,
    SPH_CANONICAL_CONTACT_MOTION_BOUND_REVISION
  );
  assert.equal(
    envelope.contactPositionTrustDiameters,
    SPH_CANONICAL_CONTACT_POSITION_TRUST_DIAMETERS
  );
  assert.equal(
    envelope.contactPositionToleranceEpsilonMultiplier,
    SPH_CANONICAL_CONTACT_POSITION_TOLERANCE_EPSILON_MULTIPLIER
  );
  assert.equal(
    envelope.wallShellEuclideanUpperF32Bits,
    SPH_CANONICAL_CONTACT_SQRT_THREE_UPPER_F32_BITS
  );
  for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => motionEnvelope({ maxFutureSubsteps: invalid }),
      /maxFutureSubsteps/
    );
  }
  assert.throws(
    () => motionEnvelope({
      maxFutureSubsteps:
        SPH_REACTION_MOTION_ENVELOPE_MAX_FUTURE_SUBSTEPS + 1
    }),
    /maxFutureSubsteps/
  );
  for (const invalid of [
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_VALUE,
    '0'
  ]) {
    assert.throws(() => motionEnvelope({ dtS: invalid }), /dtS/);
  }
  assert.equal(motionEnvelope({ dtS: Number.MIN_VALUE }).dtS, 0);
  for (const field of ['gridSpacingM', 'cflFactor']) {
    for (const invalid of [
      0,
      -1,
      Number.MIN_VALUE,
      Number.MAX_VALUE,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '1'
    ]) {
      assert.throws(() => motionEnvelope({ [field]: invalid }), new RegExp(field));
    }
  }
  for (const boxDimsM of [
    null,
    [],
    [1, 1],
    [1, 1, 0],
    [1, 1, Number.MIN_VALUE],
    [1, 1, Number.MAX_VALUE],
    [1, Number.NaN, 1],
    [1, Number.POSITIVE_INFINITY, 1]
  ]) {
    assert.throws(() => motionEnvelope({ boxDimsM }), /boxDimsM/);
  }
  assert.throws(
    () => motionEnvelope({ contactCorrectionEnabled: 1 }),
    /contactCorrectionEnabled/
  );
  assert.throws(
    () => motionEnvelope({ thermalPhaseEvolutionEnabled: 1 }),
    /thermalPhaseEvolutionEnabled/
  );
  for (const mutate of [
    (candidate) => { candidate.contactMotionBoundRevision = 'forged'; },
    (candidate) => { candidate.contactPositionTrustDiameters = 8; },
    (candidate) => { candidate.boxDimsF32Bits[0] += 1; },
    (candidate) => { candidate.boxDimsF32Bits.push(0); },
    (candidate) => { delete candidate.contactPositionToleranceAbsoluteF32Bits; },
    (candidate) => { delete candidate.thermalPhaseEvolutionEnabled; },
    (candidate) => { candidate.thermalPhaseLatchRevision = 'forged'; },
    (candidate) => { candidate.thermalPhaseEvolutionPolicy = 'forged'; },
    (candidate) => { candidate.thermalPhaseLatchCountPolicy = 'active-only'; },
    (candidate) => {
      candidate.thermalPhaseEvolutionEnabled = true;
    },
    (candidate) => {
      candidate.futureRestDiameterBoundStatus =
        SPH_REACTION_MOTION_ENVELOPE_DYNAMIC_REST_DIAMETER_STATUS;
    }
  ]) {
    const candidate = structuredClone(envelope);
    mutate(candidate);
    assert.equal(isSphReactionMotionEnvelopeReceipt(candidate), false);
  }
  const inheritedShape = Object.assign(
    Object.create({ inheritedEnvelopeField: 'forged' }),
    structuredClone(envelope)
  );
  assert.equal(isSphReactionMotionEnvelopeReceipt(inheritedShape), false);
});

test('canonical contact envelope seals the one-time solver trust ball and wall shell', () => {
  const envelope = motionEnvelope({
    separationDisplacementEnabled: false,
    contactCorrectionEnabled: true
  });
  assert.equal(isExactSphReactionMotionEnvelope(envelope), true);
  assert.equal(envelope.separationDisplacementEnabled, false);
  assert.equal(envelope.contactCorrectionEnabled, true);
  assert.match(
    envelope.relativeReachFormula,
    /canonicalContactTrust/
  );
  assert.equal(
    envelope.futureRestDiameterPolicy,
    'terminal-upper-only-with-no-rest-volume-writer-else-trigger-positive'
  );
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /REACTION_MOTION_CONTACT_TRUST_DIAMETERS: f32 =\s*16\.0/
  );
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /contact_trust_without_tolerance[\s\S]*2\.0 \* advective_one_particle[\s\S]*3\.0 \* wall_shell_transition_m/
  );
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /CONTACT_TOLERANCE_EPSILON_MULTIPLIER[\s\S]*REACTION_MOTION_F32_EPSILON/
  );
  assert.doesNotMatch(
    sphReactionMotionEnvelopeWatchWgsl,
    /CONTACT_TRUST_DIAMETERS[\s\S]*SOLVER_ITERATIONS/
  );
});

test('reaction motion envelope covers absolute-coordinate f32 position stores', () => {
  assert.equal(
    SPH_REACTION_MOTION_ENVELOPE_NUMERIC_SAFETY_REVISION,
    'f32-cuberoot-wall-shell-contact-trust-position-store-and-thermal-phase-latch-v5'
  );
  const sourceA = 1024;
  const sourceB = 1024.375;
  const oneParticleReach = 0.05;
  const exactDistanceAfterReach =
    (sourceB - oneParticleReach) - (sourceA + oneParticleReach);
  const storedDistanceAfterReach = Math.fround(
    Math.fround(sourceB - Math.fround(oneParticleReach))
      - Math.fround(sourceA + Math.fround(oneParticleReach))
  );
  const unmodeledClosure = exactDistanceAfterReach - storedDistanceAfterReach;

  // At the enclosing 2^10 coordinate binade the shader reserves eight ULPs
  // per substep: 2^(10 - 23 + 3) = 2^-10 metres. The concrete store pair
  // loses more separation than a relative-only rounding factor, but remains
  // well inside the new absolute-coordinate allowance.
  const positionStoreAllowance = 2 ** -10;
  assert.ok(unmodeledClosure > 0);
  assert.ok(positionStoreAllowance > unmodeledClosure);
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /reaction_motion_position_store_rounding_upper[\s\S]*exponent_bits - 20u/
  );
});

test('reaction motion watch compiles one entry point per driver module', () => {
  const entryModules = [
    ['prepare', sphReactionMotionEnvelopeWatchPrepareWgsl],
    ['watch', sphReactionMotionEnvelopeWatchScanWgsl],
    ['seal', sphReactionMotionEnvelopeWatchSealWgsl]
  ];
  for (const [entryPoint, source] of entryModules) {
    assert.equal(
      [...source.matchAll(/@compute\b/gu)].length,
      1,
      entryPoint
    );
    assert.match(source, new RegExp(`fn ${entryPoint}\\b`));
    for (const [otherEntryPoint] of entryModules) {
      if (otherEntryPoint === entryPoint) continue;
      assert.doesNotMatch(
        source,
        new RegExp(`@compute[\\s\\S]*fn ${otherEntryPoint}\\b`),
        `${entryPoint} must not retain ${otherEntryPoint}`
      );
    }
  }

  const device = fakeDevice(1);
  const encoder = device.createCommandEncoder();
  encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder,
    ...watchInputs(device, encoder),
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2
  });
  const watchModules = device.shaderModules.filter(({ label }) => (
    String(label).startsWith('ulg-tier0-reaction-motion-watch-')
  ));
  assert.equal(watchModules.length, 3);
  assert.equal(new Set(watchModules.map(({ code }) => code)).size, 3);
  assert.deepEqual(
    watchModules.map(({ code }) => (
      /fn prepare\b/u.test(code)
        ? 'prepare'
        : /fn watch\b/u.test(code)
          ? 'watch'
          : /fn seal\b/u.test(code)
            ? 'seal'
            : null
    )),
    ['prepare', 'watch', 'seal']
  );
});

test('Tier0 reaction motion watch encodes three passes and maps one word without submitting', async () => {
  const device = fakeDevice(1);
  const encoder = device.createCommandEncoder();
  const inputs = watchInputs(device, encoder);
  const passCountBeforeWatch = device.passes.length;
  const proposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2
  });
  assert.equal(
    proposal.schema,
    'peercompute.ulg.sph-reaction-motion-envelope-watch-proposal.v2'
  );
  assert.equal(
    proposal.schema,
    ULG_SPH_REACTION_MOTION_ENVELOPE_WATCH_PROPOSAL_SCHEMA
  );
  assert.equal(proposal.dispatchCount, 3);
  assert.equal(proposal.producerRoute, 'tier0-fused-resident-sequence');
  assert.equal(proposal.terminalBinsAdmitted, true);
  assert.equal(Object.hasOwn(proposal, 'controlBuffer'), false);
  assert.equal(Object.hasOwn(proposal, 'readbackBuffer'), false);
  assert.equal(proposal.encodedIntoCallerSubmission, true);
  assert.equal(proposal.ownedCommandSubmissionCount, 0);
  assert.equal(device.passes.length - passCountBeforeWatch, 3);
  assert.equal(device.copies.length, 1);
  assert.equal(device.copies[0].size, Uint32Array.BYTES_PER_ELEMENT);
  const watchBindGroups = device.bindGroups.filter(({ label }) => (
    String(label).startsWith('ulg-tier0-reaction-motion-watch-')
      && String(label).endsWith('-bindings')
  ));
  assert.equal(watchBindGroups.length, 3);
  for (const bindGroup of watchBindGroups) {
    assert.deepEqual(
      bindGroup.entries.map(({ resource }) => resource.offset),
      [0, 0, 0, 0, 0, 0, 0]
    );
    assert.deepEqual(
      bindGroup.entries.map(({ resource }) => resource.size),
      [64, 96, 256, 48, inputs.neighborBins.binsBuffer.size, 28, 96]
    );
  }
  assert.equal(device.submissions.length, 0);
  device.queue.submit([encoder.finish()]);
  assert.equal(proposal.markSubmittedWork(), true);
  const submissionCount = device.submissions.length;
  const observed = await observeSphReactionMotionEnvelopeWatch(proposal, {
    device
  });
  assert.equal(observed.observationSucceeded, true);
  assert.equal(
    observed.schema,
    'peercompute.ulg.schroeder-spatial-reaction-activation-observation.v3'
  );
  assert.equal(observed.schema, ULG_SPH_REACTION_ACTIVATION_OBSERVATION_SCHEMA);
  assert.equal(observed.shadowOnly, true);
  assert.equal(observed.routingAuthority, false);
  assert.equal(observed.triggeredSourceCount, 1);
  assert.equal(observed.rawEvidenceWord, 1);
  assert.equal(observed.mapAsyncCount, 1);
  assert.equal(observed.readbackByteLength, 4);
  assert.equal(device.mapCalls.length, 1);
  assert.equal(device.submissions.length, submissionCount);
  await assert.rejects(
    observeSphReactionMotionEnvelopeWatch(proposal, { device }),
    /submitted live authentic proposal/
  );
  proposal.destroy();
  assert.equal(device.fences.length, 0);
});

test('contact motion watch binds exact box bits and reduces diameter without generic separation', () => {
  const device = fakeDevice(0xffff_ffff);
  const encoder = device.createCommandEncoder();
  const inputs = watchInputs(device, encoder);
  const envelope = motionEnvelope({
    separationDisplacementEnabled: false,
    contactCorrectionEnabled: true
  });
  const proposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: envelope,
    particleCount: 2
  });
  const paramsWrite = device.writes.find(({ buffer }) => (
    buffer.label === 'ulg-tier0-reaction-motion-watch-params'
  ));
  assert.ok(paramsWrite);
  assert.equal(paramsWrite.bytes.byteLength, 96);
  const view = new DataView(
    paramsWrite.bytes.buffer,
    paramsWrite.bytes.byteOffset,
    paramsWrite.bytes.byteLength
  );
  assert.deepEqual(
    [80, 84, 88].map((offset) => view.getUint32(offset, true)),
    envelope.boxDimsF32Bits
  );
  assert.equal(view.getUint32(52, true), 0);
  assert.equal(view.getUint32(72, true), 0);
  assert.equal(view.getUint32(92, true), 1);
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /params\.separation_enabled == 0u\s*&& params\.contact_correction_enabled == 0u/
  );
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /reaction_motion_position_inside_box[\s\S]*watch_fail_closed\(\)/
  );
  proposal.destroy();
});

test('thermal/phase latch occupies watcher word 72 and precedes every mass-dependent predicate', async () => {
  const device = fakeDevice(2);
  const encoder = device.createCommandEncoder();
  const inputs = watchInputs(device, encoder);
  const envelope = motionEnvelope({
    separationDisplacementEnabled: false,
    thermalPhaseEvolutionEnabled: true
  });
  const proposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: envelope,
    particleCount: 2
  });
  const paramsWrite = device.writes.find(({ buffer }) => (
    buffer.label === 'ulg-tier0-reaction-motion-watch-params'
  ));
  assert.ok(paramsWrite);
  const paramsView = new DataView(
    paramsWrite.bytes.buffer,
    paramsWrite.bytes.byteOffset,
    paramsWrite.bytes.byteLength
  );
  assert.equal(paramsView.getUint32(72, true), 1);
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /if \(params\.thermal_phase_evolution_enabled != 0u\)[\s\S]*triggered = true;[\s\S]*if \(\s*source_state0\.w > 0\.0[\s\S]*&& !triggered/
  );

  device.queue.submit([encoder.finish()]);
  proposal.markSubmittedWork();
  const observation = await observeSphReactionMotionEnvelopeWatch(proposal, {
    device
  });
  assert.equal(observation.observationSucceeded, true);
  assert.equal(observation.triggered, true);
  assert.equal(observation.triggeredSourceCount, 2);
  assert.equal(observation.particleCount, 2);
  proposal.destroy();
});

test('thermal/phase-latched watcher rejects a forged successful zero count', async () => {
  const device = fakeDevice(0);
  const encoder = device.createCommandEncoder();
  const inputs = watchInputs(device, encoder);
  const proposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope({
      thermalPhaseEvolutionEnabled: true
    }),
    particleCount: 2
  });
  device.queue.submit([encoder.finish()]);
  proposal.markSubmittedWork();
  await assert.rejects(
    observeSphReactionMotionEnvelopeWatch(proposal, { device }),
    /thermal\/phase-latched.*did not trigger every fixed carrier slot/
  );
  proposal.destroy();
});

test('motion watch rejects one-ULP box drift before allocating private evidence buffers', () => {
  const device = fakeDevice(0xffff_ffff);
  const encoder = device.createCommandEncoder();
  const inputs = watchInputs(device, encoder);
  assert.throws(
    () => encodeSphReactionMotionEnvelopeWatchWebGpu({
      device,
      encoder,
      ...inputs,
      boxDimsM: [1, 1, 1.0000001192092896],
      reactionTable: reactionTable(),
      reactionMotionEnvelope: motionEnvelope(),
      particleCount: 2
    }),
    /does not bit-match/
  );
  assert.equal(
    device.buffers.some(({ label }) => (
      String(label).startsWith('ulg-tier0-reaction-motion-watch-')
    )),
    false
  );
});

test('motion watch rejects hostile counts and device limits before private allocation', () => {
  const invalidParticleCounts = [
    0,
    -0,
    1.5,
    Number.NaN,
    SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT + 1,
    Number.MAX_SAFE_INTEGER
  ];
  for (const particleCount of invalidParticleCounts) {
    const device = fakeDevice();
    const encoder = device.createCommandEncoder();
    const inputs = watchInputs(device, encoder);
    const bufferCount = device.buffers.length;
    assert.throws(
      () => encodeSphReactionMotionEnvelopeWatchWebGpu({
        device,
        encoder,
        ...inputs,
        reactionTable: reactionTable(),
        reactionMotionEnvelope: motionEnvelope(),
        particleCount
      }),
      /particleCount/
    );
    assert.equal(device.buffers.length, bufferCount);
  }

  const invalidReactionCounts = [
    0,
    -0,
    1.5,
    Number.NaN,
    SPH_REACTION_MOTION_ENVELOPE_MAX_EXACT_COUNT + 1,
    Number.MAX_SAFE_INTEGER
  ];
  for (const reactionCount of invalidReactionCounts) {
    const device = fakeDevice();
    const encoder = device.createCommandEncoder();
    const inputs = watchInputs(device, encoder);
    const bufferCount = device.buffers.length;
    assert.throws(
      () => encodeSphReactionMotionEnvelopeWatchWebGpu({
        device,
        encoder,
        ...inputs,
        reactionTable: { ...reactionTable(), reactionCount },
        reactionMotionEnvelope: motionEnvelope(),
        particleCount: 2
      }),
      /reactionTable\.reactionCount/
    );
    assert.equal(device.buffers.length, bufferCount);
  }

  for (const [limitName, invalidLimit] of [
    ['maxBufferSize', Number.NaN],
    ['maxBufferSize', 128],
    ['maxStorageBufferBindingSize', Number.MAX_VALUE],
    ['maxStorageBufferBindingSize', 128],
    ['maxUniformBufferBindingSize', 0],
    ['maxUniformBufferBindingSize', 1],
    ['maxStorageBuffersPerShaderStage', 5],
    ['maxComputeWorkgroupsPerDimension', -0]
  ]) {
    const device = fakeDevice();
    const encoder = device.createCommandEncoder();
    const inputs = watchInputs(device, encoder);
    device.limits[limitName] = invalidLimit;
    const bufferCount = device.buffers.length;
    assert.throws(
      () => encodeSphReactionMotionEnvelopeWatchWebGpu({
        device,
        encoder,
        ...inputs,
        reactionTable: reactionTable(),
        reactionMotionEnvelope: motionEnvelope(),
        particleCount: 2
      }),
      /device\.limits|storage buffers|storage device limit|uniform device limit|maxUniformBufferBindingSize/
    );
    assert.equal(device.buffers.length, bufferCount);
  }

  {
    const device = fakeDevice();
    const encoder = device.createCommandEncoder();
    const inputs = watchInputs(device, encoder, 65);
    device.limits.maxComputeWorkgroupsPerDimension = 1;
    const bufferCount = device.buffers.length;
    assert.throws(
      () => encodeSphReactionMotionEnvelopeWatchWebGpu({
        device,
        encoder,
        ...inputs,
        reactionTable: reactionTable(),
        reactionMotionEnvelope: motionEnvelope(),
        particleCount: 65
      }),
      /dispatch.*maxComputeWorkgroupsPerDimension/
    );
    assert.equal(device.buffers.length, bufferCount);
  }
});

test('motion watch rejects malformed buffer and reaction storage before allocation', () => {
  {
    const device = fakeDevice();
    const encoder = device.createCommandEncoder();
    const inputs = watchInputs(device, encoder);
    inputs.terminalStateBuffer.size = Number.NaN;
    const bufferCount = device.buffers.length;
    assert.throws(
      () => encodeSphReactionMotionEnvelopeWatchWebGpu({
        device,
        encoder,
        ...inputs,
        reactionTable: reactionTable(),
        reactionMotionEnvelope: motionEnvelope(),
        particleCount: 2
      }),
      /terminalStateBuffer/
    );
    assert.equal(device.buffers.length, bufferCount);
  }
  {
    const device = fakeDevice();
    const encoder = device.createCommandEncoder();
    const inputs = watchInputs(device, encoder);
    const table = reactionTable();
    table.combinedRecords = table.records.slice();
    table.combinedRecords[0] += 1;
    const bufferCount = device.buffers.length;
    assert.throws(
      () => encodeSphReactionMotionEnvelopeWatchWebGpu({
        device,
        encoder,
        ...inputs,
        reactionTable: table,
        reactionMotionEnvelope: motionEnvelope(),
        particleCount: 2
      }),
      /combined-record prefix/
    );
    assert.equal(device.buffers.length, bufferCount);
  }
  if (typeof SharedArrayBuffer === 'function') {
    const device = fakeDevice();
    const encoder = device.createCommandEncoder();
    const inputs = watchInputs(device, encoder);
    const sharedRecords = new Float32Array(new SharedArrayBuffer(48));
    sharedRecords.set(reactionTable().records);
    const bufferCount = device.buffers.length;
    assert.throws(
      () => encodeSphReactionMotionEnvelopeWatchWebGpu({
        device,
        encoder,
        ...inputs,
        reactionTable: {
          schema: ULG_SPH_GPU_REACTION_TABLE_SCHEMA,
          reactionCount: 1,
          records: sharedRecords
        },
        reactionMotionEnvelope: motionEnvelope(),
        particleCount: 2
      }),
      /shared mutable storage/
    );
    assert.equal(device.buffers.length, bufferCount);
  }
});

test('motion watch consumes malformed mapped evidence and table TOCTOU as fatal', async () => {
  const createSubmittedProposal = (observationWord, table = reactionTable()) => {
    const device = fakeDevice(observationWord);
    const encoder = device.createCommandEncoder();
    const inputs = watchInputs(device, encoder);
    const proposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
      device,
      encoder,
      ...inputs,
      reactionTable: table,
      reactionMotionEnvelope: motionEnvelope(),
      particleCount: 2
    });
    device.queue.submit([encoder.finish()]);
    assert.equal(proposal.markSubmittedWork(), true);
    const readback = device.buffers.find(({ label }) => (
      label === 'ulg-tier0-reaction-motion-watch-readback'
    ));
    assert.ok(readback);
    return { device, proposal, readback };
  };
  const assertFatal = (pattern) => (error) => {
    assert.match(error.message, pattern);
    assert.equal(error.reactionActivationObservationFatal, true);
    assert.equal(
      error.code,
      ULG_SPH_REACTION_ACTIVATION_OBSERVATION_FATAL_ERROR_CODE
    );
    assert.equal(error.reactionActivationObservationMapAsyncCount, 1);
    return true;
  };

  {
    const { device, proposal, readback } = createSubmittedProposal(1);
    readback.getMappedRange = () => new ArrayBuffer(8);
    await assert.rejects(
      observeSphReactionMotionEnvelopeWatch(proposal, { device }),
      assertFatal(/malformed mapped range/)
    );
    await assert.rejects(
      observeSphReactionMotionEnvelopeWatch(proposal, { device }),
      /submitted live authentic proposal/
    );
    proposal.destroy();
  }
  {
    const { device, proposal } = createSubmittedProposal(3);
    await assert.rejects(
      observeSphReactionMotionEnvelopeWatch(proposal, { device }),
      assertFatal(/exceeded its authenticated source domain/)
    );
    proposal.destroy();
  }
  {
    const table = reactionTable();
    const { device, proposal, readback } = createSubmittedProposal(1, table);
    const map = deferred();
    readback.mapAsync = (mode) => {
      device.mapCalls.push({ buffer: readback, mode });
      return map.promise;
    };
    const observation = observeSphReactionMotionEnvelopeWatch(proposal, {
      device
    });
    await Promise.resolve();
    table.records = table.records.slice();
    map.resolve();
    await assert.rejects(
      observation,
      assertFatal(/immutable authenticity/)
    );
    proposal.destroy();
  }
});

test('canonical terminal reaction watch owns one compact submit over every fixed carrier slot', async () => {
  const device = fakeDevice(0);
  const particleCount = 65;
  const inputs = watchInputs(device, null, particleCount);
  const proposal = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
    device,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount,
    boxDimsM: [1, 1, 1]
  });

  assert.equal(device.submissions.length, 1);
  assert.equal(proposal.submitted, true);
  assert.equal(proposal.dispatchCount, 3);
  assert.equal(proposal.producerRoute, 'canonical-schroeder');
  assert.equal(
    proposal.sampleStage,
    'canonical-terminal-published-carrier-family-motion-envelope'
  );
  assert.equal(proposal.nodeDomain, 'fixed-phase-carrier-slot');
  assert.equal(proposal.encodedIntoCallerSubmission, false);
  assert.equal(proposal.ownedCommandSubmissionCount, 1);
  assert.equal(proposal.terminalBinsAdmitted, true);
  assert.equal(device.passes.length, 4);
  assert.equal(device.copies.length, 1);

  const binFillPass = device.passes.find(({ descriptor }) => (
    descriptor?.label === 'ulg-mls-mpm-terminal-motion-watch-bin-fill'
  ));
  const scanPass = device.passes.find(({ descriptor }) => (
    descriptor?.label === 'ulg-canonical-terminal-reaction-motion-watch-scan'
  ));
  assert.deepEqual(binFillPass?.dispatches, [[2, 1, 1]]);
  assert.deepEqual(scanPass?.dispatches, [[2, 1, 1]]);

  const binFillBindings = device.bindGroups.find(({ label }) => (
    label === 'ulg-mls-mpm-terminal-motion-watch-bin-fill-bindings'
  ));
  assert.equal(
    binFillBindings.entries.find(({ binding }) => binding === 0).resource.buffer,
    inputs.terminalStateBuffer
  );
  assert.equal(
    binFillBindings.entries.find(({ binding }) => binding === 1).resource.buffer,
    inputs.terminalMechanicsBuffer
  );
  const watchBindings = device.bindGroups.filter(({ label }) => (
    String(label).startsWith(
      'ulg-canonical-terminal-reaction-motion-watch-'
    ) && String(label).endsWith('-bindings')
  ));
  assert.equal(watchBindings.length, 3);
  for (const bindGroup of watchBindings) {
    assert.equal(
      bindGroup.entries.find(({ binding }) => binding === 0).resource.buffer,
      inputs.terminalStateBuffer
    );
    assert.equal(
      bindGroup.entries.find(({ binding }) => binding === 1).resource.buffer,
      inputs.terminalThermoBuffer
    );
    assert.equal(
      bindGroup.entries.find(({ binding }) => binding === 2).resource.buffer,
      inputs.terminalMechanicsBuffer
    );
  }

  const privatelyOwned = device.buffers.filter(({ label }) => (
    String(label).startsWith('ulg-canonical-terminal-reaction-motion-watch-')
    || String(label).startsWith('ulg-mls-mpm-terminal-motion-watch-')
  ));
  assert.equal(privatelyOwned.length, 6);
  assert.equal(proposal.destroy(), false);
  assert.equal(proposal.quarantined, true);
  assert.equal(proposal.released, false);
  assert.equal(device.fences.length, 1);
  assert.ok(privatelyOwned.every(({ destroyed }) => destroyed === false));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(proposal.quarantined, false);
  assert.equal(proposal.released, true);
  assert.ok(privatelyOwned.every(({ destroyCount }) => destroyCount === 1));
  assert.equal(inputs.terminalStateBuffer.destroyed, false);
  assert.equal(inputs.terminalThermoBuffer.destroyed, false);
  assert.equal(inputs.terminalMechanicsBuffer.destroyed, false);
});

test('canonical terminal motion-bin producer rejects hostile limits, buffers, and torn allocations before dispatch', () => {
  const expectPreflightRejection = ({
    particleCount = 2,
    mutate,
    pattern
  }) => {
    const device = fakeDevice();
    const inputs = watchInputs(device, null, particleCount);
    const encoder = device.createCommandEncoder();
    mutate({ device, inputs });
    const bufferCount = device.buffers.length;
    const passCount = device.passes.length;
    assert.throws(
      () => encodeMlsMpmParticleMotionWatchBins(device, encoder, {
        stateBuffer: inputs.terminalStateBuffer,
        mechanicsBuffer: inputs.terminalMechanicsBuffer,
        particleCount,
        boxDimsM: [1, 1, 1],
        cellSizeFloorM: 0.05
      }),
      pattern
    );
    assert.equal(device.buffers.length, bufferCount);
    assert.equal(device.passes.length, passCount);
  };

  for (const specification of [
    {
      mutate: ({ device }) => { device.limits.maxBufferSize = 128; },
      pattern: /maxBufferSize|storage device limit/
    },
    {
      mutate: ({ device }) => {
        device.limits.maxStorageBufferBindingSize = 128;
      },
      pattern: /storage device limit/
    },
    {
      mutate: ({ device }) => {
        device.limits.maxUniformBufferBindingSize = 1;
      },
      pattern: /uniform device limit/
    },
    {
      mutate: ({ device }) => {
        device.limits.maxStorageBuffersPerShaderStage = 2;
      },
      pattern: /three storage buffers/
    },
    {
      particleCount: 65,
      mutate: ({ device }) => {
        device.limits.maxComputeWorkgroupsPerDimension = 1;
      },
      pattern: /compute-dispatch limit/
    },
    {
      mutate: ({ inputs }) => {
        inputs.terminalStateBuffer.size = Number.NaN;
      },
      pattern: /stateBuffer has an invalid exact byte length/
    },
    {
      mutate: ({ inputs }) => {
        inputs.terminalMechanicsBuffer.size = 1;
      },
      pattern: /mechanicsBuffer has an invalid exact byte length/
    }
  ]) {
    expectPreflightRejection(specification);
  }

  for (const tornLabel of [
    'ulg-mls-mpm-terminal-motion-watch-bin-params',
    'ulg-mls-mpm-terminal-motion-watch-bins'
  ]) {
    const device = fakeDevice();
    const inputs = watchInputs(device);
    const encoder = device.createCommandEncoder();
    const createBuffer = device.createBuffer.bind(device);
    device.createBuffer = (descriptor) => {
      const buffer = createBuffer(descriptor);
      if (descriptor.label === tornLabel) buffer.size -= 4;
      return buffer;
    };
    const bufferCount = device.buffers.length;
    assert.throws(
      () => encodeMlsMpmParticleMotionWatchBins(device, encoder, {
        stateBuffer: inputs.terminalStateBuffer,
        mechanicsBuffer: inputs.terminalMechanicsBuffer,
        particleCount: 2,
        boxDimsM: [1, 1, 1],
        cellSizeFloorM: 0.05
      }),
      /torn byte length/
    );
    const partialFamily = device.buffers.slice(bufferCount);
    assert.ok(partialFamily.length >= 1);
    assert.ok(partialFamily.every(({ destroyed }) => destroyed === true));
    assert.equal(
      device.passes.some(({ descriptor }) => (
        descriptor?.label === 'ulg-mls-mpm-terminal-motion-watch-bin-fill'
      )),
      false
    );
  }
});

test('canonical terminal reaction watch observes normally without another submit or fence', async () => {
  const device = fakeDevice(2);
  const inputs = watchInputs(device);
  const proposal = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
    device,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2,
    boxDimsM: [1, 1, 1]
  });
  const privatelyOwned = device.buffers.filter(({ label }) => (
    String(label).startsWith('ulg-canonical-terminal-reaction-motion-watch-')
    || String(label).startsWith('ulg-mls-mpm-terminal-motion-watch-')
  ));
  const submissionCount = device.submissions.length;
  const observed = await observeSphReactionMotionEnvelopeWatch(proposal, {
    device
  });
  assert.equal(observed.observationSucceeded, true);
  assert.equal(observed.triggeredSourceCount, 2);
  assert.equal(observed.producerRoute, 'canonical-schroeder');
  assert.equal(device.submissions.length, submissionCount);
  assert.equal(device.fences.length, 0);
  assert.equal(device.mapCalls.length, 1);
  assert.equal(proposal.destroy(), true);
  assert.ok(privatelyOwned.every(({ destroyCount }) => destroyCount === 1));
  assert.equal(inputs.terminalStateBuffer.destroyed, false);
  assert.equal(inputs.terminalThermoBuffer.destroyed, false);
  assert.equal(inputs.terminalMechanicsBuffer.destroyed, false);
});

test('canonical terminal reaction watch retires a partial private bin/watch family exactly once', () => {
  const device = fakeDevice(0xffff_ffff);
  const inputs = watchInputs(device);
  const createBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor) => {
    if (
      descriptor?.label
        === 'ulg-canonical-terminal-reaction-motion-watch-control'
    ) {
      throw new Error('injected canonical watch allocation failure');
    }
    return createBuffer(descriptor);
  };

  assert.throws(
    () => runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
      device,
      ...inputs,
      reactionTable: reactionTable(),
      reactionMotionEnvelope: motionEnvelope(),
      particleCount: 2,
      boxDimsM: [1, 1, 1]
    }),
    /injected canonical watch allocation failure/
  );
  const privateBins = device.buffers.filter(({ label }) => (
    String(label).startsWith('ulg-mls-mpm-terminal-motion-watch-')
  ));
  assert.equal(privateBins.length, 2);
  assert.ok(privateBins.every(({ destroyCount }) => destroyCount === 1));
  assert.equal(inputs.terminalStateBuffer.destroyed, false);
  assert.equal(inputs.terminalThermoBuffer.destroyed, false);
  assert.equal(inputs.terminalMechanicsBuffer.destroyed, false);
  assert.equal(device.submissions.length, 0);
  assert.equal(device.fences.length, 0);
});

test('canonical terminal reaction watch rolls back a rejected private submission', () => {
  const device = fakeDevice(0xffff_ffff);
  const inputs = watchInputs(device);
  device.queue.submit = () => {
    throw new Error('injected canonical submit rejection');
  };
  assert.throws(
    () => runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
      device,
      ...inputs,
      reactionTable: reactionTable(),
      reactionMotionEnvelope: motionEnvelope(),
      particleCount: 2,
      boxDimsM: [1, 1, 1]
    }),
    /injected canonical submit rejection/
  );
  const privatelyOwned = device.buffers.filter(({ label }) => (
    String(label).startsWith('ulg-canonical-terminal-reaction-motion-watch-')
    || String(label).startsWith('ulg-mls-mpm-terminal-motion-watch-')
  ));
  assert.equal(privatelyOwned.length, 6);
  assert.ok(privatelyOwned.every(({ destroyCount }) => destroyCount === 1));
  assert.equal(device.fences.length, 0);
  assert.equal(inputs.terminalStateBuffer.destroyed, false);
  assert.equal(inputs.terminalThermoBuffer.destroyed, false);
  assert.equal(inputs.terminalMechanicsBuffer.destroyed, false);
});

test('canonical terminal reaction watch rejects an observed lost device before allocation or submit', async () => {
  const device = fakeDevice(0xffff_ffff);
  const loss = deferred();
  device.lost = loss.promise;
  const firstInputs = watchInputs(device);
  const first = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
    device,
    ...firstInputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2,
    boxDimsM: [1, 1, 1]
  });
  loss.resolve({ reason: 'destroyed' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(first.released, true);

  const secondInputs = watchInputs(device);
  const allocationCount = device.buffers.length;
  const submissionCount = device.submissions.length;
  assert.throws(
    () => runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
      device,
      ...secondInputs,
      reactionTable: reactionTable(),
      reactionMotionEnvelope: motionEnvelope(),
      particleCount: 2,
      boxDimsM: [1, 1, 1]
    }),
    /already-lost device/
  );
  assert.equal(device.buffers.length, allocationCount);
  assert.equal(device.submissions.length, submissionCount);
  assert.equal(secondInputs.terminalStateBuffer.destroyed, false);
  assert.equal(secondInputs.terminalThermoBuffer.destroyed, false);
  assert.equal(secondInputs.terminalMechanicsBuffer.destroyed, false);
});

test('canonical terminal reaction watch keeps a failed buffer retirement retryable', () => {
  const device = fakeDevice(0xffff_ffff);
  const inputs = watchInputs(device);
  const proposal = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
    device,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2,
    boxDimsM: [1, 1, 1]
  });
  const privatelyOwned = device.buffers.filter(({ label }) => (
    String(label).startsWith('ulg-canonical-terminal-reaction-motion-watch-')
    || String(label).startsWith('ulg-mls-mpm-terminal-motion-watch-')
  ));
  const failingBuffer = privatelyOwned[0];
  const destroyBuffer = failingBuffer.destroy.bind(failingBuffer);
  let destroyAttempts = 0;
  failingBuffer.destroy = () => {
    destroyAttempts += 1;
    if (destroyAttempts === 1) {
      throw new Error('injected private buffer destroy failure');
    }
    destroyBuffer();
  };
  assert.equal(
    markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted(
      proposal,
      { device }
    ),
    true
  );
  assert.equal(proposal.destroy(), false);
  assert.equal(proposal.released, false);
  assert.equal(proposal.quarantined, true);
  assert.equal(proposal.releaseFailureCount, 1);
  assert.equal(proposal.destroy(), true);
  assert.equal(proposal.released, true);
  assert.equal(destroyAttempts, 2);
  assert.ok(privatelyOwned.every(({ destroyCount }) => destroyCount === 1));
  assert.equal(inputs.terminalStateBuffer.destroyed, false);
  assert.equal(inputs.terminalThermoBuffer.destroyed, false);
  assert.equal(inputs.terminalMechanicsBuffer.destroyed, false);
});

test('canonical terminal reaction watch releases exactly once after a concurrent successful map', async () => {
  const device = fakeDevice(1);
  const map = deferred();
  const fence = deferred();
  device.queue.onSubmittedWorkDone = () => {
    device.fences.push(true);
    return fence.promise;
  };
  const inputs = watchInputs(device);
  const proposal = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
    device,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2,
    boxDimsM: [1, 1, 1]
  });
  const privatelyOwned = device.buffers.filter(({ label }) => (
    String(label).startsWith('ulg-canonical-terminal-reaction-motion-watch-')
    || String(label).startsWith('ulg-mls-mpm-terminal-motion-watch-')
  ));
  const readback = device.buffers.find(({ label }) => (
    label === 'ulg-canonical-terminal-reaction-motion-watch-readback'
  ));
  readback.mapAsync = (mode) => {
    device.mapCalls.push({ buffer: readback, mode });
    return map.promise;
  };

  const observation = observeSphReactionMotionEnvelopeWatch(proposal, {
    device
  });
  await Promise.resolve();
  assert.equal(proposal.destroy(), true);
  assert.equal(device.fences.length, 1);
  assert.equal(proposal.released, false);
  assert.ok(privatelyOwned.every(({ destroyCount }) => !destroyCount));

  map.resolve();
  const observed = await observation;
  assert.equal(observed.observationSucceeded, true);
  assert.equal(observed.triggeredSourceCount, 1);
  assert.equal(proposal.released, true);
  assert.equal(proposal.quarantined, false);
  assert.ok(privatelyOwned.every(({ destroyCount }) => destroyCount === 1));
  assert.equal(inputs.terminalStateBuffer.destroyed, false);
  assert.equal(inputs.terminalThermoBuffer.destroyed, false);
  assert.equal(inputs.terminalMechanicsBuffer.destroyed, false);

  fence.reject(new Error('stale canonical fence rejection after map success'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(proposal.released, true);
  assert.equal(proposal.quarantined, false);
  assert.ok(privatelyOwned.every(({ destroyCount }) => destroyCount === 1));
});

test('canonical terminal reaction watch honors completion recorded before concurrent destroy', async () => {
  const device = fakeDevice(1);
  const map = deferred();
  const inputs = watchInputs(device);
  const proposal = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
    device,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2,
    boxDimsM: [1, 1, 1]
  });
  const privatelyOwned = device.buffers.filter(({ label }) => (
    String(label).startsWith('ulg-canonical-terminal-reaction-motion-watch-')
    || String(label).startsWith('ulg-mls-mpm-terminal-motion-watch-')
  ));
  const readback = device.buffers.find(({ label }) => (
    label === 'ulg-canonical-terminal-reaction-motion-watch-readback'
  ));
  readback.mapAsync = (mode) => {
    device.mapCalls.push({ buffer: readback, mode });
    return map.promise;
  };

  assert.equal(
    markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted(
      proposal,
      { device }
    ),
    true
  );
  const observation = observeSphReactionMotionEnvelopeWatch(proposal, {
    device
  });
  await Promise.resolve();
  assert.equal(proposal.destroy(), true);
  assert.equal(proposal.released, true);
  assert.equal(proposal.quarantined, false);
  assert.equal(device.fences.length, 0);
  assert.ok(privatelyOwned.every(({ destroyCount }) => destroyCount === 1));
  map.reject(new Error('cancelled map after exact completion'));
  await assert.rejects(observation, /cancelled map after exact completion/);
  assert.ok(privatelyOwned.every(({ destroyCount }) => destroyCount === 1));
});

test('canonical terminal reaction watch privately authenticates its exact borrowed terminal family', () => {
  const device = fakeDevice(0xffff_ffff);
  const inputs = watchInputs(device);
  const proposal = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
    device,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2,
    boxDimsM: [1, 1, 1]
  });
  assert.equal(
    sphReactionMotionEnvelopeWatchMatchesTerminalStorageFamily(
      proposal,
      { device, ...inputs, particleCount: 2 }
    ),
    true
  );
  assert.equal(
    sphReactionMotionEnvelopeWatchMatchesTerminalStorageFamily(
      proposal,
      {
        device,
        ...inputs,
        terminalStateBuffer: device.createBuffer({
          label: 'superseding-state',
          size: inputs.terminalStateBuffer.size,
          usage: 128
        }),
        particleCount: 2
      }
    ),
    false
  );
  assert.equal(
    markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted(
      proposal,
      { device }
    ),
    true
  );
  assert.equal(proposal.destroy(), true);
});

test('canonical terminal reaction watch cancellation survives a rejected in-flight map', async () => {
  const device = fakeDevice(0xffff_ffff);
  const map = deferred();
  const fence = deferred();
  device.queue.onSubmittedWorkDone = () => {
    device.fences.push(true);
    return fence.promise;
  };
  const inputs = watchInputs(device);
  const proposal = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
    device,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2,
    boxDimsM: [1, 1, 1]
  });
  const readback = device.buffers.find(({ label }) => (
    label === 'ulg-canonical-terminal-reaction-motion-watch-readback'
  ));
  readback.mapAsync = (mode) => {
    device.mapCalls.push({ buffer: readback, mode });
    return map.promise;
  };

  const observation = observeSphReactionMotionEnvelopeWatch(proposal, {
    device
  });
  await Promise.resolve();
  assert.equal(proposal.destroy(), true);
  assert.equal(device.fences.length, 1);
  map.reject(new Error('injected canonical map rejection'));
  await assert.rejects(observation, /injected canonical map rejection/);
  assert.equal(proposal.quarantined, true);
  assert.equal(proposal.released, false);
  fence.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(proposal.quarantined, false);
  assert.equal(proposal.released, true);
});

test('canonical terminal reaction watch keeps rejected map and fence quarantined until device loss', async () => {
  const device = fakeDevice(0xffff_ffff);
  const map = deferred();
  const fence = deferred();
  const loss = deferred();
  device.lost = loss.promise;
  device.queue.onSubmittedWorkDone = () => {
    device.fences.push(true);
    return fence.promise;
  };
  const inputs = watchInputs(device);
  const proposal = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
    device,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2,
    boxDimsM: [1, 1, 1]
  });
  const readback = device.buffers.find(({ label }) => (
    label === 'ulg-canonical-terminal-reaction-motion-watch-readback'
  ));
  readback.mapAsync = (mode) => {
    device.mapCalls.push({ buffer: readback, mode });
    return map.promise;
  };

  const observation = observeSphReactionMotionEnvelopeWatch(proposal, {
    device
  });
  await Promise.resolve();
  assert.equal(proposal.destroy(), true);
  map.reject(new Error('injected canonical map rejection'));
  fence.reject(new Error('injected canonical fence rejection'));
  await assert.rejects(observation, /injected canonical map rejection/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(proposal.quarantined, true);
  assert.equal(proposal.released, false);
  loss.resolve({ reason: 'destroyed' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(proposal.quarantined, false);
  assert.equal(proposal.released, true);
});

test('canonical device loss release ignores a later stale fallback-fence rejection', async () => {
  const device = fakeDevice(0xffff_ffff);
  const map = deferred();
  const fence = deferred();
  const loss = deferred();
  device.lost = loss.promise;
  device.queue.onSubmittedWorkDone = () => {
    device.fences.push(true);
    return fence.promise;
  };
  const inputs = watchInputs(device);
  const proposal = runCanonicalSphReactionMotionEnvelopeWatchWebGpu({
    device,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2,
    boxDimsM: [1, 1, 1]
  });
  const privatelyOwned = device.buffers.filter(({ label }) => (
    String(label).startsWith('ulg-canonical-terminal-reaction-motion-watch-')
    || String(label).startsWith('ulg-mls-mpm-terminal-motion-watch-')
  ));
  const readback = device.buffers.find(({ label }) => (
    label === 'ulg-canonical-terminal-reaction-motion-watch-readback'
  ));
  readback.mapAsync = () => map.promise;

  const observation = observeSphReactionMotionEnvelopeWatch(proposal, {
    device
  });
  await Promise.resolve();
  assert.equal(proposal.destroy(), true);
  loss.resolve({ reason: 'destroyed' });
  await assert.rejects(observation, /device was lost while MAP_READ was pending/);
  assert.equal(proposal.released, true);
  assert.equal(proposal.quarantined, false);
  assert.ok(privatelyOwned.every(({ destroyCount }) => destroyCount === 1));
  fence.reject(new Error('stale fallback fence rejection after device loss'));
  map.reject(new Error('late map rejection after device loss'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(proposal.released, true);
  assert.equal(proposal.quarantined, false);
  assert.ok(privatelyOwned.every(({ destroyCount }) => destroyCount === 1));
});

test('Tier0 reaction motion watch rejects copied terminal-bin metadata', () => {
  const device = fakeDevice(0xffff_ffff);
  const encoder = device.createCommandEncoder();
  const inputs = watchInputs(device, encoder);
  const proposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder,
    ...inputs,
    neighborBins: Object.freeze({ ...inputs.neighborBins }),
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2
  });
  assert.equal(proposal.terminalBinsAdmitted, false);
  assert.equal(proposal.dispatchCount, 0);
  proposal.destroy();
});

test('Tier0 reaction motion watch keeps a dropped GPU copy fail-closed', async () => {
  const device = fakeDevice(0);
  const encoder = device.createCommandEncoder();
  const inputs = watchInputs(device, encoder);
  const copyBufferToBuffer = encoder.copyBufferToBuffer.bind(encoder);
  encoder.copyBufferToBuffer = (
    source,
    sourceOffset,
    destination,
    destinationOffset,
    size
  ) => {
    if (source?.label === 'ulg-tier0-reaction-motion-watch-control') {
      device.copies.push({
        source,
        sourceOffset,
        destination,
        destinationOffset,
        size,
        dropped: true
      });
      return;
    }
    copyBufferToBuffer(
      source,
      sourceOffset,
      destination,
      destinationOffset,
      size
    );
  };
  const proposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2
  });
  const readbackWrite = device.writes.find(({ buffer }) => (
    buffer.label === 'ulg-tier0-reaction-motion-watch-readback'
  ));
  assert.equal(readbackWrite, undefined);
  device.queue.submit([encoder.finish()]);
  proposal.markSubmittedWork();
  const observed = await observeSphReactionMotionEnvelopeWatch(proposal, {
    device
  });
  assert.equal(observed.observationSucceeded, false);
  assert.equal(observed.uncertainty, true);
  assert.equal(observed.rawEvidenceWord, 0xffff_ffff);
  proposal.destroy();
});

test('reaction motion watch rejects malformed rules before any pair scan', () => {
  const mutations = [
    [0, Number.NaN],
    [1, 1],
    [3, Number.POSITIVE_INFINITY],
    [5, 1e30],
    [6, 1.5],
    [8, Number.NaN]
  ];
  for (const [word, value] of mutations) {
    const device = fakeDevice(0xffff_ffff);
    const encoder = device.createCommandEncoder();
    const inputs = watchInputs(device, encoder);
    const table = reactionTable();
    table.records[word] = value;
    assert.throws(
      () => encodeSphReactionMotionEnvelopeWatchWebGpu({
        device,
        encoder,
        ...inputs,
        reactionTable: table,
        reactionMotionEnvelope: motionEnvelope(),
        particleCount: 2
      }),
      /non-finite motion-watch operand|active motion-watch rule contract/
    );
  }
});

test('Tier0 reaction motion watch construction retires every partial allocation', () => {
  const cases = [
    {
      label: 'readback allocation',
      install(device) {
        const createBuffer = device.createBuffer.bind(device);
        let watchAllocation = 0;
        device.createBuffer = (descriptor) => {
          if (descriptor?.label?.startsWith('ulg-tier0-reaction-motion-watch-')) {
            watchAllocation += 1;
            if (watchAllocation === 2) throw new Error('injected readback allocation failure');
          }
          return createBuffer(descriptor);
        };
      }
    },
    {
      label: 'params allocation',
      install(device) {
        const createBuffer = device.createBuffer.bind(device);
        let watchAllocation = 0;
        device.createBuffer = (descriptor) => {
          if (descriptor?.label?.startsWith('ulg-tier0-reaction-motion-watch-')) {
            watchAllocation += 1;
            if (watchAllocation === 4) throw new Error('injected params allocation failure');
          }
          return createBuffer(descriptor);
        };
      }
    },
    {
      label: 'reaction record write',
      install(device) {
        const writeBuffer = device.queue.writeBuffer.bind(device.queue);
        device.queue.writeBuffer = (buffer, offset, data) => {
          if (buffer?.label === 'ulg-tier0-reaction-motion-watch-records') {
            throw new Error('injected reaction record write failure');
          }
          return writeBuffer(buffer, offset, data);
        };
      }
    }
  ];
  for (const fixture of cases) {
    const device = fakeDevice(0xffff_ffff);
    const encoder = device.createCommandEncoder();
    const inputs = watchInputs(device, encoder);
    fixture.install(device);
    assert.throws(
      () => encodeSphReactionMotionEnvelopeWatchWebGpu({
        device,
        encoder,
        ...inputs,
        reactionTable: reactionTable(),
        reactionMotionEnvelope: motionEnvelope(),
        particleCount: 2
      }),
      /injected/,
      fixture.label
    );
    const watchOwned = device.buffers.filter(({ label }) => (
      label?.startsWith('ulg-tier0-reaction-motion-watch-')
    ));
    assert.ok(watchOwned.length >= 1, fixture.label);
    assert.ok(
      watchOwned.every((buffer) => buffer.destroyed === true),
      fixture.label
    );
    assert.equal(inputs.terminalStateBuffer.destroyed, false, fixture.label);
    assert.equal(inputs.terminalThermoBuffer.destroyed, false, fixture.label);
    assert.equal(inputs.terminalMechanicsBuffer.destroyed, false, fixture.label);
    assert.equal(inputs.neighborBins.binsBuffer.destroyed, false, fixture.label);
  }
});

test('Tier0 reaction motion watch quarantines submitted buffers until exact completion', () => {
  const device = fakeDevice(0xffff_ffff);
  const encoder = device.createCommandEncoder();
  const inputs = watchInputs(device, encoder);
  const proposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2
  });
  device.queue.submit([encoder.finish()]);
  assert.equal(proposal.markSubmittedWork(), true);
  const watchOwned = device.buffers.filter(({ label }) => (
    label?.startsWith('ulg-tier0-reaction-motion-watch-')
  ));
  assert.equal(watchOwned.length, 4);
  assert.equal(proposal.destroy(), false);
  assert.equal(proposal.quarantined, true);
  assert.equal(proposal.released, false);
  assert.equal(device.fences.length, 0);
  assert.ok(watchOwned.every((buffer) => buffer.destroyed === false));
  assert.equal(
    markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted(
      proposal,
      { device }
    ),
    true
  );
  assert.equal(proposal.quarantined, false);
  assert.equal(proposal.released, true);
  assert.ok(watchOwned.every((buffer) => buffer.destroyed === true));
  assert.equal(inputs.terminalStateBuffer.destroyed, false);
  assert.equal(inputs.terminalThermoBuffer.destroyed, false);
  assert.equal(inputs.terminalMechanicsBuffer.destroyed, false);
  assert.equal(device.fences.length, 0);
});

test('Tier0 pending map retires once after destroy and exact caller completion', async () => {
  const device = fakeDevice(0xffff_ffff);
  const map = deferred();
  const encoder = device.createCommandEncoder();
  const inputs = watchInputs(device, encoder);
  const proposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2
  });
  device.queue.submit([encoder.finish()]);
  assert.equal(proposal.markSubmittedWork(), true);
  const watchOwned = device.buffers.filter(({ label }) => (
    label?.startsWith('ulg-tier0-reaction-motion-watch-')
  ));
  const readback = watchOwned.find(({ label }) => (
    label === 'ulg-tier0-reaction-motion-watch-readback'
  ));
  readback.mapAsync = () => map.promise;

  const observation = observeSphReactionMotionEnvelopeWatch(proposal, {
    device
  });
  await Promise.resolve();
  assert.equal(proposal.destroy(), true);
  assert.equal(proposal.released, false);
  assert.ok(watchOwned.every(({ destroyCount }) => !destroyCount));
  assert.equal(
    markSphReactionMotionEnvelopeWatchSubmittedWorkCompleted(
      proposal,
      { device }
    ),
    true
  );
  assert.equal(proposal.released, false);
  assert.ok(watchOwned.every(({ destroyCount }) => !destroyCount));
  map.reject(new Error('Tier0 cancelled map after caller completion'));
  await assert.rejects(observation, /Tier0 cancelled map after caller completion/);
  assert.equal(proposal.released, true);
  assert.equal(proposal.quarantined, false);
  assert.ok(watchOwned.every(({ destroyCount }) => destroyCount === 1));
  assert.equal(device.fences.length, 0);
});

test('Tier0 reaction motion watch fails closed when device loss wins a pending map', async () => {
  let resolveDeviceLost;
  const device = fakeDevice(0);
  const deviceLost = new Promise((resolve) => {
    resolveDeviceLost = resolve;
  });
  let deviceLostListenerCount = 0;
  const deviceLostThen = deviceLost.then.bind(deviceLost);
  deviceLost.then = (...args) => {
    deviceLostListenerCount += 1;
    return deviceLostThen(...args);
  };
  device.lost = deviceLost;
  const retiredEncoder = device.createCommandEncoder();
  const retiredInputs = watchInputs(device, retiredEncoder);
  const retiredProposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder: retiredEncoder,
    ...retiredInputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2
  });
  assert.equal(retiredProposal.destroy(), true);
  const encoder = device.createCommandEncoder();
  const inputs = watchInputs(device, encoder);
  const proposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder,
    ...inputs,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope(),
    particleCount: 2
  });
  device.queue.submit([encoder.finish()]);
  assert.equal(proposal.markSubmittedWork(), true);
  const watchOwned = device.buffers.filter(({ label }) => (
    label?.startsWith('ulg-tier0-reaction-motion-watch-')
  ));
  const readbackBuffer = watchOwned.find(({ label, destroyed }) => (
    label === 'ulg-tier0-reaction-motion-watch-readback'
    && destroyed === false
  ));
  assert.ok(readbackBuffer);
  readbackBuffer.mapAsync = async (mode) => {
    device.mapCalls.push({ buffer: readbackBuffer, mode });
    await new Promise(() => {});
  };

  const observationPromise = observeSphReactionMotionEnvelopeWatch(
    proposal,
    { device }
  );
  await Promise.resolve();
  assert.equal(
    deviceLostListenerCount,
    1,
    'one device-loss listener must serve every live or retired watch'
  );
  resolveDeviceLost({ reason: 'destroyed' });
  await assert.rejects(
    observationPromise,
    (error) => {
      assert.match(error.message, /device was lost while MAP_READ was pending/);
      assert.equal(error.reactionActivationObservationMapAsyncCount, 1);
      return true;
    }
  );
  assert.equal(proposal.released, true);
  assert.ok(watchOwned.every((buffer) => buffer.destroyed === true));
  assert.equal(inputs.terminalStateBuffer.destroyed, false);
  assert.equal(inputs.terminalThermoBuffer.destroyed, false);
  assert.equal(inputs.terminalMechanicsBuffer.destroyed, false);
  assert.equal(inputs.neighborBins.binsBuffer.destroyed, false);
  assert.equal(device.fences.length, 0);
});

test('Tier0 reaction motion watch preserves sentinel when terminal bins are unavailable', async () => {
  const device = fakeDevice(0xffff_ffff);
  const encoder = device.createCommandEncoder();
  const inputs = watchInputs(device);
  const proposal = encodeSphReactionMotionEnvelopeWatchWebGpu({
    device,
    encoder,
    ...inputs,
    neighborBins: null,
    reactionTable: reactionTable(),
    reactionMotionEnvelope: motionEnvelope({
      thermalPhaseEvolutionEnabled: true
    }),
    particleCount: 2
  });
  assert.equal(proposal.dispatchCount, 0);
  assert.equal(proposal.terminalBinsAdmitted, false);
  assert.equal(device.passes.length, 0);
  assert.equal(device.copies.length, 1);
  device.queue.submit([encoder.finish()]);
  proposal.markSubmittedWork();
  const observed = await observeSphReactionMotionEnvelopeWatch(proposal, {
    device
  });
  assert.equal(observed.observationSucceeded, false);
  assert.equal(observed.uncertainty, true);
  assert.equal(observed.triggered, true);
  assert.equal(observed.triggeredSourceCount, null);
  assert.equal(observed.rawEvidenceWord, 0xffff_ffff);
  assert.equal(observed.motionEnvelope.thermalPhaseEvolutionEnabled, true);
  proposal.destroy();
});

test('Tier0 reaction motion watch shader seals overflow and relative pair reach fail closed', () => {
  assert.equal(
    SPH_REACTION_MOTION_ENVELOPE_WATCH_PIPELINE_REVISION,
    'terminal-fixed-carrier-bins-driver-safe-products-sealed-v9'
  );
  assert.match(
    sphReactionMotionEnvelopeWatchPrepareWgsl,
    /expected % first != 0u[\s\S]*after_first % second == 0u[\s\S]*after_first \/ second == third/
  );
  assert.match(
    sphReactionMotionEnvelopeWatchPrepareWgsl,
    /params\.bin_cell_count[\s\S]*> arrayLength\(&terminal_bins\) \/ \(params\.bin_capacity \+ 1u\)/
  );
  assert.doesNotMatch(
    sphReactionMotionEnvelopeWatchPrepareWgsl,
    /0xffffffffu \/ (?:second|third|\(params\.bin_capacity \+ 1u\))/
  );
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /cell_count > params\.bin_capacity/
  );
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /WATCH_BINNED_SOURCE_COUNT_WORD[\s\S]*WATCH_ACTIVE_SOURCE_COUNT_WORD[\s\S]*== atomicLoad/
  );
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /reaction_motion_relative_reach_upper/
  );
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /!reaction_motion_finite\(scan_radius_cells\)[\s\S]*scan_radius_cells >= f32\(params\.max_bin_scan_radius\)[\s\S]*triggered = true/
  );
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /select\(WATCH_ENCODED_FAILURE, count \+ WATCH_COUNT_BIAS, admitted\)/
  );
  assert.match(
    sphReactionMotionEnvelopeWatchWgsl,
    /return terminal_thermo\[thermo_offset\]\.y >= 0\.0/
  );
});
