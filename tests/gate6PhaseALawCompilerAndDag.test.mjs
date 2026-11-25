import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  LAW_IR_FORBIDDEN_OPS,
  MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT,
  ULG_COMPILED_LAW_IR_WGSL_SCHEMA,
  ULG_LAW_IR_SCHEMA,
  compileLawIrToWgsl,
  createRepresentedVolumePhaseRetargetLawIr,
  createTaitEosCavitationLawIr,
  differentiateLawIrExpr,
  irBin,
  irConst,
  irParam,
  irVar
} from '../ulg-gpu-abi/src/index.js';
import {
  compileDeclarativeLawIrToWgsl,
  compileLawToWgsl
} from '../src/runtime/material/eshkolHigherOrderLawCompiler.js';
import {
  createLawDagEpochScheduler,
  getCanonicalLawAdapterDescriptor
} from '../src/runtime/sph/lawDagEpochScheduler.js';
import {
  CANONICAL_ULG_LAW_ADAPTERS,
  LAW_ADAPTER_MODES,
  LAW_FALLBACK_POLICIES,
  LAW_SPATIAL_AUTHORITIES
} from '../src/runtime/sph/lawAdapterContract.js';
import {
  SPH_IMPLICIT_PRESSURE_LAW_ADAPTER_DESCRIPTOR,
  SPH_IMPLICIT_PRESSURE_RESOURCE_BINDING_TABLE,
  sphImplicitPressureWgsl
} from '../src/runtime/sph/sphImplicitPressureGpu.js';
import {
  SCHROEDER_PHASE_SLOT_LAW_ADAPTER_DESCRIPTOR,
  schroederPhaseSlotMaterializationWgsl
} from '../src/runtime/sph/schroederPhaseSlotMaterializationGpu.js';
import { SPH_THERMAL_LAW_ADAPTER_DESCRIPTOR } from '../src/runtime/sph/sphThermalGpuKernel.js';
import { SPH_REACTION_LAW_ADAPTER_DESCRIPTOR } from '../src/runtime/sph/sphReactionGpuKernel.js';
import { createCanonicalMlsMpmLawDagEpochScheduler } from '../src/runtime/sph/sphMlsMpmGpuStep.js';

function evalIr(node, env) {
  if (node.op === 'const') return node.value;
  if (node.op === 'var' || node.op === 'param') return env[node.name];
  if (node.op === 'neg') return -evalIr(node.arg, env);
  if (node.op === 'sqrt') return Math.sqrt(evalIr(node.arg, env));
  if (node.op === 'exp') return Math.exp(evalIr(node.arg, env));
  if (node.op === 'log') return Math.log(evalIr(node.arg, env));
  if (node.op === 'sin') return Math.sin(evalIr(node.arg, env));
  if (node.op === 'cos') return Math.cos(evalIr(node.arg, env));
  if (node.op === 'add') return evalIr(node.left, env) + evalIr(node.right, env);
  if (node.op === 'sub') return evalIr(node.left, env) - evalIr(node.right, env);
  if (node.op === 'mul') return evalIr(node.left, env) * evalIr(node.right, env);
  if (node.op === 'div') return evalIr(node.left, env) / evalIr(node.right, env);
  if (node.op === 'pow') return evalIr(node.left, env) ** evalIr(node.right, env);
  throw new Error(`unexpected op ${node.op}`);
}

test('Declarative Law-IR symbolic AD reproduces analytic Tait EOS dP/dJ to machine precision', () => {
  const tait = irBin(
    'mul',
    irParam('stiffnessPa'),
    irBin('sub', irBin('pow', irBin('div', irConst(1), irVar('j')), irParam('gamma')), irConst(1))
  );
  const dpDj = differentiateLawIrExpr(tait, 'j');
  const B = 3.04e8;
  const gamma = 7;
  for (const j of [0.85, 0.95, 1.0, 1.15]) {
    const got = evalIr(dpDj, { j, stiffnessPa: B, gamma });
    const expected = -B * gamma * (j ** (-gamma - 1));
    assert.ok(Math.abs(got - expected) / Math.abs(expected) < 1e-12, `j=${j}: got=${got} exp=${expected}`);
  }
});

test('Declarative Law-IR compiler fails closed on forbidden ops, raw V0/J writes, and undeclared lanes', () => {
  const base = createTaitEosCavitationLawIr();
  const compiled = compileLawToWgsl(base);
  assert.equal(compiled.schema, ULG_COMPILED_LAW_IR_WGSL_SCHEMA);
  assert.match(compiled.wgsl, /fn eval_tait_eos_cavitation/);
  assert.match(compiled.wgsl, /represented_volume_from_mechanics\(gid_x\)/);
  assert.match(compiled.wgsl, /set_buf_mls_mpm_mechanics_resolved_absolute_pressure_pa/);
  assert.match(compiled.wgsl, /set_buf_mls_mpm_mechanics_effective_bulk_modulus_pa/);
  assert.ok(compiled.bindGroupLayoutEntries.length === 3);

  // Forbidden non-GPU ops rejected fail-closed
  for (const badOp of LAW_IR_FORBIDDEN_OPS) {
    assert.throws(
      () => compileDeclarativeLawIrToWgsl({
        ...base,
        body: [
          { op: 'let', name: 'bad', expr: { op: badOp, arg: irConst(1) } }
        ]
      }),
      (err) => err.code === 'ERR_LAW_IR_UNSAFE_GPU_OP'
    );
  }

  // Raw write to paired volumeRatioJ / restVolumeM3 rejected fail-closed
  for (const pairedField of ['volumeRatioJ', 'restVolumeM3']) {
    assert.throws(
      () => compileDeclarativeLawIrToWgsl({
        ...base,
        body: [
          { op: 'laneWrite', resource: 'mls-mpm-mechanics', field: pairedField, expr: irConst(1) }
        ]
      }),
      (err) => err.code === 'ERR_LAW_IR_UNPAIRED_VOLUME_WRITE'
    );
  }

  // Writing to read-only resource rejected fail-closed
  assert.throws(
    () => compileLawIrToWgsl({
      ...base,
      descriptor: { ...base.descriptor, writes: [] }
    }, { resourceLayouts: { 'mls-mpm-mechanics': MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT } }),
    (err) => err.code === 'ERR_LAW_IR_WRITE_VIOLATION'
  );

  // Paired RepresentedVolume phase retarget compiles cleanly
  const retarget = compileDeclarativeLawIrToWgsl(createRepresentedVolumePhaseRetargetLawIr());
  assert.match(retarget.wgsl, /represented_volume_retarget_phase/);
  assert.match(retarget.wgsl, /set_buf_mls_mpm_mechanics_volume_ratio_j\(gid_x, dst_vol\.j\)/);
  assert.match(retarget.wgsl, /set_buf_mls_mpm_mechanics_rest_volume_m3\(gid_x, dst_vol\.v0_m3\)/);
});

test('Canonical Law-DAG Epoch Scheduler validates schedule, hoists shared SS views once, and enforces drained leases', async () => {
  const scheduler = createCanonicalMlsMpmLawDagEpochScheduler({ epochId: 'gate6-epoch', epochGeneration: 7 });
  assert.equal(scheduler.stageIds.length, CANONICAL_ULG_LAW_ADAPTERS.length);
  assert.equal(scheduler.validation.valid, true);
  assert.equal(scheduler.validation.debt.length, 0);

  let cellLocalBuilds = 0;
  let exactNearBuilds = 0;
  const releasedTokens = [];

  const receipt = await scheduler.executeEpoch(
    Object.fromEntries(
      scheduler.stageIds.map((id) => [
        id,
        async ({ descriptor, sharedView, leaseScope }) => {
          assert.ok(sharedView != null || descriptor.adapterMode === LAW_ADAPTER_MODES.SOLID_PROXY || descriptor.adapterMode === LAW_ADAPTER_MODES.SURFACE_INTERFACE);
          const scratch = { stage: descriptor.id };
          const lease = leaseScope.issue(scratch, {
            label: `scratch:${descriptor.id}`,
            producer: descriptor.id,
            onRelease: () => releasedTokens.push(descriptor.id)
          });
          leaseScope.release(lease, { by: descriptor.id });
          return { status: 'ok' };
        }
      ])
    ),
    {
      viewBuilders: {
        [LAW_ADAPTER_MODES.CELL_LOCAL]: () => {
          cellLocalBuilds += 1;
          return { kind: 'ss-cell-local-view' };
        },
        [LAW_ADAPTER_MODES.EXACT_NEAR]: () => {
          exactNearBuilds += 1;
          return { kind: 'ss-exact-near-view' };
        }
      },
      requireAllReleased: true
    }
  );

  assert.equal(cellLocalBuilds, 1, 'cell-local SS view must be built ONCE and hoisted across 5 stages');
  assert.equal(exactNearBuilds, 1, 'exact-near SS view must be built ONCE and hoisted across 2 stages');
  assert.equal(receipt.hoistedViewBuilds, 2);
  assert.equal(receipt.hoistedViewReuses, 5);
  assert.equal(receipt.zeroWriteConflicts, true);
  assert.equal(receipt.zeroLegacyPrivateGrids, true);
  assert.equal(receipt.leaseSnapshot.live, 0);
  assert.equal(releasedTokens.length, CANONICAL_ULG_LAW_ADAPTERS.length);

  // Reject legacy-private-grid debt when requireCanonicalSsAuthority is true
  assert.throws(
    () => createLawDagEpochScheduler({
      epochId: 'legacy-reject',
      requireCanonicalSsAuthority: true,
      stages: [
        {
          id: 'bad-private-grid-law',
          lawNodeId: 'law:bad',
          orderConstraint: 'first',
          adapterMode: LAW_ADAPTER_MODES.EXACT_NEAR,
          spatialAuthority: LAW_SPATIAL_AUTHORITIES.LEGACY_PRIVATE_GRID,
          reads: ['sph-particle-state'],
          writes: ['sph-thermo-phase'],
          accumulates: [],
          pairedVolumeState: 'not-applicable',
          conservedQuantities: ['mass'],
          validityDomain: { ok: true },
          fallbackPolicy: LAW_FALLBACK_POLICIES.FAIL_CLOSED
        }
      ]
    }),
    (err) => err.code === 'ERR_LAW_DAG_LEGACY_PRIVATE_GRID'
  );

  // Reject leaked transient GPU buffer lease at epoch end
  const leaky = createCanonicalMlsMpmLawDagEpochScheduler({ epochId: 'leaky-epoch' });
  await assert.rejects(
    () => leaky.executeEpoch({
      'mls-mpm-p2g': async ({ leaseScope }) => {
        leaseScope.issue({ leaked: true }, { label: 'unreleased-scratch', producer: 'mls-mpm-p2g' });
      }
    }),
    (err) => err.code === 'ERR_GPU_RESOURCE_LEASE_LEAK'
  );
});

test('Live ULG continuum laws adopt generated ABI accessors, paired RepresentedVolume, and canonical Law Descriptors', () => {
  // Implicit pressure uses generated ABI accessors + paired RepresentedVolume
  assert.match(sphImplicitPressureWgsl, /represented_volume_from_mechanics\(particle_index\)/);
  assert.match(sphImplicitPressureWgsl, /ip_mech_solid_flag\(particle_index\)/);
  assert.match(sphImplicitPressureWgsl, /ip_mech_sound_speed_m_per_s\(particle_index\)/);
  assert.match(sphImplicitPressureWgsl, /ip_thermo_rest_density_kg_per_m3\(particle_index\)/);
  assert.match(sphImplicitPressureWgsl, /ip_state_mass_kg\(particle_index\)/);
  assert.equal(SPH_IMPLICIT_PRESSURE_LAW_ADAPTER_DESCRIPTOR.spatialAuthority, LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH);
  assert.ok(SPH_IMPLICIT_PRESSURE_RESOURCE_BINDING_TABLE['mls-mpm-grid-velocity'] === 4);

  // Phase-slot materializer uses generated ABI accessors + paired RepresentedVolume
  assert.match(schroederPhaseSlotMaterializationWgsl, /represented_volume_from_mechanics\(i\)/);
  assert.match(schroederPhaseSlotMaterializationWgsl, /psm_src_mech_solid_flag\(i\)/);
  assert.match(schroederPhaseSlotMaterializationWgsl, /psm_src_mech_constitutive_status\(i\)/);
  assert.equal(SCHROEDER_PHASE_SLOT_LAW_ADAPTER_DESCRIPTOR.id, 'phase-slot-refinement');

  // Thermal & reaction expose canonical SS descriptors
  assert.equal(SPH_THERMAL_LAW_ADAPTER_DESCRIPTOR.spatialAuthority, LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH);
  assert.equal(SPH_REACTION_LAW_ADAPTER_DESCRIPTOR.spatialAuthority, LAW_SPATIAL_AUTHORITIES.CANONICAL_SS_EPOCH);
  assert.equal(getCanonicalLawAdapterDescriptor('mls-mpm-p2g').id, 'mls-mpm-p2g');
});

test('Portable zero-LLVM Eshkol C WGSL emitter (../eshkol/lib/backend/vm_wgsl_emitter.c) emits valid ULG Law-IR JSON', (t) => {
  const eshkolDir = path.resolve(process.cwd(), '../eshkol');
  const emitterSrc = path.join(eshkolDir, 'lib/backend/vm_wgsl_emitter.c');
  const testSrc = path.join(eshkolDir, 'tests/test_wgsl_emitter.c');
  if (!fs.existsSync(emitterSrc) || !fs.existsSync(testSrc)) {
    t.skip('sibling ../eshkol repo not present');
    return;
  }
  const tmpBin = path.join(os.tmpdir(), `eshkol_wgsl_emitter_${process.pid}`);
  try {
    execFileSync('gcc', [
      '-std=c99', '-Wall', '-Wextra', '-Werror',
      `-I${path.join(eshkolDir, 'inc')}`,
      emitterSrc,
      testSrc,
      '-lm',
      '-o', tmpBin
    ], { stdio: 'pipe' });
    const unitOut = execFileSync(tmpBin, [], { encoding: 'utf8' });
    assert.match(unitOut, /PASS: test_wgsl_emitter/);

    const jsonText = execFileSync(tmpBin, ['--emit-tait-json'], { encoding: 'utf8' });
    const lawIr = JSON.parse(jsonText);
    assert.equal(lawIr.schema, ULG_LAW_IR_SCHEMA);
    const compiled = compileDeclarativeLawIrToWgsl(lawIr);
    assert.equal(compiled.schema, ULG_COMPILED_LAW_IR_WGSL_SCHEMA);
    assert.equal(compiled.entryPoint, 'eval_eshkol_c_tait_eos');
    assert.match(compiled.wgsl, /represented_volume_from_mechanics\(gid_x\)/);
    assert.match(compiled.wgsl, /set_buf_mls_mpm_mechanics_resolved_absolute_pressure_pa/);
    assert.match(compiled.wgsl, /set_buf_mls_mpm_mechanics_effective_bulk_modulus_pa/);
  } finally {
    if (fs.existsSync(tmpBin)) fs.unlinkSync(tmpBin);
  }
});
