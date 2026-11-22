import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  SCHROEDER_CHAIN_PRIVATE_DT_REFINEMENT_LADDER
} from '../src/runtime/sph/schroederSpatialChainResidentGpu.js';
import {
  buildLaunchParamsFromStagedConfig,
  buildStagedConfigFromPreset
} from '../src/visualization/ulgSimStudioModel.js';
import {
  sphPhaseScenarioPresetById
} from '../src/runtime/sphPhaseScenarioPresets.js';
import {
  schroederSpatialChainProlongWgsl
} from '../ulg-gpu-abi/src/schroederSpatialMechanicsCorrectionWgsl.js';
import {
  sphReactionProductEventSpatialClassificationWgsl,
  sphReactionProductEventSpatialClassificationV2Wgsl
} from '../ulg-gpu-abi/src/sphReactionProductEventSpatialClassificationWgsl.js';
import {
  sphReactionProductPlacementCaptureApplyWgsl
} from '../ulg-gpu-abi/src/sphReactionProductPlacementSegmentedWgsl.js';
import {
  createSphExactPhaseCarrierPhysicalWgsl
} from '../src/runtime/sph/sphExactPhaseCarrierPhysicalWgsl.js';

test('chain private dt refinement ladder is frozen, strictly increasing, and dyadic', () => {
  assert.equal(Object.isFrozen(SCHROEDER_CHAIN_PRIVATE_DT_REFINEMENT_LADDER), true);
  assert.deepEqual(SCHROEDER_CHAIN_PRIVATE_DT_REFINEMENT_LADDER, [4, 8, 16, 32, 64, 128, 256]);
  for (let i = 1; i < SCHROEDER_CHAIN_PRIVATE_DT_REFINEMENT_LADDER.length; i++) {
    assert.equal(
      SCHROEDER_CHAIN_PRIVATE_DT_REFINEMENT_LADDER[i],
      SCHROEDER_CHAIN_PRIVATE_DT_REFINEMENT_LADDER[i - 1] * 2
    );
  }
});

test('Studio airLevels>=3 sets reactionProductReserveMinimumLiveFraction=1 for reacting presets without mutating base scenarios', () => {
  const csBase = sphPhaseScenarioPresetById('cesium-fluorine');
  assert.equal(csBase.runtime?.reactionProductReserveMinimumLiveFraction, undefined);

  const csAir3 = buildStagedConfigFromPreset('cesium-fluorine');
  csAir3.environment.mode = 'air';
  csAir3.environment.airHierarchyLevels = 3;
  const csLaunch = buildLaunchParamsFromStagedConfig(csAir3);
  assert.equal(csLaunch.schroederLevelChain, '1');
  assert.equal(csLaunch.schroederMaxLevel, '2');
  assert.equal(csLaunch.reactionProductReserveMinimumLiveFraction, '1');

  const naAir3 = buildStagedConfigFromPreset('sodium-water');
  naAir3.environment.mode = 'air';
  naAir3.environment.airHierarchyLevels = 3;
  const naLaunch = buildLaunchParamsFromStagedConfig(naAir3);
  assert.equal(naLaunch.schroederLevelChain, '1');
  assert.equal(naLaunch.reactionProductReserveMinimumLiveFraction, '1');

  const ironAir3 = buildStagedConfigFromPreset('iron-ice-quench');
  ironAir3.environment.mode = 'air';
  ironAir3.environment.airHierarchyLevels = 3;
  const ironLaunch = buildLaunchParamsFromStagedConfig(ironAir3);
  assert.equal(ironLaunch.schroederLevelChain, '1');
  assert.equal(ironLaunch.reactionProductReserveMinimumLiveFraction, undefined);
});

test('chain prolongation clamps bounded f32 cancellation noise only after the fail-closed negative-heat guard', () => {
  const guardIndex = schroederSpatialChainProlongWgsl.indexOf('updated[b]!=original[a]) { numeric_fail(1u); }');
  const clampIndex = schroederSpatialChainProlongWgsl.indexOf('(row[0]/mass)*max(0.0,heat)');
  assert.ok(guardIndex > 0, 'fail-closed negative-heat guard must remain present');
  assert.ok(clampIndex > guardIndex, 'non-negative heat clamp must occur strictly after the fail-closed guard');
});

test('reaction product classifier prefers exact phase match and falls back to same-material condensed-to-condensed capture', () => {
  for (const wgsl of [
    sphReactionProductEventSpatialClassificationWgsl,
    sphReactionProductEventSpatialClassificationV2Wgsl
  ]) {
    assert.match(wgsl, /fn placement_classifier_phase_is_condensed\(/);
    assert.match(wgsl, /let exact_phase_match = candidate_thermo0\.y == event_phase_id;/);
    assert.match(wgsl, /let condensed_phase_match = !exact_phase_match/);
    assert.match(wgsl, /if \(best_slot >= params\.particle_count && condensed_slot < params\.particle_count\)/);
  }
});

test('capture-merge tail apply resets thermo1 phase fractions to one-hot on active receiver phase', () => {
  assert.match(
    sphReactionProductPlacementCaptureApplyWgsl,
    /next_thermo\[thermo_base \+ 1u\] = vec4<f32>\(\s*select\(0\.0, 1\.0, thermo0\.y >= 0\.5 && thermo0\.y < 1\.5\),\s*select\(0\.0, 1\.0, thermo0\.y >= 1\.5 && thermo0\.y < 2\.5\),\s*select\(0\.0, 1\.0, thermo0\.y >= 2\.5 && thermo0\.y < 3\.5\),\s*select\(0\.0, 1\.0, thermo0\.y >= 3\.5\)\s*\);/
  );
});

test('exact phase carrier physical projection preserves dormant reserve lineage status', () => {
  const wgsl = createSphExactPhaseCarrierPhysicalWgsl({ packetWords: 12, exactWords: 4 });
  assert.match(wgsl, /geometry\[row \* 8u \+ 5u\] = select\(0u, 1u, lineage_live\);/);
  assert.match(wgsl, /if \(geometry\[row \* 8u \+ 5u\] == 0u\) \{[\s\S]*out_thermo\[row \* 3u\] = source_thermo\[row \* 3u\];[\s\S]*out_thermo\[row \* 3u \+ 2u\] = source_thermo\[row \* 3u \+ 2u\];/);
});

test('chain step runtime aligns activeSourceCapacity/arena ownership with worker prebuilt epochs and gates clock segment reset', async () => {
  const [stepSrc, closureSrc, workerSrc] = await Promise.all([
    fs.readFile(path.resolve(process.cwd(), 'src/runtime/sph/schroederSpatialChainStepGpu.js'), 'utf8'),
    fs.readFile(path.resolve(process.cwd(), 'src/runtime/sph/sphMlsMpmPostMechanicsClosure.js'), 'utf8'),
    fs.readFile(path.resolve(process.cwd(), 'src/services/ulgMechanicsResidentStage.worker.js'), 'utf8')
  ]);
  assert.match(stepSrc, /activeSourceCapacity:\s*particleCount/);
  assert.match(stepSrc, /generation\.execution\?\.released !== true/);
  assert.doesNotMatch(stepSrc, /!generation\.released\b|!prebuiltGeneration\.released\b/);
  assert.match(
    closureSrc,
    /allowChainClockSegmentReset === true[\s\S]*inheritedClock\.dt !== dtSeconds[\s\S]*sphParticleUpload\?\.physicsSubstep === 0/
  );
  assert.match(workerSrc, /chainAdaptiveBaseDtS:\s*previousLane\?\.chainAdaptiveBaseDtS/);
  assert.match(workerSrc, /pendingChainStepCleanup/);
});
