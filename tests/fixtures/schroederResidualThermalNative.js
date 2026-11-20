import { createReferenceMaterialClosures } from '../../src/runtime/material/materialClosures.js';
import { specificInternalEnergyJPerKg } from '../../src/runtime/material/thermoState.js';
import { buildSphThermalMaterialTable, buildSphThermalClosureGraphBuffers, buildSphThermalPhaseResponseTable,
  uploadSphThermalResponseGraphBuffers, destroySphThermalResponseGraphBuffers,
  runSphThermalStepWebGpu, resolveSphThermalSourceCapture } from '../../src/runtime/sph/sphThermalGpuKernel.js';
import { runSchroederSpatialThermalProposalWebGpu } from '../../src/runtime/sph/schroederSpatialThermalProposalsGpu.js';

export function createResidualThermalFixture(device,{radiation=false,conduction=true}={}){
  const base=createReferenceMaterialClosures().h2o.properties;
  const properties={...base,phases:base.phases.map(p=>({...p,thermalConductivityWPerMK:conduction?8000:0,
    thermalConductivityProvenance:{source:'manufactured-residual-conduction-invariant'}}))};
  const table=buildSphThermalMaterialTable({h2o:properties});
  // Cold manufactured conduction isolation: an explicitly non-radiating
  // material. The separate radiation-only case retains derived emissivity.
  if(!radiation){
    for(let row=0;row<table.materialCount;row++)table.records[row*table.recordStrideFloats+4]=0;
    for(const row of table.metadata)row.emissivityGray=0;
  }
  const graph=buildSphThermalClosureGraphBuffers(table);
  const upload=uploadSphThermalResponseGraphBuffers(device,{thermalMaterialTable:table,
    thermalClosureGraphSet:graph,thermalClosureGraphBank:graph.graphBank,
    thermalPhaseResponseTable:buildSphThermalPhaseResponseTable(table,graph)});
  return {table,upload,properties,materialId:table.segmentMetadata[0].materialId,
    energy:temperature=>Math.fround(specificInternalEnergyJPerKg(properties,temperature)),
    destroy(){destroySphThermalResponseGraphBuffers(upload);}};
}

export async function runResidualThermalFixture({device,binding,mechanics,generation,data,kind}){
  // The canonical material law deliberately ignores legacy conductionRate.
  // Isolation is declared by cold conductivity/emissivity, never a hot knob.
  const {g2p,transaction}=mechanics,dt=0.001;
  const proposal=runSchroederSpatialThermalProposalWebGpu({device,generation,
    schroederSpatialEpochTransaction:transaction,...binding,thermalResponseGraphUpload:data.upload,
    dtS:dt,smoothingLengthM:0.5,exactEnergyLedger:true});
  proposal.authorizeQueueOrderedCanonicalApplyRetirement({generation,execution:generation.execution});
  const token={};let result,seal;
  try{
    result=await runSphThermalStepWebGpu({device,sphParticleState:binding.sphParticleState,
      sphParticleUpload:binding.sphParticleUpload,thermalMaterialTable:data.table,thermalResponseGraphUpload:data.upload,
      exactMassG2pResult:g2p,exactMassSpatialEpochTransaction:transaction,exactMassSpatialEpochGeneration:generation,
      postMechanicsSourceCapture:token,sourceStateBuffer:g2p.stateBuffer,sourceThermoBuffer:binding.sphParticleUpload.thermoBuffer,
      proposalStateBuffer:g2p.stateBuffer,proposalThermoBuffer:binding.sphParticleUpload.thermoBuffer,
      schroederSpatialEpochGeneration:generation,schroederSpatialThermalProposal:proposal,
      dtS:dt,smoothingLengthM:0.5,wallRate:0,wallModel:'adiabatic',boxDimsM:[32,32,32],
      retainOutputParticleBuffers:true,readbackMode:'no-full-readback'});
    seal=resolveSphThermalSourceCapture(result,token);
    return {result,token,seal,proposal,destroy(){seal.release();result.destroyOutputParticleBuffers();proposal.abandonPreparedWork();}};
  }catch(error){seal?.release();result?.destroyOutputParticleBuffers();proposal.abandonPreparedWork();throw error;}
}
