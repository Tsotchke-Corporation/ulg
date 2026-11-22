import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { sphResidentProductHistoryFilteredAppendWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { sphExactRationalQuantityLayout } from './sphExactRationalQuantityWgsl.js';

/** A whole history row travels through the original bounded append arena.
 * Its event projection, exact companion and seven quantities never acquire
 * separate permutations. A power-of-two stride also preserves the existing
 * arena's row alignment when a slot grows or an old branch is copied.
 */
export function sphExactResidentProductHistoryLayout(format, quantityLayout) {
  validateSphExactMassFormat(format);
  const scalar = sphExactRationalQuantityLayout({ wordCount: quantityLayout?.scalar?.wordCount });
  const n = format.wordCount, quantityWords = 16 + n + 7 * scalar.recordWords;
  if (quantityLayout?.headerWords !== 16 || quantityLayout.massOffsetWords !== 16
      || quantityLayout.massWordCount !== n || quantityLayout.scalarOffsetWords !== 16 + n
      || quantityLayout.scalar.recordWords !== scalar.recordWords || quantityLayout.recordWords !== quantityWords) {
    throw new TypeError('Exact history requires the complete original quantity layout');
  }
  const companionWords = 8 + 3 * n, quantityOffsetWords = 32 + companionWords;
  const physicalOffsetWords = quantityOffsetWords + quantityWords, physicalWords = 52;
  let rowWords = 32;
  while (rowWords < physicalOffsetWords + physicalWords) rowWords *= 2;
  if (rowWords > 0x3fffffff) throw new RangeError('Exact history row exceeds word addressing');
  return Object.freeze({ schema: 'peercompute.ulg.exact-product-history-layout.v2', format,
    massWordCount: n, rationalWordCount: scalar.wordCount, scalarWords: scalar.recordWords,
    eventOffsetWords: 0, eventWords: 32, companionOffsetWords: 32, companionWords,
    quantityOffsetWords, quantityWords, massOffsetWords: quantityOffsetWords + 16,
    residualMassOffsetWords: 32 + 8 + 2 * n,
    physicalOffsetWords, physicalWords, stateOffsetWords: physicalOffsetWords,
    thermoOffsetWords: physicalOffsetWords + 8, mechanicsOffsetWords: physicalOffsetWords + 20,
    rowWords, rowBytes: rowWords * 4 });
}

function validateLayout(layout) {
  const n = layout?.massWordCount, r = layout?.rationalWordCount;
  const scalar = sphExactRationalQuantityLayout({ wordCount: r });
  const expected = sphExactResidentProductHistoryLayout(layout?.format, {
    headerWords: 16, massOffsetWords: 16, massWordCount: n, scalarOffsetWords: 16 + n,
    scalar, recordWords: 16 + n + 7 * scalar.recordWords
  });
  if (Object.keys(expected).some(key => layout[key] !== expected[key])) {
    throw new TypeError('Exact history layout was changed');
  }
  return layout;
}

// All accesses are words, including the projected event fields. No mass
// projection decides whether a residual survives. Structural inconsistencies
// fail the complete append; they are never silently filtered out as zero mass.
function rowChecks(l, word) {
  const q = l.quantityOffsetWords, c = l.companionOffsetWords, n = l.massWordCount;
  return /* wgsl */ `
fn exact_history_word(kind:u32,row:u32,word:u32)->u32 { ${word} }
fn exact_history_live(kind:u32,row:u32)->bool {
  var mass=0u;
  for(var i=0u;i<${n}u;i++){mass|=exact_history_word(kind,row,${l.massOffsetWords}u+i);}
  return mass!=0u;
}
fn exact_history_valid(kind:u32,row:u32)->bool {
  let live=exact_history_live(kind,row);
  if(!live){
    // The original selector clears absent rows completely. In particular an
    // invalid active record cannot hide behind a zero projected/quantity mass.
    for(var i=0u;i<${l.rowWords}u;i++){if(exact_history_word(kind,row,i)!=0u){return false;}}
    return true;
  }
  if(exact_history_word(kind,row,${q}u)!=1u || exact_history_word(kind,row,${q+1}u)!=0u
     || exact_history_word(kind,row,${q+5}u)!=2u || exact_history_word(kind,row,${q+9}u)!=${n}u
     || exact_history_word(kind,row,${q+10}u)!=${l.rationalWordCount}u || exact_history_word(kind,row,${q+11}u)!=1u
     || exact_history_word(kind,row,${c+4}u)!=1u || exact_history_word(kind,row,${c+5}u)!=1u
     || exact_history_word(kind,row,${c+6}u)!=0u || exact_history_word(kind,row,${c+7}u)!=0u
     || exact_history_word(kind,row,${q+2}u)!=exact_history_word(kind,row,${c+3}u)
     || exact_history_word(kind,row,${q+7}u)!=exact_history_word(kind,row,${c}u)
     || exact_history_word(kind,row,${q+8}u)!=exact_history_word(kind,row,${c+2}u)) { return false; }
  for(var i=12u;i<16u;i++){if(exact_history_word(kind,row,${q}u+i)!=0u){return false;}}
  for(var i=0u;i<${n}u;i++){
    if(exact_history_word(kind,row,${l.massOffsetWords}u+i)!=exact_history_word(kind,row,${l.residualMassOffsetWords}u+i)){return false;}
  }
  for(var f=0u;f<7u;f++){
    let at=${q+16+n}u+f*${l.scalarWords}u;
    var numerator=0u;var denominator=0u;
    for(var i=0u;i<${l.rationalWordCount}u;i++){
      numerator|=exact_history_word(kind,row,at+4u+i);
      denominator|=exact_history_word(kind,row,at+${4+l.rationalWordCount}u+i);
    }
    if(exact_history_word(kind,row,at)>1u||exact_history_word(kind,row,at+1u)!=0u
       ||exact_history_word(kind,row,at+3u)!=0u||denominator==0u){return false;}
    if(numerator==0u){
      if(exact_history_word(kind,row,at)!=0u||exact_history_word(kind,row,at+2u)!=0u
         ||exact_history_word(kind,row,at+${4+l.rationalWordCount}u)!=1u){return false;}
      for(var i=1u;i<${l.rationalWordCount}u;i++){if(exact_history_word(kind,row,at+${4+l.rationalWordCount}u+i)!=0u){return false;}}
    }else if((exact_history_word(kind,row,at+4u)&1u)==0u
        ||(exact_history_word(kind,row,at+${4+l.rationalWordCount}u)&1u)==0u){return false;}
  }
  for(var i=0u;i<${l.physicalWords}u;i++){
    if((exact_history_word(kind,row,${l.physicalOffsetWords}u+i)&0x7f800000u)==0x7f800000u){return false;}
  }
  for(var axis=0u;axis<3u;axis++){
    if(exact_history_word(kind,row,${l.stateOffsetWords}u+axis)!=exact_history_word(kind,row,axis)){return false;}
  }
  if(exact_history_word(kind,row,${l.thermoOffsetWords}u)!=exact_history_word(kind,row,4u)
     ||exact_history_word(kind,row,${l.thermoOffsetWords+1}u)!=exact_history_word(kind,row,11u)){return false;}
  for(var i=${l.physicalOffsetWords+l.physicalWords}u;i<${l.rowWords}u;i++){if(exact_history_word(kind,row,i)!=0u){return false;}}
  return true;
}
`;
}

export function createSphExactResidentProductHistoryValidationWgsl(layout, bufferName) {
  const l = validateLayout(layout);
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(bufferName)) throw new TypeError('History storage requires a WGSL identifier');
  return rowChecks(l, `return ${bufferName}[row*${l.rowWords}u+word];`);
}

/** Pack only the original selected residual range. The existing count-control
 * ABI carries the same GPU-authored live prefix into history append. */
export function createSphExactResidentProductHistoryPackWgsl(layout, { eventCapacity, particleCount } = {}) {
  const l = validateLayout(layout);
  for (const [key,value] of Object.entries({ eventCapacity, particleCount })) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 0xffffffff) throw new RangeError(`Exact history ${key} must be a positive u32`);
  }
  if (eventCapacity * l.rowWords > 0x3fffffff || (particleCount + eventCapacity) * l.quantityWords > 0x3fffffff) {
    throw new RangeError('Exact history packing exceeds word addressing');
  }
  return /* wgsl */ `
@group(0) @binding(0) var<storage,read> exact_events:array<u32>;
@group(0) @binding(1) var<storage,read> exact_companions:array<u32>;
@group(0) @binding(2) var<storage,read> exact_quantities:array<u32>;
@group(0) @binding(3) var<storage,read> exact_count:array<u32>;
@group(0) @binding(4) var<storage,read_write> exact_rows:array<u32>;
@group(0) @binding(5) var<storage,read_write> exact_control:array<atomic<u32>>;
@group(0) @binding(6) var<storage,read> exact_physical:array<u32>;
${rowChecks(l, `return exact_rows[row*${l.rowWords}u+word];`)}
@compute @workgroup_size(64)
fn pack_exact_product_history(@builtin(global_invocation_id) id:vec3<u32>){
  let row=id.x;if(row>=${eventCapacity}u){return;}
  let base=row*${l.rowWords}u;
  for(var i=0u;i<${l.rowWords}u;i++){exact_rows[base+i]=0u;}
  if(exact_count[0u]>${eventCapacity}u||exact_count[1u]!=0u){atomicOr(&exact_control[11u],1u);return;}
  if(row<exact_count[0u]){
    for(var i=0u;i<32u;i++){exact_rows[base+i]=exact_events[row*32u+i];}
    for(var i=0u;i<${l.companionWords}u;i++){exact_rows[base+${l.companionOffsetWords}u+i]=exact_companions[row*${l.companionWords}u+i];}
    for(var i=0u;i<${l.quantityWords}u;i++){exact_rows[base+${l.quantityOffsetWords}u+i]=exact_quantities[(${particleCount}u+row)*${l.quantityWords}u+i];}
    for(var i=0u;i<${l.physicalWords}u;i++){exact_rows[base+${l.physicalOffsetWords}u+i]=exact_physical[row*${l.physicalWords}u+i];}
    if(!exact_history_live(0u,row)||!exact_history_valid(0u,row)){atomicOr(&exact_control[11u],2u);}
  }else{
    // A nonzero tail must not be silently dropped by the count projection.
    for(var i=0u;i<${l.quantityWords}u;i++){if(exact_quantities[(${particleCount}u+row)*${l.quantityWords}u+i]!=0u){atomicOr(&exact_control[11u],4u);}}
    for(var i=0u;i<32u;i++){if(exact_events[row*32u+i]!=0u){atomicOr(&exact_control[11u],4u);}}
    for(var i=0u;i<${l.companionWords}u;i++){if(exact_companions[row*${l.companionWords}u+i]!=0u){atomicOr(&exact_control[11u],4u);}}
    for(var i=0u;i<${l.physicalWords}u;i++){if(exact_physical[row*${l.physicalWords}u+i]!=0u){atomicOr(&exact_control[11u],4u);}}
  }
  atomicAdd(&exact_control[12u],1u);
}
@compute @workgroup_size(1)
fn seal_exact_product_history(){
  let ready=atomicLoad(&exact_control[11u])==0u&&atomicLoad(&exact_control[12u])==${eventCapacity}u
    &&atomicLoad(&exact_control[6u])>0u&&atomicLoad(&exact_control[7u])>0u;
  let count=select(0u,exact_count[0u],ready);
  atomicStore(&exact_control[0u],0x50484731u);atomicStore(&exact_control[1u],1u);
  atomicStore(&exact_control[2u],select(0x80000000u,1u,ready));atomicStore(&exact_control[3u],count);
  atomicStore(&exact_control[4u],${eventCapacity}u);atomicStore(&exact_control[5u],${l.rowWords/4}u);
  atomicStore(&exact_control[8u],(count+63u)/64u);atomicStore(&exact_control[9u],1u);atomicStore(&exact_control[10u],1u);
}
`;
}

export function createSphExactResidentProductHistorySourceRowChecksWgsl(layout) {
  const l = validateLayout(layout);
  return rowChecks(l, `let at=row*${l.rowWords / 4}u+word/4u;let lane=word%4u;
  if(kind==0u){return source_a_rows[at][lane];}return source_b_rows[at][lane];`);
}

/** Same bounded append/count transaction as the original history owner, with
 * integer liveness and whole-row copies. The emitted source has its own
 * authenticated count; neither its capacity nor its projected mass is live
 * inventory. Malformed sources reject before touching a retained prefix. */
export function createSphExactResidentProductHistoryAppendWgsl(layout) {
  const l = validateLayout(layout);
  let code = sphResidentProductHistoryFilteredAppendWgsl;
  const replace = (from, to) => {
    if (code.split(from).length !== 2) throw new Error('Original history append changed: '+from.slice(0,60));
    code = code.replace(from, to);
  };
  code = code.replaceAll('array<vec4<f32>>', 'array<vec4<u32>>');
  replace('  expected_parent_row_stride_vec4: u32,', `  expected_parent_row_stride_vec4: u32,
  expected_emitted_generation:u32, expected_emitted_seal:u32,
  expected_emitted_capacity:u32, expected_emitted_stride_vec4:u32,
  emitted_source_kind:u32, reserved0:u32, reserved1:u32, reserved2:u32,`);
  replace('const HISTORY_CONTROL_MAGIC:', '@group(0) @binding(6) var<storage,read> emitted_control:array<u32>;\n\nconst HISTORY_CONTROL_MAGIC:');
  const start = code.indexOf('fn history_source_row_live('), end = code.indexOf('\nfn history_fail(', start);
  if (start < 0 || end < start) throw new Error('Original history predicate changed');
  code = code.slice(0,start) + createSphExactResidentProductHistorySourceRowChecksWgsl(l) + `
fn history_source_row_live(kind:u32,row:u32,stride:u32)->bool {return exact_history_live(kind,row);}
fn history_source_row_valid(kind:u32,row:u32,stride:u32)->bool {return exact_history_valid(kind,row);}
` + code.slice(end);
  replace('        let parent_count = parent_control[3u];', `        if(arrayLength(&emitted_control)<12u||emitted_control[0u]!=HISTORY_CONTROL_MAGIC
          ||emitted_control[1u]!=HISTORY_CONTROL_VERSION||emitted_control[2u]!=HISTORY_CONTROL_READY
          ||emitted_control[4u]!=params.expected_emitted_capacity||emitted_control[5u]!=params.expected_emitted_stride_vec4
          ||emitted_control[6u]!=params.expected_emitted_generation||emitted_control[7u]!=params.expected_emitted_seal
          ||emitted_control[3u]>params.expected_emitted_capacity||emitted_control[11u]!=0u
          ||params.row_stride_vec4!=${l.rowWords/4}u||params.expected_emitted_stride_vec4!=${l.rowWords/4}u
          ||params.emitted_source_kind>1u||params.reserved0!=0u||params.reserved1!=0u||params.reserved2!=0u){
          history_fail(HISTORY_ERROR_SOURCE);
          wg_abort = 1u;
        } else {
        let source_b_count=select(params.source_b_row_count,emitted_control[3u],params.emitted_source_kind==1u);
        let parent_count = parent_control[3u];`);
  replace('        let source_a_count = select(', '        let unadjusted_source_a_count = select(');
  replace('        if (\n          source_a_count > arrayLength', `        let source_a_count=select(unadjusted_source_a_count,emitted_control[3u],params.emitted_source_kind==0u);
        if (\n          source_a_count > arrayLength`);
  replace(
    '          wg_capacity = capacity;\n        }\n      }',
    '          wg_capacity = capacity;\n        }\n        }\n      }'
  );
  // Only uses after the declaration change; keep the uniform field and the
  // newly generated select's fallback as their original host upper bound.
  const body = code.indexOf('        let source_a_count=');
  code = code.slice(0,body) + code.slice(body).replaceAll('params.source_b_row_count','source_b_count');
  return code;
}
