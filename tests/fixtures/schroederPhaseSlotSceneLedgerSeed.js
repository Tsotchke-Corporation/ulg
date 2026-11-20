import { buildSphGpuParticleBuffers, buildMlsMpmGpuParticleBuffers } from '../../src/runtime/sph/sphGpuBuffers.js';
import { createSphExactMassFormat, encodeSphExactMass } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { stableOpticalMaterialId } from '../../src/runtime/material/opticalGpuBuffers.js';
import { createIdealGasCaloricThermodynamics, IDEAL_GAS_CALORIC_SCHEMA,
  IDEAL_GAS_CALORIC_ENERGY_BASIS } from '../../src/runtime/material/condensableThermodynamics.js';
import { condensableCaloricSegments } from '../../src/runtime/sph/sphCondensableCaloricTable.js';

// Cold declarations use the production packers and cold ledger compiler.
// No admitted state, stage output, or hot ledger is manufactured on the host.
export const sceneParcelDryMass = Math.fround(1770*4/3*Math.PI*(5e-8)**3*1e12);
export function phaseSlotSceneLedgerSeed(plan, phase, parcels = false, pressure = false) {
  const gasConstant=parcels ? 461.5 : 10, cv=parcels ? 1850 : 10, temperature=parcels ? 300 : 200;
  const phaseCaloricModel = { schema: IDEAL_GAS_CALORIC_SCHEMA,
    energyBasis: IDEAL_GAS_CALORIC_ENERGY_BASIS, provenance: 'manufactured isolated scene gas',
    molarMassKgPerMol: 8.314462618/gasConstant, referenceTemperatureK: temperature, referencePressurePa: 2000,
    referenceSpecificInternalEnergyJPerKg: parcels ? 2500000 : 2000, cvJPerKgK: cv,
    minTemperatureK: 10, maxTemperatureK: 10000, maxPressurePa: 1e7 };
  const rho = condensableCaloricSegments(createIdealGasCaloricThermodynamics(phaseCaloricModel))[0].restDensityKgPerM3;
  const materialProperties = {
    'scene-gas': { molarMassKgPerMol: 8.314462618/gasConstant,
      phases: [{...phase('gas',rho),cpJPerKgK:cv+gasConstant}], transitions: [], phaseCaloricModel },
    'scene-liquid': { molarMassKgPerMol: .018, phases: [phase('liquid',8)], transitions: [] }
  };
  const primary = Array.from({length:9},(_,i)=>({ id: `scene-ledger-${i}`,
    material: i===1 ? 'scene-liquid' : 'scene-gas', massKg: i===0 ? (parcels ? 32 : 2048) : i===1 ? 1 : 0,
    ...(i===1 ? {} : {phaseCaloric:{phaseId:3,phaseFractions:[0,0,1,0]}}),
    x: [i===1 ? 6.5 : 5.5,5.5,5.5], v:[0,0,0],
    specificInternalEnergyJPerKg:parcels ? (i===1 ? 3000 : 2500000) : 2000,
    renderDomainId:100+i, phaseCarrierLineageIndex:i, phaseCarrierLane:0, phaseCarrierPrimaryIndex:i }));
  const companions=[1,2,3].flatMap(lane=>primary.map((p,i)=>({...p,id:`scene-ledger-${i}-${lane}`,
    massKg:0,phaseCompanionSlot:true,phaseCarrierLane:lane,phaseCarrierTargetPhaseId:lane+1,
    phaseVolumeReferenceMassKg:0,mpmVolume0:0,visualRestParticleRadiusM:0})));
  // The scene owns storageGeneration; declaring it here conflicts with that owner.
  const cold={particles:[...primary,...companions],phaseCarrierPlan:plan,
    smoothingLengthM:1,dimension:3,step:0,time:0,topologyEpoch:7};
  if(parcels)cold.ledgerParcels={schema:'peercompute.ulg.sph-ledger-parcels.v1',
    cellsPerAxis:1,boxDimensionsM:[10,10,10],vaporMaterialId:stableOpticalMaterialId('scene-gas'),
    pressurePa:101325,waterReferenceU0:0,parcels:[{x:[5,5,5],multiplicity:1e12,
      densityKgPerM3:1770,hygroscopicity:.61,dryRadiusM:5e-8,
      dryMassWords:Array.from(encodeSphExactMass(sceneParcelDryMass,createSphExactMassFormat()))}]};
  return { materialProperties,
    sph:buildSphGpuParticleBuffers(cold,{materialProperties,
      exactMass:{format:createSphExactMassFormat(),energyLedger:true,reference:'integer scene refinement gate'}}),
    mls:buildMlsMpmGpuParticleBuffers(cold,{materialProperties,particleSeparationRelaxation:0,soundSpeedScale:pressure ? 1 : .01,
      ...(pressure ? {minGasSoundSpeedMPerS:0} : {})}) };
}
