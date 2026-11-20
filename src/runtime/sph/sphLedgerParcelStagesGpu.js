import { deferSubmittedWorkCleanup } from '../webgpuComputeLayout.js';
import { createSphExactVaporParcelExchangeStage } from './sphExactVaporParcelLedgerGpu.js';
import { createSphExactParcelTransportStage } from './sphExactParcelTransportLedgerGpu.js';
import { createSphLedgerParcelCaloricStage } from './sphLedgerParcelCaloricGpu.js';

// G2 integer ledger, Phases 4-5 in the live step: after the ledger phase
// transfer and optional refinement, vapor exchange then transport/deposition
// run on the newest successor mass rows and energy record and on its f32
// outputs, in one submission. Both write in place: the successor records are
// not yet handed over, and the parcel family is owned by the carrier owner.
export function prepareSphLedgerParcelStagesWebGpu({ device, parcels, particleCount, dtSeconds,
  stateBuffer, thermoBuffer, mechanicsBuffer, massRead, energy, thermalMaterialTable } = {}) {
  if (!parcels?.count || !(dtSeconds > 0) || !massRead?.buffer || !energy?.energyBuffer
      || massRead.rowCount !== particleCount || energy.rowCount !== particleCount) {
    throw new TypeError('Ledger parcel stages require the parcel family and complete carrier records');
  }
  const box = parcels.boxDimensionsM, axis = parcels.cellsPerAxis;
  if (!box.every(v => Math.abs(v - box[0]) <= 1e-9 * box[0])) {
    throw new TypeError('Ledger parcel stages require cubic gas cells (a cubic box)');
  }
  const cellSizeM = box[0] / axis, dims = [axis, axis, axis];
  const massRange = { offset: massRead.byteOffset, size: massRead.byteLength };
  const exchange = createSphExactVaporParcelExchangeStage({ device, gasCount: particleCount, parcelCount: parcels.count,
    dims, origin: [0, 0, 0], cellSizeM, vaporMaterialId: parcels.vaporMaterialId, pressurePa: parcels.pressurePa,
    waterReferenceU0: parcels.waterReferenceU0, gasStateBuffer: stateBuffer, gasThermoBuffer: thermoBuffer,
    gasMassBuffer: massRead.buffer, gasMassRange: massRange, gasEnergyBuffer: energy.energyBuffer,
    parcelBuffer: parcels.paramsBuffer, parcelLedgerBuffer: parcels.ledgerBuffer, gasMechanicsBuffer: mechanicsBuffer });
  let transport = null, caloric = null;
  try {
    transport = createSphExactParcelTransportStage({ device, carrierCount: particleCount, parcelCount: parcels.count,
      dims, origin: [0, 0, 0], cellSizeM, boxM: box, waterMaterialId: parcels.vaporMaterialId,
      carrierStateBuffer: stateBuffer, carrierThermoBuffer: thermoBuffer, carrierMassBuffer: massRead.buffer,
      carrierMassRange: massRange, carrierEnergyBuffer: energy.energyBuffer, parcelBuffer: parcels.paramsBuffer,
      parcelLedgerBuffer: parcels.ledgerBuffer, sinkBuffer: parcels.sinkBuffer, carrierMechanicsBuffer: mechanicsBuffer });
    caloric = createSphLedgerParcelCaloricStage({device,particleCount,stateBuffer,thermoBuffer,energy,thermalMaterialTable});
    return Object.freeze({ targetBuffer: transport.targetBuffer,
      encode(encoder) {
        exchange.encode(encoder, dtSeconds);
        transport.encode(encoder, dtSeconds);
        caloric.encode(encoder);
      },
      destroy() { for (const stage of [exchange, transport, caloric]) stage?.destroy(); }
    });
  } catch (error) {
    for (const stage of [exchange, transport, caloric]) stage?.destroy();
    throw error;
  }
}

export async function runSphLedgerParcelStagesWebGpu(options) {
  const stage = prepareSphLedgerParcelStagesWebGpu(options);
  try {
    const encoder = options.device.createCommandEncoder({ label: 'ulg-ledger-parcel-stages' });
    stage.encode(encoder);
    options.device.queue.submit([encoder.finish()]);
  } finally {
    void deferSubmittedWorkCleanup(options.device, stage.destroy);
  }
  return true;
}
