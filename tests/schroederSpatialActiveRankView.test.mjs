import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_ABI,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_DISPATCH_OFFSET_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_LAYOUT,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS,
  SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT,
  ULG_SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_SCHEMA,
  createSchroederSpatialActiveRankViewLayout,
  validateSchroederSpatialActiveRankViewDescriptor
} from '../ulg-gpu-abi/src/schroederSpatialActiveRankView.js';
import {
  createSchroederSpatialActiveRankViewBuildWgsl
} from '../ulg-gpu-abi/src/schroederSpatialActiveRankViewWgsl.js';

test('active-rank view layout owns one prefix endpoint and one dense rank slot per source', () => {
  const layout = createSchroederSpatialActiveRankViewLayout({
    sourceCapacity: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT
  });
  assert.equal(
    SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_LAYOUT.length,
    SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_HEADER_WORDS
  );
  assert.equal(layout.rankPrefixOffsetWords, layout.headerWords);
  assert.equal(layout.rankPrefixCapacity, layout.sourceCapacity + 1);
  assert.equal(
    layout.activeRanksOffsetWords,
    layout.rankPrefixOffsetWords + layout.rankPrefixCapacity
  );
  assert.equal(layout.activeRankCapacity, layout.sourceCapacity);
  assert.equal(
    layout.activeSourceIndicesOffsetWords,
    layout.activeRanksOffsetWords + layout.activeRankCapacity
  );
  assert.equal(layout.activeSourceIndexCapacity, layout.sourceCapacity);
  assert.equal(
    layout.wordLength,
    layout.activeSourceIndicesOffsetWords + layout.activeSourceIndexCapacity
  );
  assert.equal(
    layout.dispatchOffsetWords,
    SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_DISPATCH_OFFSET_WORDS
  );
  assert.equal(layout.dispatchOffsetBytes, layout.dispatchOffsetWords * 4);
  assert.equal(
    SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_ABI.cellTraversal,
    'activeRanks[rankPrefix[cellBegin]..rankPrefix[cellEnd])'
  );
});

test('active-rank view layout rejects zero and capacities beyond its deterministic bound', () => {
  assert.throws(
    () => createSchroederSpatialActiveRankViewLayout({ sourceCapacity: 0 }),
    /sourceCapacity/
  );
  assert.throws(
    () => createSchroederSpatialActiveRankViewLayout({
      sourceCapacity: SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_MAX_SOURCE_COUNT + 1
    }),
    /sourceCapacity/
  );
});

test('active-rank producer is stable, bounded, and fail-closed without atomic allocation', () => {
  const layout = createSchroederSpatialActiveRankViewLayout({
    sourceCapacity: 4608
  });
  const wgsl = createSchroederSpatialActiveRankViewBuildWgsl(layout);
  assert.match(wgsl, /@compute @workgroup_size\(256\)/);
  assert.match(wgsl, /fn build_active_rank_view/);
  assert.match(wgsl, /lane_active_offsets\[scan_lane\] = running/);
  assert.match(wgsl, /active_rank_view\[VIEW_PREFIX_OFFSET \+ rank\] = prefix/);
  assert.match(wgsl, /active_rank_view\[VIEW_ACTIVE_RANKS_OFFSET \+ prefix\] = rank/);
  assert.match(
    wgsl,
    /active_rank_view\[VIEW_ACTIVE_SOURCE_INDICES_OFFSET \+ prefix\][\s\S]*active_source_indices\[local_rank\]/
  );
  assert.match(wgsl, /active_rank_view\[VIEW_PREFIX_OFFSET \+ source_count\] = total_active_count/);
  assert.match(wgsl, /total_active_count \+ dormant_count == source_count/);
  assert.match(wgsl, /VIEW_STATUS_FAIL_CLOSED/);
  assert.match(wgsl, /spatial_directory\[35u\] == spatial_directory\[33u\]/);
  assert.doesNotMatch(wgsl, /atomicAdd\(&[^,]*active[^,]*count/);
});

test('active-rank descriptor admission requires exact epoch and buffer ownership', () => {
  const layout = createSchroederSpatialActiveRankViewLayout({ sourceCapacity: 8 });
  const sourceBuffer = {};
  const directoryBuffer = {};
  const activeRankViewBuffer = {};
  const execution = {
    sourceCapacity: 8,
    sourceRowLayoutId: 1,
    sourceBuffer,
    directoryBuffer,
    activeRankViewBuffer
  };
  const view = {
    schema: ULG_SCHROEDER_SPATIAL_ACTIVE_RANK_VIEW_SCHEMA,
    status: 'schroeder-spatial-active-rank-view-gpu-encoded',
    ready: true,
    selected: true,
    spatialExecution: execution,
    sourceBuffer,
    directoryBuffer,
    activeRankViewBuffer,
    layout,
    sourceCount: 6,
    sourceCapacity: 8,
    sourceRowLayoutId: 1,
    generationId: 3,
    storageGeneration: 4,
    physicsTick: 5,
    physicsSubstep: 0,
    positionEpoch: 6,
    topologyEpoch: 7,
    chartEpoch: 8,
    levelEpoch: 9,
    supportEpoch: 10,
    buildOrdinal: 3,
    dispatchOffsetBytes: layout.dispatchOffsetBytes
  };
  execution.activeRankView = view;
  const admitted = validateSchroederSpatialActiveRankViewDescriptor(view, {
    spatialExecution: execution,
    sourceBuffer,
    sourceCount: 6,
    generationId: 3
  });
  assert.equal(admitted.admitted, true, admitted.reason);
  assert.equal(
    validateSchroederSpatialActiveRankViewDescriptor(view, {
      sourceBuffer: {}
    }).admitted,
    false
  );
  assert.equal(
    validateSchroederSpatialActiveRankViewDescriptor(
      { ...view, layout: { ...layout, activeSourceIndicesOffsetWords: 0 } }
    ).status,
    'schroeder-spatial-active-rank-view-rejected-layout'
  );
});
