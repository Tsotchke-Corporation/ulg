import * as buffers from '../../src/runtime/sph/sphGpuBuffers.js';
import * as steps from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import * as thermal from '../../src/runtime/sph/sphThermalGpuKernel.js';
import * as mechanics from '../../src/runtime/sph/sphMechanicsMaterialTable.js';
import { createReferenceMaterialClosures } from '../../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../../src/runtime/material/thermoState.js';
import { createSphExactMassFormat } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';

// No fake producer registrations: the supplied device runs the actual resident
// mechanics producer and a separately captured actual thermal stage. Node
// ownership tests supply a command recorder; native tests supply real WebGPU.
export async function createExactThermalReactionSourceFixture(device, {
  dtSeconds = .001,
  materialProperties = { fe: createReferenceMaterialClosures().fe.properties },
  initialState = null,
  thermalMaterialTable = thermal.buildSphThermalMaterialTable(materialProperties),
  mechanicsMaterialTable = mechanics.buildMlsMpmMechanicsMaterialTable(materialProperties),
  format = createSphExactMassFormat(),
  thermalStepOptions = {},
  residentStepOptions = {}
} = {}) {
  const initial = initialState ?? {
    smoothingLengthM: .5, dimension: 3, step: 0, time: 0, storageGeneration: 1,
    particles: [{ id: 'exact-source-carrier', material: 'fe', initialBodyDomainId: 1,
      initialBodyId: 'exact-source-body', massKg: .001 * (1 + 2 ** -30),
      x: [.15, 1, 1], v: [.1, 0, 0],
      specificInternalEnergyJPerKg: specificInternalEnergyJPerKg(materialProperties.fe, 300) }]
  };
  const sphParticleState = buffers.buildSphGpuParticleBuffers(initial, { materialProperties,
    exactMass: { format, reference: 'genuine thermal reaction source fixture' } });
  const mlsMpmParticleState = buffers.buildMlsMpmGpuParticleBuffers(initial, { materialProperties,
    particleSeparationRelaxation: 0, soundSpeedScale: .01 });
  const sphParticleUpload = buffers.uploadSphGpuParticleBuffers(device, sphParticleState);
  const mlsMpmParticleUpload = buffers.uploadMlsMpmGpuParticleBuffers(device, mlsMpmParticleState);
  let step = null, thermalResult = null;
  const thermalSourceCapture = Object.freeze({});
  const cleanup = async () => {
    if (thermalResult) {
      thermal.resolveSphThermalSourceCapture(thermalResult, thermalSourceCapture).release();
      thermalResult.destroyOutputParticleBuffers();
    }
    if (step) steps.destroyMlsMpmResidentStepBuffers(step);
    buffers.destroySphGpuParticleBuffers(sphParticleUpload);
    buffers.destroyMlsMpmGpuParticleBuffers(mlsMpmParticleUpload);
    await device.queue.onSubmittedWorkDone();
  };
  try {
    step = await steps.runMlsMpmResidentStepWithOptionalWebGpu({
      device, sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload,
      thermalMaterialTable, mechanicsMaterialTable,
      thermalStepOptions: { conductionRate: 0 }, gridSpacingM: .5, boxDimsM: [2, 2, 2],
      gravityMPerS2: [0, 0, 0], preferWebGpu: true, readbackMode: 'no-full-readback',
      contactSolverEnabled: false, fuseNoFullResidentMechanics: false,
      gasPressureMechanicsBoundaryEnabled: false, summaryRunner: null,
      ...residentStepOptions, dt: dtSeconds
    });
    const g2pResult = step.g2pReconstruction.gpuResult;
    const thermalArgs = { ...thermalStepOptions, device, sphParticleState, sphParticleUpload,
      thermalMaterialTable, exactMassG2pResult: g2pResult,
      exactMassSpatialEpochTransaction: null, exactMassSpatialEpochGeneration: null,
      sourceStateBuffer: g2pResult.stateBuffer, sourceThermoBuffer: sphParticleUpload.thermoBuffer,
      dtS: dtSeconds, conductionRate: thermalStepOptions.conductionRate ?? 0,
      boxDimsM: [2, 2, 2], retainOutputParticleBuffers: true, readbackMode: 'no-full-readback',
      postMechanicsSourceCapture: thermalSourceCapture };
    thermalResult = await thermal.runSphThermalStepWebGpu(thermalArgs);
    const expected = Object.freeze({ device, sphParticleState, sphParticleUpload, mlsMpmParticleUpload,
      thermalMaterialTable, g2pResult, transaction: null, generation: null, dtSeconds });
    return { device, initial, materialProperties, thermalMaterialTable, mechanicsMaterialTable,
      sphParticleState, mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload,
      g2pResult, step, thermalResult, thermalSourceCapture, token: thermalSourceCapture,
      thermalArgs, expected, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
