import { SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_INDEX as I,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_WORDS as WORDS,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_MAGIC as MAGIC,
  SPH_REACTION_PRODUCT_PLACEMENT_RECEIPT_VERSION as VERSION,
  SPH_REACTION_PRODUCT_PLACEMENT_OVERFLOW_FLAGS as FLAGS }
  from '../../../ulg-gpu-abi/src/sphReactionProductPlacementReceipt.js';

/** Numeric evidence consumption in the ORIGINAL receipt. No success/status
 * writer exists here. Original finalize and the sole terminal remain decisive. */
export function createSphExactPlacementChemistryConsumeWgsl(layout) {
  return /* wgsl */ `
struct ChemistryPlacementParams { words: array<vec4<u32>,4> }
@group(0) @binding(0) var<storage,read> chemistry_evidence: array<u32>;
@group(0) @binding(1) var<storage,read> chemistry_metadata: array<u32>;
@group(0) @binding(2) var<storage,read_write> chemistry_control: array<atomic<u32>>;
@group(0) @binding(3) var<storage,read_write> chemistry_receipt: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> chemistry_params: ChemistryPlacementParams;
@compute @workgroup_size(1)
fn consume_exact_chemistry_placement_evidence(@builtin(global_invocation_id) id:vec3<u32>) {
  if(id.x!=0u || id.y!=0u || id.z!=0u) { return; }
  if(arrayLength(&chemistry_receipt)<${WORDS}u) { return; }
  var failed=0u;
  if(arrayLength(&chemistry_evidence)!=${layout.outputWordLength}u
      || arrayLength(&chemistry_metadata)!=${layout.metadataWordLength}u
      || arrayLength(&chemistry_control)!=${layout.controlWordLength}u) { failed=1u; }
  else {
    let prior=atomicAdd(&chemistry_control[9u],1u);
    if(prior!=0u || chemistry_evidence[0u]!=0x58434531u || chemistry_evidence[1u]!=1u
        || chemistry_evidence[2u]!=1u || chemistry_evidence[3u]!=0u
        || chemistry_evidence[4u]!=0u || chemistry_metadata[9u]!=0u
        || chemistry_evidence[4u]!=chemistry_metadata[9u]
        || chemistry_evidence[9u]!=${layout.channelCount}u || chemistry_evidence[10u]!=${layout.pairCapacity}u
        || chemistry_evidence[11u]>${Math.floor(layout.pairCapacity/2)}u
        || chemistry_evidence[12u]!=chemistry_metadata[7u] || chemistry_evidence[13u]!=chemistry_metadata[8u]
        || chemistry_evidence[14u]!=${layout.reactionCount}u || chemistry_evidence[15u]!=${layout.pairCapacity}u
        || chemistry_metadata[0u]!=0x58434231u || chemistry_metadata[1u]!=1u
        || chemistry_metadata[2u]!=${layout.reactionCount}u || chemistry_metadata[6u]!=${layout.metadataWordLength}u
        || atomicLoad(&chemistry_control[0u])!=0u || atomicLoad(&chemistry_control[8u])!=0u
        || atomicLoad(&chemistry_control[1u])!=${layout.pairCapacity}u
        || atomicLoad(&chemistry_control[3u])!=${layout.channelCount}u
        || atomicLoad(&chemistry_control[10u])!=${layout.channelCount}u
        || atomicLoad(&chemistry_control[11u])!=${layout.tileCount}u
        || atomicLoad(&chemistry_control[2u])!=chemistry_evidence[11u]) { failed=1u; }
    for(var i=0u;i<4u;i++) {
      if(chemistry_evidence[5u+i]!=0u || atomicLoad(&chemistry_control[4u+i])!=0u) { failed=1u; }
    }
  }
  if(atomicLoad(&chemistry_receipt[${I.magic}u])!=${MAGIC}u
      || atomicLoad(&chemistry_receipt[${I.version}u])!=${VERSION}u
      || atomicLoad(&chemistry_receipt[${I.generationId}u])!=chemistry_params.words[3].y
      || atomicLoad(&chemistry_receipt[${I.supportProfileId}u])!=chemistry_params.words[3].z
      || chemistry_params.words[0].x!=${layout.pairCapacity}u
      || chemistry_params.words[3].w!=${VERSION}u) { failed=1u; }
  if(failed!=0u) { atomicOr(&chemistry_receipt[${I.overflowFlags}u],${FLAGS.CONSERVATION_MOMENT}u); }
}
`;
}
