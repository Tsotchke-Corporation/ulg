import {
  runSphSpatialGasLedgerEosRetainedWebGpu,
  observeSphSpatialGasLedgerEosOracle,
  releaseSphSpatialGasLedgerEosAfterQueue,
  sphSpatialGasLedgerEosPolytopeWgsl,
  SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE
} from '../../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import {
  runSchroederSpatialEpochGenerationWebGpu,
  releaseSchroederSpatialEpochGenerationAfterQueue
} from '../../src/runtime/sph/schroederSpatialEpochGpu.js';
import {
  createSchroederSpatialEpochTransaction,
  abortSchroederSpatialEpochTransaction
} from '../../src/runtime/sph/schroederSpatialEpochTransaction.js';
import {
  registerResidentProductEventCountAuthority,
  createResidentProductEventCountControlWords,
  SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES
} from '../../src/runtime/sph/sphResidentProductHistoryGpu.js';
import {
  tagWebGpuBufferDevice,
  tagResidentProductMassDevice
} from '../../src/runtime/sph/sphGpuDeviceIdentity.js';

export { sphSpatialGasLedgerEosPolytopeWgsl };

export async function runGasPolytopeEosProofNative(device, { feId, n2Id }) {
  const gasOwned = [];
  const gasUpload = (arr, usage = 140) => {
    const b = tagWebGpuBufferDevice(device.createBuffer({ size: arr.byteLength, usage }), device);
    device.queue.writeBuffer(b, 0, arr);
    gasOwned.push(b);
    return b;
  };
  const gasEpochs = {
    storageGeneration: 1, physicsTick: 0, physicsSubstep: 0,
    positionEpoch: 0, topologyEpoch: 0, chartEpoch: 0, levelEpoch: 0, supportEpoch: 0
  };
  const gRows = new Float32Array(16);
  gRows.set([0, 1, 1, 0.001, 0.001, 0.001, 1, 1000, 1, feId, 1, 0.15, 0.5, 0.5, 0.5, 0], 0);
  const gState = new Float32Array([0.5, 0.5, 0.5, 1, 0, 0, 0, 0]);
  const gThermo = new Float32Array([feId, 1, 300, 1000, 1, 0, 0, 0, 1, 1, 1, 0.1]);
  const gMech = new Float32Array(32);
  for (const w of [0, 4, 8, 18, 20, 21, 27, 31]) gMech[w] = 1;
  gMech[19] = 0.001;
  const gAssignBuf = gasUpload(gRows);
  const gStateBuf = gasUpload(gState);
  const gThermoBuf = gasUpload(gThermo);
  const gMechBuf = gasUpload(gMech);
  const gIdBuf = gasUpload(new Uint32Array([101]));
  const gSphUpload = {
    schema: 'peercompute.ulg.sph-gpu-particle-buffer-set.v0', status: 'webgpu-uploaded', particleCount: 1,
    stateBuffer: gStateBuf, stateBufferByteLength: gState.byteLength, stateStrideBytes: 32,
    thermoBuffer: gThermoBuf, thermoBufferByteLength: gThermo.byteLength, thermoStrideBytes: 48,
    identityBuffer: gIdBuf, identityBufferByteLength: 4, identityStrideBytes: 4, identityRevision: 'p3-gas-polytope',
    ...gasEpochs
  };
  const gMpmUpload = {
    schema: 'peercompute.ulg.mls-mpm-gpu-particle-buffer-set.v0', status: 'webgpu-uploaded', particleCount: 1,
    mechanicsBuffer: gMechBuf, mechanicsBufferByteLength: gMech.byteLength, mechanicsStrideBytes: 128,
    ...gasEpochs
  };
  const gLevelAssign = {
    schema: 'peercompute.ulg.schroeder-level-assignment-execution.v0', status: 'schroeder-level-assignment-submitted',
    bufferFamilyGenerationStatus: 'schroeder-particle-buffer-family-generation-ready', particleCount: 1, assignmentStrideFloats: 16,
    assignmentBuffer: gAssignBuf, assignmentBufferByteLength: gRows.byteLength,
    sourceStateBuffer: gStateBuf, sourceStateBufferBorrowed: true, sourceStateBufferByteLength: gState.byteLength,
    sourceThermoBuffer: gThermoBuf, sourceThermoBufferBorrowed: true, sourceThermoBufferByteLength: gThermo.byteLength,
    sourceMechanicsBuffer: gMechBuf, sourceMechanicsBufferBorrowed: true, sourceMechanicsBufferByteLength: gMech.byteLength,
    sourceIdentityBuffer: gIdBuf, sourceIdentityBufferBorrowed: true, sourceIdentityBufferByteLength: 4,
    ...gasEpochs, minLevel: 0, maxLevel: 0, chartId: 0, baseGridSpacingM: 1
  };
  const gMechLevels = [{ selectedLevel: 0, mechanicsGrid: { gridDims: [7, 7, 7], gridNodeCount: 343, gridShift: 2, gridSpacingM: 1, boxDimsM: [2, 2, 2] } }];
  // 1 N2 gas product row in cell (0,0,0) at 300 K with 40.62 mol (~1 atm ideal) and 1.35x nominal mass
  // so real-gas compressibility z_poly = rho_cell / rho_poly(300K, 1atm) is cleanly distinct from 1.0.
  const gMoles = 40.62;
  const gMassKg = gMoles * 0.0280134 * 1.35;
  const gProd = new Float32Array(32);
  gProd.set([0.5, 0.5, 0.5], 0);
  gProd[3] = gMassKg;
  gProd[4] = n2Id;
  gProd[9] = gMoles;
  gProd[10] = 1; // routing = 1 (gas residual)
  gProd[13] = gMassKg; // unplaced mass
  gProd[16] = 300; // temperature K
  gProd[17] = 1.137; // rest density
  gProd[18] = 1; // status = 1
  gProd[23] = 1; // residual volume
  const gProdBuf = gasUpload(gProd);
  const gProdCount = gasUpload(new Uint32Array(SPH_RESIDENT_PRODUCT_EVENT_COUNT_CONTROL_RECORD_BYTES / 4));
  const gResidentProd = {
    schema: 'peercompute.ulg.sph-resident-product-mass.v0', status: 'resident-product-mass-buffer-retained',
    productEventBuffer: gProdBuf, productEventBufferRetained: true, productEventBufferByteLength: gProd.byteLength,
    productEventRowCount: 1, productEventStrideFloats: 32, productEventDevice: device, __ulgActiveBorrowCount: 0
  };
  tagResidentProductMassDevice(gResidentProd, device);
  device.queue.writeBuffer(gProdCount, 0, createResidentProductEventCountControlWords({
    liveRowCount: 1, rowCapacity: 1, rowStrideVec4: 8, generation: 11, seal: 0x5a17c0de
  }));
  registerResidentProductEventCountAuthority(gResidentProd, {
    device, controlBuffer: gProdCount, controlOffsetBytes: 0,
    rowCapacity: 1, rowStrideFloats: 32, generation: 11, seal: 0x5a17c0de
  });
  const gGen = runSchroederSpatialEpochGenerationWebGpu({
    device, levelAssignment: gLevelAssign, particleCount: 1,
    particleIdentityBuffer: gIdBuf, particleIdentityStrideWords: 1,
    mechanicsLevels: gMechLevels, exactNearCellTreeEnabled: false
  });
  const gTx = createSchroederSpatialEpochTransaction({
    device, generation: gGen, sphParticleUpload: gSphUpload, mlsMpmParticleUpload: gMpmUpload,
    mechanicsChainAuthoritative: false, twoLevelAuthoritative: false
  });
  try {
    const gEos = await runSphSpatialGasLedgerEosRetainedWebGpu({
      device, sphParticleUpload: gSphUpload, mlsMpmParticleUpload: gMpmUpload,
      schroederLevelAssignment: gLevelAssign, residentProductMass: gResidentProd,
      productEventBuffer: gProdBuf, productEventRowCount: 1, productEventStrideFloats: 32,
      epochIdentity: gasEpochs, schroederSpatialEpochGeneration: gGen,
      spatialGasGrid: { ...gMechLevels[0].mechanicsGrid, selectedLevel: 0, levelCount: 1 },
      boxMinM: [0, 0, 0], boxMaxM: [2, 2, 2], spatialGasCellSizeM: 1,
      spatialGasSupportVolumeFallbackM3: 0, fallbackTemperatureK: 300, chartId: 0, level: 0,
      diagnosticsMode: SPH_SPATIAL_GAS_DIAGNOSTICS_FULL_ORACLE
    });
    const gOracle = gEos.ready ? await observeSphSpatialGasLedgerEosOracle(gEos) : null;
    const cellVolM3 = gOracle?.pressureCells?.[0]?.volumeM3 ?? 0;
    const gIdealPressurePa = cellVolM3 > 0
      ? (gMoles * 8.31446261815324 * 300) / cellVolM3
      : 0;
    const result = {
      ready: gEos.ready,
      reason: gEos.reason ?? null,
      polytopeHitCount: gOracle?.polytopeHitCount ?? 0,
      polytopeMissCount: gOracle?.polytopeMissCount ?? 0,
      pressurePa: gOracle?.pressureCells?.[0]?.pressurePa ?? 0,
      idealPressurePa: gIdealPressurePa,
      freeVolumeM3: cellVolM3
    };
    if (gEos.ready) {
      releaseSphSpatialGasLedgerEosAfterQueue(gEos);
      await gEos.releasePromise;
    }
    return result;
  } finally {
    abortSchroederSpatialEpochTransaction(gTx);
    await releaseSchroederSpatialEpochGenerationAfterQueue(gGen);
    for (const b of gasOwned) b.destroy();
  }
}
