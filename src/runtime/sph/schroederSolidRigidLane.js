import { createSchroederSolidFluidContactStage } from './schroederSolidFluidContactGpu.js';
import { createSchroederSolidFluidThermalStage, packSchroederSolidFluidTable } from './schroederSolidFluidThermalGpu.js';
import {
  SCHROEDER_SOLID_BENCHMARK_CONTACT_LAW, createSchroederSolidRigidStage, packSchroederSolidContactProxies,
  packSchroederSolidLattice, packSchroederSolidRigidBodies
} from './schroederSolidRigidGpu.js';
import { createSchroederSolidThermalStage, seedSchroederSolidMemberThermal } from './schroederSolidThermalGpu.js';
import { createSchroederSolidReleaseStage } from './schroederSolidReleaseGpu.js';
import { sphFiniteWallStateFor } from './sphFiniteWallStateGpu.js';

// G3 SOL-1 Phase 3 (plan/todo/g3-solids-proposal.md): coherent rigid bodies in
// the live resident lane.
//
// Cold declaration `peercompute.ulg.schroeder-solid-bodies.v0` (sphPhaseDemo):
//   { schema, bodies: [{ bodyId, sourceBodyId, material, temperatureK,
//     pitchByAxisM, seed }] }
// where `seed` is seedSchroederSolidRigidBody's clone-safe result.
//
// The resident family (frames, members, contact proxies at every member, and
// the voxel shape carriers) lives on the device of the particle upload and is
// keyed by the upload's identity buffer, which every continuation of a scene
// carries unchanged: the rigid lane continues across continuations on every
// route, and a rebuild (new identity buffer) starts a new family. The family
// is destroyed with the identity buffer object (finalization), so it never
// outlives its scene.
export const SCHROEDER_SOLID_BODIES_SCHEMA = 'peercompute.ulg.schroeder-solid-bodies.v0';
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, COPY_SRC: 0x04, COPY_DST: 0x08 });

const familiesByIdentity = new WeakMap();
const finalizer = typeof FinalizationRegistry === 'function'
  ? new FinalizationRegistry(destroy => { try { destroy(); } catch {} }) : null;

function storage(device, label, data) {
  const buffer = device.createBuffer({ label, size: Math.max(16, data.byteLength),
    usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC | GPU_BUFFER_USAGE.COPY_DST });
  device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

/** Build the resident rigid family from the cold declaration. */
export function createSchroederSolidRigidFamily(device, cold) {
  if (cold?.schema !== SCHROEDER_SOLID_BODIES_SCHEMA || !cold.bodies?.length) {
    throw new TypeError('Rigid bodies require the schroeder-solid-bodies declaration');
  }
  const seeds = cold.bodies.map(body => body.seed);
  const counters = (globalThis.__ulgSolidRigidLane ??= { steps: 0, bodies: 0, noFamily: 0, families: 0 });
  counters.families += 1;
  const packed = packSchroederSolidRigidBodies(seeds);
  const minPitch = Math.min(...cold.bodies.flatMap(body => body.pitchByAxisM));
  const { proxies, proxyCount } = packSchroederSolidContactProxies(seeds, { radiusM: 0.5 * minPitch });
  const frameBuffer = storage(device, 'ulg-solid-frames', packed.frames);
  const memberBuffer = storage(device, 'ulg-solid-members', packed.members);
  const proxyBuffer = storage(device, 'ulg-solid-proxies', proxies);
  const latticeBuffer = storage(device, 'ulg-solid-lattice', packSchroederSolidLattice(seeds, cold.bodies.map(b => b.pitchByAxisM)));
  // Thermal state uses the first body's material (one caloric material per
  // family); members of other materials keep their seed u and never release.
  const thermal = cold.bodies[0].thermal ?? null;
  const temperaturesK = cold.bodies.map(body => body.thermal && body.material === cold.bodies[0].material
    ? body.temperatureK : 0);
  const solidBranch = thermal?.solidBranch ?? { referenceTemperatureK: 1, referenceInternalEnergyJPerKg: 0, cvJPerKgK: 1, energyMaxJPerKg: 3.4e38 };
  const seededThermal = seedSchroederSolidMemberThermal({ seeds, pitchByAxisM: cold.bodies.map(b => b.pitchByAxisM),
    temperaturesK: temperaturesK.map(t => t || solidBranch.referenceTemperatureK), solidBranch });
  const neighborBuffer = storage(device, 'ulg-solid-member-neighbors', seededThermal.neighbors);
  // Member -> reserved fluid row (0xffffffff: none).
  const releaseRows = new Uint32Array(packed.memberCount).fill(0xffffffff);
  let offset = 0;
  cold.bodies.forEach(body => {
    body.seed.members.forEach((_, i) => {
      if (Number.isSafeInteger(body.releaseRowStart) && body.thermal) releaseRows[offset + i] = body.releaseRowStart + i;
    });
    offset += body.seed.members.length;
  });
  const family = {
    schema: SCHROEDER_SOLID_BODIES_SCHEMA, device, bodyCount: packed.bodyCount, memberCount: packed.memberCount,
    frameBuffer, memberBuffer, proxyBuffer, latticeBuffer, neighborBuffer, proxyCount,
    materials: cold.bodies.map(body => body.material), thermal, seededThermal, releaseRows, pitchByAxisM: cold.bodies[0].pitchByAxisM,
    // A5 SOL-3: the fluid materials' conductivity/heat capacity rows.
    fluidThermalRows: Array.isArray(cold.fluidThermal) ? cold.fluidThermal : [],
    stage: null, thermalStage: null, releaseStage: null, couplingStage: null, contactStage: null, stageKey: null,
    destroyed: false, steps: 0, releases: 0,
    destroy() {
      if (family.destroyed) return;
      family.destroyed = true;
      if (globalThis.__ulgSolidRigidLane?.family === family) {
        globalThis.__ulgSolidRigidLane.family = null;
      }
      family.stage?.destroy(); family.thermalStage?.destroy(); family.releaseStage?.destroy(); family.couplingStage?.destroy();
      family.contactStage?.destroy();
      for (const buffer of [frameBuffer, memberBuffer, proxyBuffer, latticeBuffer, neighborBuffer]) buffer.destroy();
    }
  };
  return family;
}

/**
 * The most recently stepped live family on `device`, for presentation routes
 * that do not carry the step's upload identity (copy-back frames).
 */
export function latestSchroederSolidRigidFamily(device) {
  const family = globalThis.__ulgSolidRigidLane?.family ?? null;
  return family && !family.destroyed && family.device === device ? family : null;
}

/** Attach a family to the scene identity buffer (once per scene). */
export function registerSchroederSolidRigidFamily(identityBuffer, family) {
  if (!identityBuffer || !family) return null;
  const existing = familiesByIdentity.get(identityBuffer);
  if (existing && !existing.destroyed) return existing;
  familiesByIdentity.set(identityBuffer, family);
  finalizer?.register(identityBuffer, family.destroy);
  return family;
}

/** The live rigid family of an upload (by its identity buffer), or null. */
export function schroederSolidRigidFamilyForUpload(upload) {
  const family = upload?.identityBuffer ? familiesByIdentity.get(upload.identityBuffer) : null;
  return family && !family.destroyed ? family : null;
}

/**
 * The upload's family, created on first use from the cold declaration the
 * resident step receives (sphParticleState.rigidBodies). Lanes that
 * rematerialize adopted storage never call uploadSphGpuParticleBuffers, so
 * the family cannot rely on the upload path.
 */
export function ensureSchroederSolidRigidFamilyForUpload(upload, cold, device) {
  const existing = schroederSolidRigidFamilyForUpload(upload);
  if (existing || !cold || !upload?.identityBuffer || !device) return existing;
  return registerSchroederSolidRigidFamily(upload.identityBuffer, createSchroederSolidRigidFamily(device, cold));
}

/**
 * Advance every rigid body by one resident step: kick (gravity), wall
 * contact, drift, member regeneration and the exact invariant reductions,
 * in one submission on the family's device.
 */
export function runSchroederSolidRigidLaneStep(family, { device, dtSeconds, gravity, boxM, fluid = null } = {}) {
  const counters = (globalThis.__ulgSolidRigidLane ??= { steps: 0, bodies: 0, noFamily: 0, families: 0 });
  if (!family || family.destroyed || !(dtSeconds > 0)) { counters.noFamily += 1; return false; }
  // Diagnostic switch (probe S0_DISABLE_SOLID_LANE): 'all' skips the lane,
  // 'coupling' runs it without the A5 solid-fluid stages.
  const disabled = globalThis.__ulgDisableSolidLane ?? '';
  if (disabled === 'all') { counters.disabled = (counters.disabled ?? 0) + 1; return false; }
  if (disabled === 'coupling') fluid = fluid ? { ...fluid, particleCount: 0 } : fluid;
  if (device !== family.device) throw new TypeError('The rigid lane must run on its family device');
  const key = [...gravity, ...boxM].join(',');
  if (family.stageKey !== key) {
    family.stage?.destroy(); family.thermalStage?.destroy(); family.releaseStage?.destroy(); family.couplingStage?.destroy();
    family.contactStage?.destroy();
    family.couplingStage = null;
    family.stage = createSchroederSolidRigidStage({ device, bodyCount: family.bodyCount,
      memberCount: family.memberCount, frameBuffer: family.frameBuffer, memberBuffer: family.memberBuffer,
      proxyBuffer: family.proxyBuffer, proxyCount: family.proxyCount, gravity, boxM,
      contactLaw: SCHROEDER_SOLID_BENCHMARK_CONTACT_LAW, latticeBuffer: family.latticeBuffer });
    family.thermalStage = null; family.releaseStage = null;
    // A5 SOL-3: two-way member <-> particle contact (fluid particles cannot
    // pass through the body; the reactions move it).
    family.contactStage = createSchroederSolidFluidContactStage({ device, memberCount: family.memberCount,
      bodyCount: family.bodyCount, memberBuffer: family.memberBuffer, memberWorldBuffer: family.stage.memberWorldBuffer,
      frameBuffer: family.frameBuffer, memberRadiusM: 0.5 * Math.min(...family.pitchByAxisM) });
    const t = family.thermal;
    if (t) {
      family.thermalStage = createSchroederSolidThermalStage({ device, memberCount: family.memberCount,
        bodyCount: family.bodyCount, memberBuffer: family.memberBuffer, memberWorldBuffer: family.stage.memberWorldBuffer,
        thermo: family.seededThermal.thermo, neighbors: family.seededThermal.neighbors, neighborBuffer: family.neighborBuffer,
        solidBranch: t.solidBranch, liquidBranch: t.liquidBranch, meltTemperatureK: t.meltTemperatureK,
        solidConductivity: t.solidConductivityWPerMK, liquidConductivity: t.liquidConductivityWPerMK,
        pitchM: family.pitchByAxisM, memberRadiusM: 0.5 * Math.min(...family.pitchByAxisM),
        wallTemperaturesK: t.wallTemperaturesK, boxM,
        // Honest finite walls: the same GPU-resident faces the fluid exchanges with.
        finiteWallState: sphFiniteWallStateFor(device, t.wallReservoirAuthority ?? null) });
      family.releaseStage = createSchroederSolidReleaseStage({ device, memberCount: family.memberCount,
        releaseRows: family.releaseRows, liquidMaterialId: t.materialId, liquidDensityKgPerM3: t.liquidDensityKgPerM3,
        liquidEntitiesPerKg: t.liquidEntitiesPerKg ?? 0,
        releaseEventBuffer: family.thermalStage.releaseEventBuffer, releaseCountBuffer: family.thermalStage.releaseCountBuffer });
      if (family.fluidThermalRows.length) {
        family.couplingStage = createSchroederSolidFluidThermalStage({ device, memberCount: family.memberCount,
          memberBuffer: family.memberBuffer, memberWorldBuffer: family.stage.memberWorldBuffer,
          fluidTable: packSchroederSolidFluidTable(family.fluidThermalRows),
          solidBranch: t.solidBranch, liquidBranch: t.liquidBranch, meltTemperatureK: t.meltTemperatureK,
          solidConductivity: t.solidConductivityWPerMK, liquidConductivity: t.liquidConductivityWPerMK,
          halfPitchM: 0.5 * Math.min(...family.pitchByAxisM) });
      }
    }
    family.stageKey = key;
  }
  const encoder = device.createCommandEncoder({ label: 'ulg-solid-rigid-lane' });
  // Members melt and release only when a fluid lane receives them this step
  // (the f32 or G2 exact-ledger post-mechanics buffers); otherwise they stay in the body.
  const releaseEnabled = Boolean(fluid?.stateBuffer && fluid?.thermoBuffer && fluid?.mechanicsBuffer && family.releaseStage);
  const couplingEligible = Boolean(releaseEnabled && family.couplingStage && fluid.particleCount > 0);
  const contactEligible = Boolean(fluid?.stateBuffer && fluid?.thermoBuffer && fluid.particleCount > 0);
  // Perform ALL uniform writeBuffer updates, buffer clears, and finite-wall
  // temperature copies BEFORE opening the shared compute pass (critical under
  // burst pooled write-through, which encodes writeBuffer as copyBufferToBuffer).
  family.stage.prepare?.(dtSeconds);
  family.thermalStage?.prepare?.(encoder, dtSeconds, { releaseEnabled });
  if (couplingEligible) {
    family.couplingStage.prepare?.(encoder, dtSeconds, {
      particleCount: fluid.particleCount,
      exactEnergyBuffer: fluid.exactEnergyBuffer ?? null,
      exactEnergyRowCount: fluid.exactEnergyRowCount ?? 0
    });
  }
  if (contactEligible) {
    family.contactStage.prepare?.(dtSeconds, { particleCount: fluid.particleCount });
  }
  if (releaseEnabled) {
    family.releaseStage.prepare?.(fluid);
  }
  const pass = encoder.beginComputePass({ label: 'ulg-solid-rigid-lane' });
  family.stage.encode(encoder, dtSeconds, { pass, prepared: true });
  family.thermalStage?.encode(encoder, dtSeconds, { releaseEnabled, pass, prepared: true });
  family.lastReleaseEnabled = releaseEnabled;
  // A5 SOL-3: member <-> SPH particle heat on f32 and G2 exact energy-ledger fluid buffers.
  family.lastCouplingEnabled = couplingEligible
    && family.couplingStage.encode(encoder, dtSeconds, { memberThermoBuffer: family.thermalStage.thermoBuffer,
      fluidStateBuffer: fluid.stateBuffer, fluidThermoBuffer: fluid.thermoBuffer, particleCount: fluid.particleCount,
      exactEnergyBuffer: fluid.exactEnergyBuffer ?? null, exactEnergyRowCount: fluid.exactEnergyRowCount ?? 0,
      pass, prepared: true });
  family.lastContactEnabled = contactEligible
    && family.contactStage.encode(encoder, dtSeconds, { fluidStateBuffer: fluid.stateBuffer,
      fluidThermoBuffer: fluid.thermoBuffer, particleCount: fluid.particleCount, pass, prepared: true });
  if (releaseEnabled) family.releaseStage.encode(encoder, { ...fluid, pass, prepared: true });
  pass.end();
  // Diagnostic (scripts/a1-ab-check.mjs): at step __ulgFingerprintStep, copy
  // the fluid state/thermo and rigid frames in queue order, so an A/B
  // fingerprint is taken at an exact step whatever the pause timing.
  const fingerprintStep = globalThis.__ulgFingerprintStep;
  if (Number.isInteger(fingerprintStep) && family.steps + 1 === fingerprintStep && !counters.fingerprint) {
    const copy = (buffer) => {
      if (!buffer) return null;
      const target = device.createBuffer({ size: buffer.size, usage: 1 | 8 });
      encoder.copyBufferToBuffer(buffer, 0, target, 0, buffer.size);
      return target;
    };
    counters.fingerprint = { step: fingerprintStep, particleCount: fluid?.particleCount ?? null,
      state: copy(fluid?.stateBuffer), thermo: copy(fluid?.thermoBuffer), frames: copy(family.frameBuffer) };
  }
  device.queue.submit([encoder.finish()]);
  family.steps += 1;
  // Diagnostic counters read by scripts/step0-baseline-probe.mjs and
  // scripts/g3-solid-sequence.mjs (frame readback is diagnostic only).
  counters.steps += 1; counters.bodies = family.bodyCount;
  // The fluid buffers this step consumed, held weakly, for an exact fluid
  // fingerprint at a pause (scripts/a1-ab-check.mjs).
  counters.lastFluid = fluid?.stateBuffer ? { state: new WeakRef(fluid.stateBuffer),
    thermo: fluid.thermoBuffer ? new WeakRef(fluid.thermoBuffer) : null, particleCount: fluid.particleCount,
    step: family.steps } : null;
  counters.readFingerprint ??= async () => {
    const fp = counters.fingerprint;
    if (!fp) return null;
    const hash = async (buffer) => {
      if (!buffer) return null;
      await buffer.mapAsync(1);
      const words = new Uint32Array(buffer.getMappedRange().slice(0)); buffer.unmap();
      let h = 0x811c9dc5;
      for (const word of words) for (let k = 0; k < 4; k++) { h ^= (word >>> (8 * k)) & 0xff; h = Math.imul(h, 0x01000193) >>> 0; }
      return { bytes: words.byteLength, hash: h.toString(16) };
    };
    if (!fp.result) {
      fp.result = { step: fp.step, particleCount: fp.particleCount, state: await hash(fp.state),
        thermo: await hash(fp.thermo), frames: await hash(fp.frames) };
    }
    return fp.result;
  };
  counters.readFluidHash ??= async () => {
    const last = counters.lastFluid;
    const live = counters.family;
    const hashBuffer = async (buffer) => {
      if (!buffer || !live || live.destroyed) return null;
      const copy = live.device.createBuffer({ size: buffer.size, usage: 1 | 8 });
      const e = live.device.createCommandEncoder(); e.copyBufferToBuffer(buffer, 0, copy, 0, buffer.size);
      live.device.queue.submit([e.finish()]); await copy.mapAsync(1);
      const words = new Uint32Array(copy.getMappedRange().slice(0)); copy.unmap(); copy.destroy();
      let hash = 0x811c9dc5;
      for (const word of words) for (let k = 0; k < 4; k++) { hash ^= (word >>> (8 * k)) & 0xff; hash = Math.imul(hash, 0x01000193) >>> 0; }
      return { bytes: buffer.size, hash: hash.toString(16) };
    };
    if (!last) return null;
    try {
      return { step: last.step, particleCount: last.particleCount,
        state: await hashBuffer(last.state.deref()), thermo: await hashBuffer(last.thermo?.deref()) };
    } catch (error) { return { step: last.step, error: String(error?.message || error) }; }
  };
  counters.readFrames ??= async () => {
    const live = counters.family;
    if (!live || live.destroyed) return null;
    const copy = live.device.createBuffer({ size: live.frameBuffer.size, usage: 1 | 8 });
    const e = live.device.createCommandEncoder(); e.copyBufferToBuffer(live.frameBuffer, 0, copy, 0, live.frameBuffer.size);
    live.device.queue.submit([e.finish()]); await copy.mapAsync(1);
    const f = Array.from(new Float32Array(copy.getMappedRange().slice(0))); copy.unmap(); copy.destroy();
    // Member masses: alive count and body mass (released members are 0).
    const mcopy = live.device.createBuffer({ size: live.memberBuffer.size, usage: 1 | 8 });
    const e2 = live.device.createCommandEncoder(); e2.copyBufferToBuffer(live.memberBuffer, 0, mcopy, 0, live.memberBuffer.size);
    live.device.queue.submit([e2.finish()]); await mcopy.mapAsync(1);
    const m = new Float32Array(mcopy.getMappedRange().slice(0)); mcopy.unmap(); mcopy.destroy();
    let alive = 0, aliveMass = 0;
    for (let i = 0; i < live.memberCount; i++) if (m[i * 8 + 3] > 0) { alive++; aliveMass += m[i * 8 + 3]; }
    return { steps: live.steps, frames: f, alive, aliveMass, memberCount: live.memberCount,
      thermal: live.thermal ? { solidK: live.thermal.solidConductivityWPerMK, liquidK: live.thermal.liquidConductivityWPerMK,
        walls: live.thermal.wallTemperaturesK } : null, releaseEnabled: live.lastReleaseEnabled ?? null,
      couplingEnabled: live.lastCouplingEnabled ?? null, contactEnabled: live.lastContactEnabled ?? null,
      fluidThermalRows: live.fluidThermalRows.length };
  };
  counters.family = family;
  return true;
}
