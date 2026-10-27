import { validateSphExactMassFormat } from '../../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { sphExactReactionSpeciesLayout } from './sphExactReactionSpeciesWgsl.js';
import { sphExactReactionRoutingLayout } from './sphExactReactionRoutingWgsl.js';
import { createSphExactRationalQuantityWgsl, sphExactRationalQuantityLayout } from './sphExactRationalQuantityWgsl.js';

export const SPH_EXACT_CHEMISTRY_EVIDENCE_MAGIC = 0x58434531;
export const SPH_EXACT_CHEMISTRY_EVIDENCE_HEADER = Object.freeze(Object.fromEntries([
  'magic', 'version', 'numericReady', 'error', 'staticBlockerFlags',
  'globalAtomOverCount', 'globalChargeOverCount', 'localAtomOverCount', 'localChargeOverCount',
  'visitedChannels', 'visitedPairSlots', 'executedPairs', 'atomToleranceBits', 'chargeToleranceBits',
  'reactionCount', 'pairCapacity'].map((name, index) => [name, index])));
export const SPH_EXACT_CHEMISTRY_ROW_HEADER = Object.freeze(Object.fromEntries([
  'ready', 'error', 'scope', 'reactionIndex', 'atomicNumber', 'withinBudget', 'executedPairs',
  'visitedPairSlots'].map((name, index) => [name, index])));
export const SPH_EXACT_CHEMISTRY_ERROR = Object.freeze({ DUPLICATE_ENDPOINT: 1048576, INVALID_EVIDENCE: 8192 });
// Each lane owns a complete independent row. Packing arithmetic lanes avoids
// reserving an entire workgroup's private arithmetic storage for a single row.
export const SPH_EXACT_CHEMISTRY_ARITHMETIC_WORKGROUP_SIZE = 32;
const ARITHMETIC_BATCH_ROWS = 2 * SPH_EXACT_CHEMISTRY_ARITHMETIC_WORKGROUP_SIZE;
const checked = (x, name) => {
  if (!Number.isSafeInteger(x) || x < 1 || x > 0x3fffffff) throw new RangeError(`Exact chemistry ${name} exceeds checked addressing`);
  return x;
};
/** Numeric evidence only. Channels0..118 are global; then119 per reaction.
 * Scratch row8: ready,error,executedCount,visitedCount,start,end,channel,level.
 * Final row8: ready,error,scope,reaction-or-INVALID,Z,withinBudget,executed,visited.
 * Both append the unchanged signed ExactRational record. No SAFE/admission bit.
 * No finite limb count is closed under arbitrary cross-reaction denominator
 * growth; overflow remains explicit and must reject the original transaction. */
export function sphExactReactionChemistryBudgetLayout(format, { pairCapacity, reactionCount,
  sourceRecordWords, speciesOffsetWords, speciesLayout, routingLayout, metadataWordLength,
  workWordCount = 3 * format.wordCount + 26, deviceLimits = null, channelTileCapacity = null } = {}) {
  validateSphExactMassFormat(format);
  checked(pairCapacity, 'pairs'); checked(reactionCount, 'reactions'); checked(sourceRecordWords, 'source stride');
  checked(speciesOffsetWords, 'species offset'); checked(metadataWordLength, 'metadata words');
  if (metadataWordLength < 16 + 2 * reactionCount) throw new RangeError('Chemistry metadata header/index capacity missing');
  const species = sphExactReactionSpeciesLayout(format, { termCapacity: speciesLayout?.termCapacity,
    elementCapacity: speciesLayout?.elementCapacity });
  for (const key of Object.keys(species)) if (typeof species[key] === 'number' && species[key] !== speciesLayout[key]) throw new TypeError('Original species layout required');
  const routes = sphExactReactionRoutingLayout(format, { productCapacity: species.termCapacity - 2 });
  for (const key of Object.keys(routes)) if (routes[key] !== routingLayout?.[key]) throw new TypeError('Original routing layout required');
  if (speciesOffsetWords + species.recordWords > sourceRecordWords
      || 12 + 7 * format.wordCount + routes.productCapacity * (4 + 3 * format.wordCount) > speciesOffsetWords) throw new RangeError('Species/source ranges overlap or exceed packet');
  if (workWordCount < species.wideWords) throw new RangeError('Chemistry rational limbs cannot truncate original species magnitudes');
  const scalar = sphExactRationalQuantityLayout({ wordCount: workWordCount });
  const channelCount = checked(119 * (reactionCount + 1), 'channels');
  const recordWords = checked(8 + scalar.recordWords, 'record');
  // The original owner supplies actual device limits. A smaller explicit K is
  // only a public numeric descriptor for arithmetic tests, never owner input.
  const channelBytes = BigInt(pairCapacity) * BigInt(recordWords) * 4n;
  if (deviceLimits !== null) {
    const caps = [deviceLimits.maxBufferSize, deviceLimits.maxStorageBufferBindingSize];
    if (caps.some(value => !Number.isSafeInteger(value) || value < 4)) throw new RangeError('Invalid chemistry device memory limits');
    const byteLimit = BigInt(Math.min(...caps, 0xffff_fffc));
    const maximum = byteLimit / channelBytes;
    const derived = Number(maximum < BigInt(channelCount) ? maximum : BigInt(channelCount));
    if (derived < 1) throw new RangeError('One complete chemistry channel exceeds actual device capacity');
    if (channelTileCapacity !== null && channelTileCapacity !== derived) throw new TypeError('Chemistry tile capacity differs from actual device limits');
    channelTileCapacity = derived;
  }
  channelTileCapacity ??= channelCount;
  checked(channelTileCapacity, 'tile channels');
  if (channelTileCapacity > channelCount) throw new RangeError('Chemistry tile exceeds all channels');
  const tileCount = checked(Math.ceil(channelCount / channelTileCapacity), 'tile count');
  const scratchWordLength = checked(channelTileCapacity * pairCapacity * recordWords, 'scratch arena');
  const outputWordLength = checked(16 + channelCount * recordWords, 'evidence arena');
  const controlWordLength = checked(16 + 5 * pairCapacity + reactionCount, 'validation scratch');
  const levels = Math.ceil(Math.log2(pairCapacity));
  return Object.freeze({ schema: 'peercompute.ulg.exact-chemistry-numeric-evidence.v2',
    pairCapacity, reactionCount, sourceRecordWords, speciesOffsetWords, metadataWordLength, species, routes, scalar,
    channelCount, channelTileCapacity, tileCount, recordWords, scratchWordLength, outputWordLength, controlWordLength, levels,
    sourceWordLength: checked(pairCapacity * sourceRecordWords, 'packet arena'),
    routeWordLength: checked(pairCapacity * routes.recordWords, 'route arena'),
    auxiliaryHeaderWordLength: checked(pairCapacity * 16, 'pair headers'),
    incidenceOffsetWords: 16, pairOffsetWords: 16 + pairCapacity, pairStrideWords: 4,
    reactionCountOffsetWords: 16 + 5 * pairCapacity, outputHeaderWords: 16,
    nextChannelControlIndex: 10, completedTilesControlIndex: 11,
    storageBindingCount: 8, uniformBytes: 32, workgroupSize: 1,
    arithmeticWorkgroupSize: SPH_EXACT_CHEMISTRY_ARITHMETIC_WORKGROUP_SIZE,
    arithmeticBatchRows: ARITHMETIC_BATCH_ROWS });
}
export function planSphExactReactionChemistryBudgetDispatch(layout, { maxComputeWorkgroupsPerDimension,
  maxStorageBufferBindingSize, maxBufferSize, maxStorageBuffersPerShaderStage } = {}) {
  if (!Number.isSafeInteger(maxStorageBuffersPerShaderStage) || maxStorageBuffersPerShaderStage < 8) throw new RangeError('Chemistry requires eight storage bindings');
  const max = checked(maxComputeWorkgroupsPerDimension, 'dispatch limit');
  const byteCapacity = (value, name) => { if (!Number.isSafeInteger(value) || value < 4) throw new RangeError(`Invalid chemistry ${name}`); return value; };
  const byteLimit = Math.min(byteCapacity(maxBufferSize, 'buffer limit'), byteCapacity(maxStorageBufferBindingSize, 'binding limit'), 0xffff_fffc);
  if (!Number.isSafeInteger(layout.channelTileCapacity) || layout.channelTileCapacity < 1
      || layout.channelTileCapacity > layout.channelCount || layout.tileCount !== Math.ceil(layout.channelCount / layout.channelTileCapacity)
      || layout.scratchWordLength !== layout.channelTileCapacity * layout.pairCapacity * layout.recordWords
      || layout.uniformBytes !== 32 || layout.arithmeticWorkgroupSize !== SPH_EXACT_CHEMISTRY_ARITHMETIC_WORKGROUP_SIZE
      || layout.arithmeticBatchRows !== ARITHMETIC_BATCH_ROWS) throw new TypeError('Chemistry tile layout changed');
  for (const key of ['metadataWordLength','sourceWordLength','routeWordLength','auxiliaryHeaderWordLength','scratchWordLength','outputWordLength','controlWordLength']) {
    if (layout[key] * 4 > byteLimit) throw new RangeError(`Chemistry ${key} exceeds actual device capacity`);
  }
  const dispatch = count => { checked(count, 'invocations'); const x = Math.min(count, max), y = Math.ceil(count / x);
    if (y > max || x * y > 0xffffffff) throw new RangeError('Chemistry dispatch exceeds checked x/y capacity');
    return Object.freeze({ x, y, z: 1 }); };
  const arithmeticDispatch = count => dispatch(Math.ceil(checked(count, 'arithmetic rows')
    / SPH_EXACT_CHEMISTRY_ARITHMETIC_WORKGROUP_SIZE));
  const reductions = []; let rows = layout.pairCapacity, span = 1;
  for (let level = 1; rows > 1; level++) { const next = Math.ceil(rows / 2);
    reductions.push(Object.freeze({ params: new Uint32Array([rows, span, level, next]) })); rows = next; span *= 2; }
  const tiles = [];
  for (let ordinal = 0, base = 0; base < layout.channelCount; ordinal++, base += layout.channelTileCapacity) {
    const count = Math.min(layout.channelTileCapacity, layout.channelCount - base);
    const params = first => new Uint32Array([...first, base, count, ordinal, 0]);
    const batches = (rowCount, first) => {
      const result = [];
      for (let rowBase = 0; rowBase < rowCount; rowBase += ARITHMETIC_BATCH_ROWS) {
        const words = params(first); words[7] = rowBase;
        result.push(Object.freeze({ params: words,
          dispatch: arithmeticDispatch(Math.min(ARITHMETIC_BATCH_ROWS, rowCount - rowBase)) }));
      }
      return Object.freeze(result);
    };
    const tileReductions = reductions.map(level => Object.freeze({
      batches: batches(level.params[3] * count, level.params) }));
    tiles.push(Object.freeze({ base, count, ordinal, initialParams: params([0, 0, 0, 0]),
      initialize: dispatch(layout.pairCapacity * count), normalizations: batches(layout.pairCapacity * count, [0, 0, 0, 0]),
      reductions: Object.freeze(tileReductions), comparisons: batches(count, [0, 0, 0, 0]), commit: dispatch(1) }));
  }
  const uniformRecordCount = checked(3 + tiles.reduce((sum, tile) => sum + 2 + tile.normalizations.length
    + tile.reductions.reduce((n, level) => n + level.batches.length, 0) + tile.comparisons.length, 0), 'immutable uniform records');
  return Object.freeze({ reset: dispatch(Math.max(layout.controlWordLength, layout.outputWordLength)),
    validate: dispatch(layout.pairCapacity), tiles: Object.freeze(tiles), finish: dispatch(1),
    initialParams: new Uint32Array(8), uniformRecordCount, finalInputRows: rows });
}

export function createSphExactReactionChemistryBudgetWgsl(format, layout) {
  const l = sphExactReactionChemistryBudgetLayout(format, { ...layout, speciesLayout: layout.species,
    routingLayout: layout.routes, workWordCount: layout.scalar.wordCount });
  if (layout.schema !== l.schema) throw new TypeError('Chemistry layout schema changed');
  for (const [key, value] of Object.entries(l)) {
    if (typeof value === 'number' && value !== layout[key]) throw new TypeError(`Chemistry layout ${key} changed`);
  }
  const p=l.pairCapacity, r=l.reactionCount, n=format.wordCount, w=l.species.wideWords, s=l.species;
  return createSphExactRationalQuantityWgsl({ wordCount: l.scalar.wordCount }) + /* wgsl */ `
const XCB_P: u32 = ${p}u; const XCB_RX: u32 = ${r}u; const XCB_N: u32 = ${n}u;
const XCB_W: u32 = ${w}u; const XCB_R: u32 = ${l.scalar.wordCount}u;
const XCB_C: u32 = ${l.channelCount}u; const XCB_K: u32 = ${l.channelTileCapacity}u;
const XCB_TILES: u32 = ${l.tileCount}u; const XCB_REC: u32 = ${l.recordWords}u;
const XCB_SRC: u32 = ${l.sourceRecordWords}u; const XCB_ROUTE: u32 = ${l.routes.recordWords}u;
const XCB_SPEC: u32 = ${l.speciesOffsetWords}u; const XCB_INVALID: u32 = 0xffffffffu;
const XCB_BAD: u32 = 8192u; const XCB_DUPLICATE: u32 = 1048576u;
struct ExactChemistryParams { input_rows: u32, span: u32, level: u32, output_rows: u32,
  channel_base: u32, channel_count: u32, tile_ordinal: u32, dispatch_base: u32 }
@group(0) @binding(0) var<storage, read> xcb_packet: array<u32>;
@group(0) @binding(1) var<storage, read> xcb_routes: array<u32>;
@group(0) @binding(2) var<storage, read> xcb_aux: array<u32>;
@group(0) @binding(3) var<storage, read> xcb_metadata: array<u32>;
@group(0) @binding(4) var<storage, read_write> xcb_control: array<atomic<u32>>;
@group(0) @binding(5) var<storage, read> xcb_input: array<u32>;
@group(0) @binding(6) var<storage, read_write> xcb_output: array<u32>;
@group(0) @binding(7) var<storage, read_write> xcb_evidence: array<u32>;
@group(0) @binding(8) var<uniform> xcb_params: ExactChemistryParams;
fn xcb_flat(id: vec3<u32>, groups: vec3<u32>) -> u32 { return id.x + id.y * groups.x; }
fn xcb_arithmetic_index(id: vec3<u32>, groups: vec3<u32>, count: u32) -> u32 {
  let base=xcb_params.dispatch_base;
  if(base>=count || base%${ARITHMETIC_BATCH_ROWS}u!=0u || groups.x>2u || groups.y>2u
      || groups.z!=1u || groups.x*groups.y>2u) { xcb_flag(XCB_BAD); return XCB_INVALID; }
  let local=id.x + id.y * groups.x * ${SPH_EXACT_CHEMISTRY_ARITHMETIC_WORKGROUP_SIZE}u;
  if(local>=min(${ARITHMETIC_BATCH_ROWS}u,count-base)) { return XCB_INVALID; }
  return base+local;
}
fn xcb_flag(error: u32) { if (arrayLength(&xcb_control) > 0u) { atomicOr(&xcb_control[0u], error); } }
fn xcb_bounds() -> bool {
  return arrayLength(&xcb_packet) >= ${l.sourceWordLength}u && arrayLength(&xcb_routes) >= ${l.routeWordLength}u
    && arrayLength(&xcb_aux) >= ${l.auxiliaryHeaderWordLength}u && arrayLength(&xcb_metadata) == ${l.metadataWordLength}u
    && arrayLength(&xcb_control) >= ${l.controlWordLength}u
    && arrayLength(&xcb_input) >= ${l.scratchWordLength}u && arrayLength(&xcb_output) >= ${l.scratchWordLength}u
    && arrayLength(&xcb_evidence) >= ${l.outputWordLength}u;
}
fn xcb_tile_ready() -> bool {
  let base=xcb_params.channel_base; let count=xcb_params.channel_count; let ordinal=xcb_params.tile_ordinal;
  if (base>=XCB_C || count==0u || count>XCB_K || base%XCB_K!=0u
      || count!=min(XCB_K,XCB_C-base) || ordinal!=base/XCB_K
      || atomicLoad(&xcb_control[10u])!=base || atomicLoad(&xcb_control[11u])!=ordinal) {
    xcb_flag(XCB_BAD); return false;
  }
  return true;
}
fn xcb_metadata_ready() -> bool {
  if (xcb_metadata[0u] != 0x58434231u || xcb_metadata[1u] != 1u || xcb_metadata[2u] != XCB_RX
    || xcb_metadata[3u] != XCB_N || xcb_metadata[4u] != XCB_W || xcb_metadata[5u] != 16u
    || xcb_metadata[6u] != arrayLength(&xcb_metadata) || xcb_metadata[7u] >= 0x7f800000u
    || xcb_metadata[8u] >= 0x7f800000u) { return false; }
  for (var i=10u;i<16u;i++) { if (xcb_metadata[i] != 0u) { return false; } }
  return true;
}
fn xcb_block(rx: u32) -> u32 {
  if (rx >= XCB_RX) { return XCB_INVALID; }
  let at=xcb_metadata[16u+2u*rx]; let size=xcb_metadata[17u+2u*rx];
  if (at < ${16+2*r}u || at > arrayLength(&xcb_metadata) || size < 16u || size > arrayLength(&xcb_metadata)-at) { return XCB_INVALID; }
  let terms=xcb_metadata[at+4u]; let elements=xcb_metadata[at+5u];
  if (terms<3u || terms>${s.termCapacity}u || elements==0u || elements>${s.elementCapacity}u) { return XCB_INVALID; }
  let term_offset=16u+2u*XCB_W;
  if(size<term_offset || terms>(size-term_offset)/(4u+XCB_W)) { return XCB_INVALID; }
  let element_offset=term_offset+terms*(4u+XCB_W);
  if(elements>(size-element_offset)/4u) { return XCB_INVALID; }
  let weights=element_offset+elements*4u;
  if(terms>(size-weights)/(XCB_W+2u)) { return XCB_INVALID; }
  let element_weight_words=terms*(XCB_W+2u);
  if(elements!=(size-weights)/element_weight_words || (size-weights)%element_weight_words!=0u) { return XCB_INVALID; }
  if (xcb_metadata[at]!=0x4552504du || xcb_metadata[at+1u]!=1u || xcb_metadata[at+2u]!=XCB_N || xcb_metadata[at+3u]!=XCB_W
      || xcb_metadata[at+6u]!=term_offset || xcb_metadata[at+7u]!=4u+XCB_W || xcb_metadata[at+8u]!=element_offset
      || xcb_metadata[at+9u]!=4u || xcb_metadata[at+10u]!=weights || xcb_metadata[at+11u]!=XCB_W+2u
      || xcb_metadata[at+12u]!=16u || xcb_metadata[at+13u]!=16u+XCB_W
      || size!=weights+elements*terms*(XCB_W+2u)) { return XCB_INVALID; }
  return at;
}
fn xcb_pair_at(pair:u32)->u32 { return ${l.pairOffsetWords}u+pair*4u; }
fn xcb_pair_fail(pair:u32,error:u32) { let at=xcb_pair_at(pair); atomicStore(&xcb_control[at],2u); atomicStore(&xcb_control[at+3u],error); xcb_flag(error); }
@compute @workgroup_size(1)
fn reset_exact_chemistry_evidence(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  let i=xcb_flat(id,groups);
  if(i<${l.controlWordLength}u && i<arrayLength(&xcb_control)) { atomicStore(&xcb_control[i],0u); }
  if(i<${l.outputWordLength}u && i<arrayLength(&xcb_evidence)) { xcb_evidence[i]=0u; }
}
@compute @workgroup_size(1)
fn validate_exact_chemistry_pairs(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  let pair=xcb_flat(id,groups); if(pair>=XCB_P) { return; }
  if(!xcb_bounds()) { xcb_flag(XCB_BAD); return; }
  atomicAdd(&xcb_control[1u],1u);
  if(!xcb_metadata_ready()) { xcb_pair_fail(pair,XCB_BAD); return; }
  let a=pair*16u; let source=pair*XCB_SRC; let route=pair*XCB_ROUTE;
  // Rejected and skipped staging has a completely zero header except error1.
  if(xcb_aux[a]==0u) {
    for(var i=2u;i<16u;i++) { if(xcb_aux[a+i]!=0u) { xcb_pair_fail(pair,XCB_BAD); return; } }
    if(xcb_aux[a+1u]==0u && (xcb_routes[route]!=0u || xcb_routes[route+1u]!=0u || xcb_packet[source]!=0u || xcb_packet[source+1u]!=0u)) { xcb_pair_fail(pair,XCB_BAD); }
    return;
  }
  let peer=xcb_aux[a+3u]; let rx=xcb_aux[a+4u]; let products=xcb_aux[a+5u]; let spec=source+XCB_SPEC;
  var error=0u;
  if(xcb_aux[a]!=1u || xcb_aux[a+1u]!=0u || xcb_aux[a+2u]!=pair || peer<=pair || peer>=XCB_P
    || rx>=XCB_RX || products==0u || products>${l.routes.productCapacity}u || xcb_aux[a+6u]!=0u || (xcb_aux[a+7u]&~32u)!=0u
    || xcb_routes[route]!=1u || xcb_routes[route+1u]!=0u || xcb_routes[route+2u]!=pair || xcb_routes[route+3u]!=peer
    || xcb_routes[route+4u]!=rx || xcb_routes[route+5u]!=products || xcb_routes[route+8u]!=0u
    || xcb_packet[source]!=1u || xcb_packet[source+1u]!=0u || xcb_packet[source+4u]!=rx || xcb_packet[source+5u]!=products
    || xcb_packet[source+11u]!=0u || min(xcb_packet[source+2u],xcb_packet[source+3u])!=pair
    || max(xcb_packet[source+2u],xcb_packet[source+3u])!=peer) { error|=XCB_BAD; }
  for(var i=8u;i<16u;i++) { if(xcb_aux[a+i]!=0u) { error|=XCB_BAD; } }
  for(var i=9u;i<16u;i++) { if(xcb_routes[route+i]!=0u) { error|=XCB_BAD; } }
  if(error!=0u) { xcb_pair_fail(pair,error); return; }
  let term_metadata=xcb_block(rx); if(term_metadata==XCB_INVALID) { xcb_pair_fail(pair,XCB_BAD); return; }
  let terms=xcb_metadata[term_metadata+4u]; let elements=xcb_metadata[term_metadata+5u];
  if(terms!=products+2u || xcb_packet[spec]!=1u || xcb_packet[spec+1u]!=0u || xcb_packet[spec+2u]!=terms
    || xcb_packet[spec+3u]!=elements || xcb_packet[spec+4u]!=xcb_metadata[term_metadata+14u] || xcb_packet[spec+5u]!=xcb_metadata[term_metadata+15u]
    || xcb_packet[spec+7u]!=${s.termCapacity}u || xcb_packet[spec+8u]!=${s.elementCapacity}u) { error|=XCB_BAD; }
  for(var i=9u;i<16u;i++) { if(xcb_packet[spec+i]!=0u) { error|=XCB_BAD; } }
  var denominator_nonzero=0u;
  for(var field=0u;field<2u;field++) {
    let dest=spec+16u+field*(XCB_W+2u); let original=term_metadata+16u+field*XCB_W;
    if(xcb_packet[dest]!=0u || xcb_packet[dest+1u]!=0u) { error|=XCB_BAD; }
    for(var i=0u;i<XCB_W;i++) { if(xcb_packet[dest+2u+i]!=xcb_metadata[original+i]) { error|=XCB_BAD; } if(field==0u) { denominator_nonzero|=xcb_packet[dest+2u+i]; } }
  }
  if(denominator_nonzero==0u) { error|=4096u; }
  for(var term=0u;term<terms;term++) {
    let expected=term_metadata+xcb_metadata[term_metadata+6u]+term*(4u+XCB_W);
    let row=spec+${s.termOffsetWords}u+term*${s.termStrideWords}u;
    if(xcb_packet[row]!=xcb_metadata[expected] || xcb_packet[row+1u]!=xcb_metadata[expected+1u]
      || xcb_packet[row+2u]!=xcb_metadata[expected+2u] || xcb_packet[row+5u]!=xcb_metadata[expected+3u]
      || xcb_packet[row+12u]!=0u || xcb_packet[row+14u]!=0u || xcb_packet[row+15u]!=0u) { error|=XCB_BAD; }
    var selected=source+12u+(term+1u)*XCB_N;
    if(term<2u) { if(xcb_packet[row+7u]!=xcb_packet[source+2u+term]) { error|=XCB_BAD; } }
    else {
      let product=source+12u+7u*XCB_N+(term-2u)*(4u+3u*XCB_N); selected=product+4u;
      let fragment=route+${l.routes.residualOffsetWords}u+(term-2u)*${l.routes.residualStrideWords}u;
      if(xcb_packet[product]!=xcb_packet[row+1u] || xcb_packet[product+1u]!=xcb_packet[row+2u]
        || xcb_packet[product+2u]!=xcb_packet[row+3u] || xcb_packet[product+3u]!=0u || xcb_packet[row+7u]!=XCB_INVALID
        || xcb_routes[fragment]!=pair || xcb_routes[fragment+1u]!=term || xcb_routes[fragment+2u]!=xcb_packet[row+1u]
        || xcb_routes[fragment+3u]!=xcb_packet[row+2u]) { error|=XCB_BAD; }
    }
    var nonzero=0u;
    for(var i=0u;i<XCB_N;i++) { nonzero|=xcb_packet[selected+i]; if(xcb_packet[selected+i]!=xcb_packet[row+16u+i]) { error|=XCB_BAD; } }
    if(xcb_packet[row+4u]!=select(0u,1u,nonzero!=0u)) { error|=XCB_BAD; }
  }
  var previous=0u; var all_zero=1u;
  for(var element=0u;element<elements;element++) {
    let expected=term_metadata+xcb_metadata[term_metadata+8u]+element*4u;
    let row=spec+${s.elementOffsetWords}u+element*${s.elementStrideWords}u; let z=xcb_packet[row];
    if(z!=xcb_metadata[expected] || z>118u || (element==0u && z!=0u) || (element>0u && z<=previous)
      || xcb_packet[row+1u]!=0u || xcb_packet[row+3u]!=0u || xcb_packet[row+4u]>1u || xcb_packet[row+5u]!=0u) { error|=XCB_BAD; }
    previous=z; var nonzero=0u; for(var i=0u;i<XCB_W;i++) { nonzero|=xcb_packet[row+6u+i]; }
    let zero=select(0u,1u,nonzero==0u); if(xcb_packet[row+2u]!=zero || (zero==1u && xcb_packet[row+4u]!=0u)) { error|=XCB_BAD; }
    all_zero&=zero;
  }
  if(xcb_packet[spec+6u]!=all_zero) { error|=XCB_BAD; }
  if(error!=0u) { xcb_pair_fail(pair,error); return; }
  let seen_pair=atomicAdd(&xcb_control[16u+pair],1u); let seen_peer=atomicAdd(&xcb_control[16u+peer],1u);
  if(seen_pair!=0u || seen_peer!=0u) { xcb_flag(XCB_DUPLICATE); }
  let at=xcb_pair_at(pair); atomicStore(&xcb_control[at],1u); atomicStore(&xcb_control[at+1u],rx); atomicStore(&xcb_control[at+2u],peer);
  atomicAdd(&xcb_control[2u],1u); atomicAdd(&xcb_control[${l.reactionCountOffsetWords}u+rx],1u);
}
fn xcb_store(at:u32,value:ExactRational) {
  xcb_output[at]=value.negative; xcb_output[at+1u]=value.error; xcb_output[at+2u]=bitcast<u32>(value.exponent); xcb_output[at+3u]=value.reserved;
  for(var i=0u;i<XCB_R;i++) { xcb_output[at+4u+i]=value.numerator[i]; xcb_output[at+4u+XCB_R+i]=value.denominator[i]; }
}
fn xcb_load(at:u32)->ExactRational {
  var value=xr_zero(); value.negative=xcb_input[at]; value.error=xcb_input[at+1u]; value.exponent=bitcast<i32>(xcb_input[at+2u]); value.reserved=xcb_input[at+3u];
  for(var i=0u;i<XCB_R;i++) { value.numerator[i]=xcb_input[at+4u+i]; value.denominator[i]=xcb_input[at+4u+XCB_R+i]; } return xr_normalize(value);
}
@compute @workgroup_size(1)
fn initialize_exact_chemistry_residuals(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  if(!xcb_bounds()) { xcb_flag(XCB_BAD); return; }
  if(xcb_params.dispatch_base!=0u) { xcb_flag(XCB_BAD); return; }
  if(!xcb_tile_ready()) { return; }
  let index=xcb_flat(id,groups); if(index>=xcb_params.channel_count*XCB_P) { return; }
  let channel=xcb_params.channel_base+index/XCB_P; let pair=index%XCB_P; let group=channel/119u; let z=channel%119u; let at=index*XCB_REC;
  let pair_at=xcb_pair_at(pair); let state=atomicLoad(&xcb_control[pair_at]); let rx=atomicLoad(&xcb_control[pair_at+1u]);
  let contributes=state==1u && (group==0u || group==rx+1u); var value=xr_zero();
  if(state==2u) { value=xr_failure(atomicLoad(&xcb_control[pair_at+3u])); }
  if(contributes) {
    let spec=pair*XCB_SRC+XCB_SPEC;
    for(var element=0u;element<xcb_packet[spec+3u];element++) {
      let row=spec+${s.elementOffsetWords}u+element*${s.elementStrideWords}u;
      if(xcb_packet[row]!=z) { continue; }
      // The validated pair checked every numerator limb, the zero sign and
      // the nonzero denominator. Its zero residual is already xr_zero().
      if(xcb_packet[row+2u]==1u) { break; }
      value.negative=xcb_packet[row+4u]; value.error=xcb_packet[row+5u]; value.exponent=bitcast<i32>(xcb_packet[spec+5u]);
      for(var i=0u;i<XCB_W;i++) { value.numerator[i]=xcb_packet[row+6u+i]; value.denominator[i]=xcb_packet[spec+18u+i]; }
      break;
    }
  }
  // Raw rows are pending (2), never the ready (1) consumed by reductions.
  xcb_output[at]=select(2u,0u,value.error!=0u); xcb_output[at+1u]=value.error; xcb_output[at+2u]=select(0u,1u,contributes);
  xcb_output[at+3u]=1u; xcb_output[at+4u]=pair; xcb_output[at+5u]=pair; xcb_output[at+6u]=channel; xcb_output[at+7u]=0u;
  xcb_store(at+8u,value); if(value.error!=0u) { xcb_flag(value.error); }
}
@compute @workgroup_size(${SPH_EXACT_CHEMISTRY_ARITHMETIC_WORKGROUP_SIZE})
fn normalize_exact_chemistry_residuals(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  if(!xcb_bounds()) { xcb_flag(XCB_BAD); return; }
  if(!xcb_tile_ready()) { return; }
  let index=xcb_arithmetic_index(id,groups,xcb_params.channel_count*XCB_P); if(index==XCB_INVALID) { return; }
  let at=index*XCB_REC; let pair=index%XCB_P; let channel=xcb_params.channel_base+index/XCB_P;
  var error=xcb_input[at+1u];
  if(xcb_input[at]!=select(2u,0u,error!=0u) || xcb_input[at+2u]>1u || xcb_input[at+3u]!=1u
    || xcb_input[at+4u]!=pair || xcb_input[at+5u]!=pair || xcb_input[at+6u]!=channel || xcb_input[at+7u]!=0u) { error|=XCB_BAD; }
  var value=xcb_load(at+8u); error|=value.error;
  if(error!=0u) { value=xr_failure(error); xcb_flag(error); }
  xcb_output[at]=select(1u,0u,error!=0u); xcb_output[at+1u]=error;
  for(var i=2u;i<8u;i++) { xcb_output[at+i]=xcb_input[at+i]; }
  xcb_store(at+8u,value);
}
fn xcb_node_error(at:u32,channel:u32,start:u32,end:u32,level:u32)->u32 {
  var error=xcb_input[at+1u];
  if(xcb_input[at]!=1u || xcb_input[at+3u]!=end-start+1u || xcb_input[at+4u]!=start
    || xcb_input[at+5u]!=end || xcb_input[at+6u]!=channel || xcb_input[at+7u]!=level
    || xcb_input[at+2u]>xcb_input[at+3u]) { error|=XCB_BAD; } return error;
}
@compute @workgroup_size(${SPH_EXACT_CHEMISTRY_ARITHMETIC_WORKGROUP_SIZE})
fn reduce_exact_chemistry_residuals(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  if(!xcb_bounds()) { xcb_flag(XCB_BAD); return; }
  if(!xcb_tile_ready()) { return; }
  let rows=xcb_params.input_rows; let span=xcb_params.span; let level=xcb_params.level; let next=xcb_params.output_rows;
  if(rows==0u || rows>XCB_P || span==0u || span>XCB_P || (span&(span-1u))!=0u || level==0u || level>${l.levels}u
    || span!=(1u<<(level-1u)) || rows!=(XCB_P+span-1u)/span || next!=(rows+1u)/2u) { xcb_flag(XCB_BAD); return; }
  let index=xcb_arithmetic_index(id,groups,xcb_params.channel_count*next); if(index==XCB_INVALID) { return; }
  let local_channel=index/next; let channel=xcb_params.channel_base+local_channel;
  let row=index%next; let left=(local_channel*XCB_P+row*2u)*XCB_REC;
  let dest=(local_channel*XCB_P+row)*XCB_REC; let start=row*2u*span; let middle=min(start+span-1u,XCB_P-1u); let end=min(start+2u*span-1u,XCB_P-1u);
  var error=xcb_node_error(left,channel,start,middle,level-1u); var value=xcb_load(left+8u); var executed=xcb_input[left+2u];
  if(row*2u+1u<rows) { let right=left+XCB_REC; error|=xcb_node_error(right,channel,middle+1u,end,level-1u);
    value=xr_add(value,xcb_load(right+8u)); executed+=xcb_input[right+2u]; }
  error|=value.error; if(error!=0u) { value=xr_failure(error); xcb_flag(error); }
  xcb_output[dest]=select(1u,0u,error!=0u); xcb_output[dest+1u]=error; xcb_output[dest+2u]=executed;
  xcb_output[dest+3u]=end-start+1u; xcb_output[dest+4u]=start; xcb_output[dest+5u]=end; xcb_output[dest+6u]=channel; xcb_output[dest+7u]=level; xcb_store(dest+8u,value);
}
@compute @workgroup_size(${SPH_EXACT_CHEMISTRY_ARITHMETIC_WORKGROUP_SIZE})
fn compare_exact_chemistry_budgets(@builtin(global_invocation_id) id:vec3<u32>,@builtin(num_workgroups) groups:vec3<u32>) {
  if(!xcb_bounds()) { xcb_flag(XCB_BAD); return; }
  if(!xcb_tile_ready()) { return; }
  let local_channel=xcb_arithmetic_index(id,groups,xcb_params.channel_count); if(local_channel==XCB_INVALID) { return; }
  let channel=xcb_params.channel_base+local_channel;
  if(!xcb_metadata_ready()) { atomicOr(&xcb_control[8u],XCB_BAD); return; }
  let group=channel/119u; let z=channel%119u; let source=local_channel*XCB_P*XCB_REC; let dest=16u+channel*XCB_REC;
  let expected=select(atomicLoad(&xcb_control[2u]),atomicLoad(&xcb_control[${l.reactionCountOffsetWords}u+max(group,1u)-1u]),group!=0u);
  var error=xcb_node_error(source,channel,0u,XCB_P-1u,${l.levels}u)|atomicLoad(&xcb_control[0u]);
  if(xcb_input[source+2u]!=expected || atomicLoad(&xcb_control[1u])!=XCB_P) { error|=XCB_BAD; }
  let value=xcb_load(source+8u); var magnitude=value; magnitude.negative=0u;
  let tolerance=xr_from_f32_bits(select(xcb_metadata[7u],xcb_metadata[8u],z==0u));
  let difference=xr_subtract(magnitude,tolerance); error|=value.error|difference.error;
  var nonzero=0u; for(var i=0u;i<XCB_R;i++) { nonzero|=difference.numerator[i]; }
  let within=error==0u && (difference.negative==1u || nonzero==0u);
  xcb_evidence[dest]=select(1u,0u,error!=0u); xcb_evidence[dest+1u]=error; xcb_evidence[dest+2u]=select(0u,1u,group!=0u);
  xcb_evidence[dest+3u]=select(XCB_INVALID,group-1u,group!=0u); xcb_evidence[dest+4u]=z;
  xcb_evidence[dest+5u]=select(0u,1u,within); xcb_evidence[dest+6u]=expected; xcb_evidence[dest+7u]=XCB_P;
  xcb_evidence[dest+8u]=value.negative; xcb_evidence[dest+9u]=value.error; xcb_evidence[dest+10u]=bitcast<u32>(value.exponent); xcb_evidence[dest+11u]=value.reserved;
  for(var i=0u;i<XCB_R;i++) { xcb_evidence[dest+12u+i]=value.numerator[i]; xcb_evidence[dest+12u+XCB_R+i]=value.denominator[i]; }
  // control[0] is immutable throughout this dispatch: comparison-local errors
  // aggregate separately so one channel cannot race another channel's evidence.
  if(error!=0u) { atomicOr(&xcb_control[8u],error); }
  if(error==0u && !within) { let counter=select(4u,6u,group!=0u)+select(0u,1u,z==0u); atomicAdd(&xcb_control[counter],1u); }
  atomicAdd(&xcb_control[3u],1u);
}
// Separate ordered dispatch: never advance coverage while comparisons run.
@compute @workgroup_size(1)
fn commit_exact_chemistry_channel_tile(@builtin(global_invocation_id) id:vec3<u32>) {
  if(id.x!=0u || id.y!=0u || id.z!=0u) { return; }
  if(xcb_params.dispatch_base!=0u) { xcb_flag(XCB_BAD); return; }
  if(!xcb_bounds()) { xcb_flag(XCB_BAD); return; }
  if(!xcb_tile_ready()) { return; }
  var error=atomicLoad(&xcb_control[0u])|atomicLoad(&xcb_control[8u]);
  let end=xcb_params.channel_base+xcb_params.channel_count;
  if(atomicLoad(&xcb_control[1u])!=XCB_P || atomicLoad(&xcb_control[3u])!=end
      || atomicLoad(&xcb_control[2u])>XCB_P/2u) { error|=XCB_BAD; }
  var executed=0u;
  for(var rx=0u;rx<XCB_RX;rx++) {
    let count=atomicLoad(&xcb_control[${l.reactionCountOffsetWords}u+rx]);
    if(count>XCB_P || executed>XCB_P-count) { error|=XCB_BAD; }
    else { executed+=count; }
  }
  if(executed!=atomicLoad(&xcb_control[2u]) || atomicLoad(&xcb_control[4u])>118u
      || atomicLoad(&xcb_control[5u])>1u || atomicLoad(&xcb_control[6u])>118u*XCB_RX
      || atomicLoad(&xcb_control[7u])>XCB_RX) { error|=XCB_BAD; }
  if(error!=0u) { xcb_flag(error); return; }
  atomicStore(&xcb_control[10u],end); atomicStore(&xcb_control[11u],xcb_params.tile_ordinal+1u);
}
@compute @workgroup_size(1)
fn finish_exact_chemistry_evidence(@builtin(global_invocation_id) id:vec3<u32>) {
  if(id.x!=0u || id.y!=0u || id.z!=0u || !xcb_bounds() || !xcb_metadata_ready()) { return; }
  var error=atomicLoad(&xcb_control[0u])|atomicLoad(&xcb_control[8u]); if(atomicLoad(&xcb_control[1u])!=XCB_P || atomicLoad(&xcb_control[3u])!=XCB_C
      || atomicLoad(&xcb_control[10u])!=XCB_C || atomicLoad(&xcb_control[11u])!=XCB_TILES) { error|=XCB_BAD; }
  xcb_evidence[0u]=0x58434531u; xcb_evidence[1u]=1u; xcb_evidence[2u]=select(1u,0u,error!=0u); xcb_evidence[3u]=error;
  xcb_evidence[4u]=xcb_metadata[9u]; for(var i=0u;i<4u;i++) { xcb_evidence[5u+i]=atomicLoad(&xcb_control[4u+i]); }
  xcb_evidence[9u]=atomicLoad(&xcb_control[3u]); xcb_evidence[10u]=atomicLoad(&xcb_control[1u]); xcb_evidence[11u]=atomicLoad(&xcb_control[2u]);
  xcb_evidence[12u]=xcb_metadata[7u]; xcb_evidence[13u]=xcb_metadata[8u]; xcb_evidence[14u]=XCB_RX; xcb_evidence[15u]=XCB_P;
}
`;
}

/** Existing original pipeline cache accepts caller keys; include every embedded
 * layout value and this numeric schema version to prevent stale specialization. */
export function sphExactReactionChemistryBudgetPipelineDescriptors(format, layout) {
  const code = createSphExactReactionChemistryBudgetWgsl(format, layout);
  const key = [format.wordCount, format.quantumExponent, layout.scalar.wordCount,
    layout.pairCapacity, layout.reactionCount, layout.sourceRecordWords, layout.speciesOffsetWords,
    layout.metadataWordLength, layout.species.termCapacity, layout.species.elementCapacity,
    layout.channelTileCapacity, layout.tileCount, layout.uniformBytes].join(':');
  const bindings = Object.freeze([...Array.from({ length: 8 }, (_, binding) =>
    Object.freeze({ binding, visibility: 4, buffer: Object.freeze({ type: [4, 6, 7].includes(binding) ? 'storage' : 'read-only-storage' }) })),
    Object.freeze({ binding: 8, visibility: 4, buffer: Object.freeze({ type: 'uniform' }) })]);
  return Object.freeze(['reset_exact_chemistry_evidence', 'validate_exact_chemistry_pairs',
    'initialize_exact_chemistry_residuals', 'normalize_exact_chemistry_residuals', 'reduce_exact_chemistry_residuals',
    'compare_exact_chemistry_budgets', 'commit_exact_chemistry_channel_tile', 'finish_exact_chemistry_evidence'].map(entryPoint =>
      Object.freeze({ code, entryPoint, bindings,
        workgroupSize: ['normalize_exact_chemistry_residuals', 'reduce_exact_chemistry_residuals', 'compare_exact_chemistry_budgets'].includes(entryPoint)
          ? SPH_EXACT_CHEMISTRY_ARITHMETIC_WORKGROUP_SIZE : 1,
        cacheKey: `exact-chemistry-evidence-v8:${key}:${entryPoint}` })));
}
