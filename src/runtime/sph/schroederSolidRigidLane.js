import { createSchroederSolidFluidContactStage } from './schroederSolidFluidContactGpu.js';
import { createSchroederSolidFluidThermalStage, packSchroederSolidFluidTable } from './schroederSolidFluidThermalGpu.js';
import {
  SCHROEDER_SOLID_BENCHMARK_CONTACT_LAW, SCHROEDER_SOLID_FRAME_WORDS, SCHROEDER_SOLID_LATTICE_FLOATS,
  createSchroederSolidRigidStage, packSchroederSolidContactProxies,
  packSchroederSolidLattice, packSchroederSolidRigidBodies
} from './schroederSolidRigidGpu.js';
import { createSchroederSolidThermalStage, seedSchroederSolidMemberThermal } from './schroederSolidThermalGpu.js';
import { createSchroederSolidReleaseStage } from './schroederSolidReleaseGpu.js';
import { createSchroederSolidFractureStage } from './schroederSolidFractureGpu.js';
import {
  buildSchroederMultilevelProxyCatalog,
  createSchroederSolidMultilevelStage
} from './schroederSolidMultilevelGpu.js';
import {
  SCHROEDER_DEFORMABLE_SOLID_SURFACE_SCHEMA,
  createSchroederDeformableSolidSurfaceStage
} from './schroederSolidDeformableShapeGpu.js';
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
  const maxBodyCapacity = Math.max(packed.bodyCount, Math.trunc(Number(cold.maxBodyCapacity) || packed.bodyCount));
  const minPitch = Math.min(...cold.bodies.flatMap(body => body.pitchByAxisM));
  const { proxies, proxyCount } = packSchroederSolidContactProxies(seeds, { radiusM: 0.5 * minPitch });
  // Size frame & lattice buffers to full maxBodyCapacity so SOL-5 dynamic split
  // body allocations (`allocate_split_bodies`) never write out of bounds.
  const paddedFrames = new Uint8Array(maxBodyCapacity * SCHROEDER_SOLID_FRAME_WORDS * 4);
  paddedFrames.set(new Uint8Array(packed.frames), 0);
  const packedLattice = packSchroederSolidLattice(seeds, cold.bodies.map(b => b.pitchByAxisM));
  const paddedLattice = new Float32Array(maxBodyCapacity * SCHROEDER_SOLID_LATTICE_FLOATS);
  paddedLattice.set(packedLattice, 0);
  const frameBuffer = storage(device, 'ulg-solid-frames', paddedFrames);
  const memberBuffer = storage(device, 'ulg-solid-members', packed.members);
  const proxyBuffer = storage(device, 'ulg-solid-proxies', proxies);
  const latticeBuffer = storage(device, 'ulg-solid-lattice', paddedLattice);
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
    materials: cold.bodies.map(body => body.material),
    sourceBodyIds: cold.bodies.map(body => body.sourceBodyId ?? body.bodyId ?? null),
    bodySizesM: cold.bodies.map(body => Array.isArray(body.sizeM) ? [...body.sizeM] : null),
    fractureOptions: cold.bodies[0].fracture ?? null,
    fractureEnabled: cold.fractureEnabled !== false,
    multilevelEnabled: cold.multilevelEnabled !== false,
    maxBodyCapacity,
    bodyTemperaturesK: cold.bodies.map(body => Number(body.temperatureK) || 293.15),
    thermal, seededThermal, releaseRows, pitchByAxisM: cold.bodies[0].pitchByAxisM,
    // A5 SOL-3: the fluid materials' conductivity/heat capacity rows.
    fluidThermalRows: Array.isArray(cold.fluidThermal) ? cold.fluidThermal : [],
    stage: null, thermalStage: null, releaseStage: null, couplingStage: null, contactStage: null,
    fractureStage: null, multilevelStage: null, multilevelCatalog: null, stageKey: null,
    destroyed: false, steps: 0, releases: 0,
    destroy() {
      if (family.destroyed) return;
      family.destroyed = true;
      if (globalThis.__ulgSolidRigidLane?.family === family) {
        globalThis.__ulgSolidRigidLane.family = null;
      }
      family.stage?.destroy(); family.thermalStage?.destroy(); family.releaseStage?.destroy(); family.couplingStage?.destroy();
      family.contactStage?.destroy(); family.fractureStage?.destroy(); family.multilevelStage?.destroy();
      for (const buffer of [frameBuffer, memberBuffer, proxyBuffer, latticeBuffer, neighborBuffer]) buffer.destroy();
    }
  };
  return family;
}

function tryBuildMultilevelCatalogForBody(bodySizeM, pitchByAxisM) {
  if (!Array.isArray(bodySizeM) || bodySizeM.length !== 3 || !Array.isArray(pitchByAxisM) || pitchByAxisM.length !== 3) {
    return null;
  }
  const finePitchM = Math.min(...pitchByAxisM.map(Number));
  if (!(finePitchM > 0)) return null;
  const halfExtentsM = bodySizeM.map((v) => 0.5 * Number(v));
  if (!halfExtentsM.every((v) => Number.isFinite(v) && v > 0)) return null;
  const counts = halfExtentsM.map((v) => Math.max(4, Math.round((2 * v) / finePitchM)));
  if (!counts.every((c) => c >= 4 && c % 4 === 0)) return null;
  try {
    return buildSchroederMultilevelProxyCatalog({ bodyIndex: 0, halfExtentsM, finePitchM });
  } catch {
    return null;
  }
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
    family.contactStage?.destroy(); family.fractureStage?.destroy(); family.multilevelStage?.destroy();
    family.couplingStage = null;
    family.fractureStage = null;
    family.multilevelStage = null;
    family.multilevelCatalog = null;
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
    // A5 SOL-5: GPU-native cohesive bond cleavage & parallel connected-component
    // topology integrity inside the same single rigid-lane compute pass.
    if (family.fractureEnabled !== false && globalThis.__ulgDisableSol5Fracture !== true) {
      const fOpts = family.fractureOptions ?? {};
      family.fractureStage = createSchroederSolidFractureStage({
        device,
        memberCount: family.memberCount,
        proxyCount: family.proxyCount,
        initialBodyCount: family.bodyCount,
        maxBodyCapacity: family.maxBodyCapacity,
        frameBuffer: family.frameBuffer,
        memberBuffer: family.memberBuffer,
        memberWorldBuffer: family.stage.memberWorldBuffer,
        proxyBuffer: family.proxyBuffer,
        neighborBuffer: family.neighborBuffer,
        latticeBuffer: family.latticeBuffer,
        thermoBuffer: family.thermalStage?.thermoBuffer ?? null,
        pitchM: family.pitchByAxisM,
        tensileStrengthPa: Number(fOpts.tensileStrengthPa) > 0 ? Number(fOpts.tensileStrengthPa) : 1.0e6,
        shearStrengthPa: Number(fOpts.shearStrengthPa) > 0 ? Number(fOpts.shearStrengthPa) : 1.0e6,
        fractureEnergyJPerM2: Number(fOpts.fractureEnergyJPerM2) > 0 ? Number(fOpts.fractureEnergyJPerM2) : 1.0,
        solidBranch: t?.solidBranch ?? { referenceTemperatureK: 250, referenceInternalEnergyJPerKg: 0, cvJPerKgK: 2050, energyMaxJPerKg: 0 },
        materialId: t?.materialId ?? 0
      });
    }
    // A5 SOL-6: GPU-native multilevel 2:1 surface proxy LOD & double-float
    // chart origin tracking inside the same single rigid-lane compute pass.
    if (family.multilevelEnabled !== false && globalThis.__ulgDisableSol6Multilevel !== true) {
      family.multilevelCatalog = tryBuildMultilevelCatalogForBody(family.bodySizesM?.[0], family.pitchByAxisM);
      family.multilevelStage = createSchroederSolidMultilevelStage({
        device,
        bodyCount: family.bodyCount,
        frameBuffer: family.frameBuffer,
        catalog: family.multilevelCatalog
      });
    }
    family.stageKey = key;
  }
  const encoder = device.createCommandEncoder({ label: 'ulg-solid-rigid-lane' });
  // Members melt and release only when a fluid lane receives them this step
  // (the f32 or G2 exact-ledger post-mechanics buffers); otherwise they stay in the body.
  const releaseEnabled = Boolean(fluid?.stateBuffer && fluid?.thermoBuffer && fluid?.mechanicsBuffer && family.releaseStage);
  const couplingEligible = Boolean(releaseEnabled && family.couplingStage && fluid.particleCount > 0);
  const contactEligible = Boolean(fluid?.stateBuffer && fluid?.thermoBuffer && fluid.particleCount > 0);
  const multilevelEligible = Boolean(family.multilevelStage && family.multilevelCatalog?.macroCount > 0);
  const boxCenter = Array.isArray(boxM) && boxM.length === 3 ? boxM.map((v) => 0.5 * Number(v)) : [0, 0, 0];
  const boxSpan = Array.isArray(boxM) && boxM.length === 3 ? Math.max(...boxM.map(Number)) : 1;
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
  family.fractureStage?.prepare?.(dtSeconds);
  if (multilevelEligible) {
    family.multilevelStage.prepareMultilevelProxies({
      focusWorldM: boxCenter,
      fineRadiusM: 0.25 * boxSpan,
      mediumRadiusM: 0.65 * boxSpan
    });
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
  family.fractureStage?.encode(encoder, dtSeconds, { pass, prepared: true, skipIfNoLoads: true });
  if (multilevelEligible) {
    family.multilevelStage.encodeMultilevelProxies(encoder, {
      focusWorldM: boxCenter,
      fineRadiusM: 0.25 * boxSpan,
      mediumRadiusM: 0.65 * boxSpan,
      reflux: true,
      pass,
      prepared: true
    });
  }
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
  globalThis.__ulgA5SolidStatus = Object.freeze({
    active: true,
    rigidBodyCount: family.bodyCount,
    memberCount: family.memberCount,
    steps: family.steps,
    sol4DeformableSurfaceCount: globalThis.__ulgA5SolidStatus?.sol4DeformableSurfaceCount ?? 0,
    sol4Steps: globalThis.__ulgA5SolidStatus?.sol4Steps ?? 0,
    sol5FractureActive: Boolean(family.fractureStage),
    sol6MultilevelActive: Boolean(family.multilevelStage),
    sol6MultilevelProxiesActive: multilevelEligible,
    sol6MacroCount: family.multilevelCatalog?.macroCount ?? 0
  });
  return true;
}

// A5 SOL-4: resident explicit material-space deformable solid surface carriers,
// keyed by upload identity buffer alongside rigid solid families.
const deformableFamiliesByIdentity = new WeakMap();

export function createSchroederDeformableSolidSurfaceFamily(device, cold) {
  if (cold?.schema !== SCHROEDER_DEFORMABLE_SOLID_SURFACE_SCHEMA || !Array.isArray(cold.surfaces) || !cold.surfaces.length) {
    throw new TypeError('Deformable solid surfaces require the schroeder-deformable-solid-surface declaration');
  }
  const entries = cold.surfaces.map((entry) => ({
    bodyId: entry.bodyId,
    domainId: Number.isFinite(Number(entry.domainId)) ? Number(entry.domainId) : null,
    material: entry.material,
    particleRowOffset: Math.max(0, Math.trunc(Number(entry.particleRowOffset) || 0)),
    stage: createSchroederDeformableSolidSurfaceStage({
      device,
      mesh: entry.mesh,
      particleRowOffset: entry.particleRowOffset ?? 0
    })
  }));
  const family = {
    schema: SCHROEDER_DEFORMABLE_SOLID_SURFACE_SCHEMA,
    device,
    entries,
    steps: 0,
    destroyed: false,
    destroy() {
      if (family.destroyed) return;
      family.destroyed = true;
      if (globalThis.__ulgSolidDeformableLane?.family === family) {
        globalThis.__ulgSolidDeformableLane.family = null;
      }
      for (const entry of entries) entry.stage.destroy();
    }
  };
  return family;
}

export function registerSchroederDeformableSolidSurfaceFamily(identityBuffer, family) {
  if (!identityBuffer || !family) return null;
  const existing = deformableFamiliesByIdentity.get(identityBuffer);
  if (existing && !existing.destroyed) return existing;
  deformableFamiliesByIdentity.set(identityBuffer, family);
  finalizer?.register(identityBuffer, family.destroy);
  return family;
}

export function schroederDeformableSolidSurfaceFamilyForUpload(upload) {
  const family = upload?.identityBuffer ? deformableFamiliesByIdentity.get(upload.identityBuffer) : null;
  return family && !family.destroyed ? family : null;
}

export function ensureSchroederDeformableSolidSurfaceFamilyForUpload(upload, cold, device) {
  const existing = schroederDeformableSolidSurfaceFamilyForUpload(upload);
  if (existing || !cold || !upload?.identityBuffer || !device) return existing;
  return registerSchroederDeformableSolidSurfaceFamily(
    upload.identityBuffer,
    createSchroederDeformableSolidSurfaceFamily(device, cold)
  );
}

export function latestSchroederDeformableSolidSurfaceFamily(device) {
  const family = globalThis.__ulgSolidDeformableLane?.family ?? null;
  return family && !family.destroyed && family.device === device ? family : null;
}

export function runSchroederDeformableSolidSurfaceLaneStep(family, { device, stateBuffer, mechanicsBuffer } = {}) {
  if (!family || family.destroyed || !stateBuffer || !mechanicsBuffer) return false;
  if (device !== family.device) throw new TypeError('The deformable solid surface lane must run on its family device');
  const encoder = device.createCommandEncoder({ label: 'ulg-sol4-deformable-surface-lane' });
  const pass = encoder.beginComputePass({ label: 'ulg-sol4-deformable-surface-advect' });
  for (const entry of family.entries) {
    entry.stage.encode(encoder, { stateBuffer, mechanicsBuffer, pass });
  }
  pass.end();
  device.queue.submit([encoder.finish()]);
  family.steps += 1;
  const counters = (globalThis.__ulgSolidDeformableLane ??= { steps: 0, surfaces: 0, family: null });
  counters.steps += 1;
  counters.surfaces = family.entries.length;
  counters.family = family;
  globalThis.__ulgA5SolidStatus = Object.freeze({
    ...(globalThis.__ulgA5SolidStatus ?? {}),
    active: true,
    sol4DeformableSurfaceCount: family.entries.length,
    sol4Steps: family.steps
  });
  return true;
}
