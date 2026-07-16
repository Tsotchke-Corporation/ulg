import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_SCHEMA,
  ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_V2_SCHEMA,
  redistributeFourPhaseLaneCarrierReference,
  redistributeTwoSlotPhaseCarrierReference
} from '../src/runtime/sph/sphPhaseCarrierTransferReference.js';

const PRIMARY_PHASE_ID = 0;
const COMPANION_PHASE_ID = 1;
const PRIMARY_ENERGY_J_PER_KG = 120_000;
const COMPANION_ENERGY_J_PER_KG = 453_000;
const FRACTION_SWEEP = [0, 0.01, 0.1, 0.25, 0.49, 0.5, 0.51, 0.75, 0.9, 0.99, 1];

function nearlyEqual(actual, expected, relativeTolerance = 1e-12) {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  assert.ok(
    Math.abs(actual - expected) <= relativeTolerance * scale,
    `expected ${actual} to be within ${relativeTolerance} relative tolerance of ${expected}`
  );
}

function nearlyEqualVector(actual, expected, relativeTolerance = 1e-12) {
  assert.equal(actual.length, expected.length);
  for (let axis = 0; axis < expected.length; axis += 1) {
    nearlyEqual(actual[axis], expected[axis], relativeTolerance);
  }
}

function plateauComponents(companionFraction) {
  return [
    {
      phaseId: PRIMARY_PHASE_ID,
      fraction: 1 - companionFraction,
      specificInternalEnergyJPerKg: PRIMARY_ENERGY_J_PER_KG
    },
    {
      phaseId: COMPANION_PHASE_ID,
      fraction: companionFraction,
      specificInternalEnergyJPerKg: COMPANION_ENERGY_J_PER_KG
    }
  ];
}

function plateauSpecificEnergy(companionFraction) {
  return (1 - companionFraction) * PRIMARY_ENERGY_J_PER_KG
    + companionFraction * COMPANION_ENERGY_J_PER_KG;
}

function carrierPair({ primaryFraction, companionFraction = primaryFraction } = {}) {
  return {
    primary: {
      slotId: 'water-lineage-7:primary',
      slotRole: 'primary',
      lineageId: 'water-lineage-7',
      phaseId: PRIMARY_PHASE_ID,
      materialId: 4,
      massKg: 6,
      positionM: [1, 2, 3],
      velocityMPerS: [2, -1, 0.5],
      specificInternalEnergyJPerKg: plateauSpecificEnergy(primaryFraction),
      phaseComponents: plateauComponents(primaryFraction)
    },
    companion: {
      slotId: 'water-lineage-7:companion',
      slotRole: 'companion',
      lineageId: 'water-lineage-7',
      phaseId: COMPANION_PHASE_ID,
      materialId: 4,
      massKg: 4,
      positionM: [4, -2, 1],
      velocityMPerS: [-1, 3, -0.25],
      specificInternalEnergyJPerKg: plateauSpecificEnergy(companionFraction),
      phaseComponents: plateauComponents(companionFraction)
    }
  };
}

function redistribute(pair) {
  return redistributeTwoSlotPhaseCarrierReference({
    ...pair,
    primaryPhaseId: PRIMARY_PHASE_ID,
    companionPhaseId: COMPANION_PHASE_ID
  });
}

const FOUR_PHASE_ENERGY_J_PER_KG = Object.freeze({
  1: 100_000,
  2: 200_000,
  3: 300_000,
  4: 400_000
});

function fourPhaseComponent(phaseId, fraction) {
  return {
    phaseId,
    fraction,
    specificInternalEnergyJPerKg: FOUR_PHASE_ENERGY_J_PER_KG[phaseId]
  };
}

function fourPhaseSpecificEnergy(components) {
  return components.reduce((sum, component) => (
    sum + component.fraction * component.specificInternalEnergyJPerKg
  ), 0);
}

function fourPhaseLaneSlots() {
  const phaseOneComponents = [
    fourPhaseComponent(1, 0.25),
    fourPhaseComponent(2, 0.75)
  ];
  const phaseTwoComponents = [
    fourPhaseComponent(2, 0.5),
    fourPhaseComponent(3, 0.5)
  ];
  return [
    {
      slotId: 'water-lineage-11:phase-1',
      slotRole: 'phase-1',
      lineageId: 'water-lineage-11',
      phaseId: 1,
      materialId: 4,
      massKg: 4,
      positionM: [0, 0, 0],
      velocityMPerS: [1, 0, 0],
      specificInternalEnergyJPerKg: fourPhaseSpecificEnergy(phaseOneComponents),
      phaseComponents: phaseOneComponents
    },
    {
      slotId: 'water-lineage-11:phase-2',
      slotRole: 'phase-2',
      lineageId: 'water-lineage-11',
      phaseId: 2,
      materialId: 4,
      massKg: 6,
      positionM: [3, 2, -1],
      velocityMPerS: [-1, 2, 0.5],
      specificInternalEnergyJPerKg: fourPhaseSpecificEnergy(phaseTwoComponents),
      phaseComponents: phaseTwoComponents
    },
    {
      slotId: 'water-lineage-11:phase-3',
      slotRole: 'phase-3',
      lineageId: 'water-lineage-11',
      phaseId: 3,
      materialId: 4,
      massKg: 0,
      positionM: [30, 30, 30],
      velocityMPerS: [0, 0, 0],
      specificInternalEnergyJPerKg: FOUR_PHASE_ENERGY_J_PER_KG[3],
      phaseComponents: []
    },
    {
      slotId: 'water-lineage-11:phase-4',
      slotRole: 'phase-4',
      lineageId: 'water-lineage-11',
      phaseId: 4,
      materialId: 4,
      massKg: 0,
      positionM: [40, 40, 40],
      velocityMPerS: [0, 0, 0],
      specificInternalEnergyJPerKg: FOUR_PHASE_ENERGY_J_PER_KG[4],
      phaseComponents: []
    }
  ];
}

test('two-slot phase transfer exposes a stable reference schema', () => {
  assert.equal(
    ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_SCHEMA,
    'peercompute.ulg.sph-phase-carrier-transfer-reference.v1'
  );
});

test('four-phase-lane transfer exposes a distinct v2 reference schema', () => {
  assert.equal(
    ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_V2_SCHEMA,
    'peercompute.ulg.sph-phase-carrier-transfer-reference.v2'
  );
});

test('four fixed lanes collect solid, liquid, and gas from different source slots', () => {
  const slots = fourPhaseLaneSlots();
  const before = structuredClone(slots);
  const result = redistributeFourPhaseLaneCarrierReference({ slots });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'redistributed-four-phase-lane-carriers');
  assert.equal(result.schema, ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_V2_SCHEMA);
  assert.equal(result.reason, null);
  assert.deepEqual(result.slots.map((slot) => slot.phaseId), [1, 2, 3, 4]);
  assert.deepEqual(
    result.slots.map((slot) => slot.slotId),
    before.map((slot) => slot.slotId)
  );
  assert.deepEqual(
    result.slots.map((slot) => slot.slotRole),
    before.map((slot) => slot.slotRole)
  );

  nearlyEqual(result.slots[0].massKg, 1);
  nearlyEqual(result.slots[1].massKg, 6);
  nearlyEqual(result.slots[2].massKg, 3);
  nearlyEqual(result.slots[3].massKg, 0);
  nearlyEqualVector(result.slots[0].positionM, [0, 0, 0]);
  nearlyEqualVector(result.slots[1].positionM, [1.5, 1, -0.5]);
  nearlyEqualVector(result.slots[2].positionM, [3, 2, -1]);
  nearlyEqualVector(result.slots[0].velocityMPerS, [1, 0, 0]);
  nearlyEqualVector(result.slots[1].velocityMPerS, [0, 1, 0.25]);
  nearlyEqualVector(result.slots[2].velocityMPerS, [-1, 2, 0.5]);

  for (let laneIndex = 0; laneIndex < 3; laneIndex += 1) {
    const phaseId = laneIndex + 1;
    assert.deepEqual(result.slots[laneIndex].phaseComponents, [{
      phaseId,
      fraction: 1,
      specificInternalEnergyJPerKg: result.slots[laneIndex].specificInternalEnergyJPerKg
    }]);
    assert.ok(
      result.slots[laneIndex].specificInternalEnergyJPerKg
        >= FOUR_PHASE_ENERGY_J_PER_KG[phaseId]
    );
  }
  assert.deepEqual(result.slots[3].phaseComponents, []);
  assert.equal(result.conservation.massConserved, true);
  assert.equal(result.conservation.momentumConserved, true);
  assert.equal(result.conservation.firstMomentConserved, true);
  assert.equal(result.conservation.internalEnergyConserved, false);
  assert.equal(result.conservation.totalEnergyConserved, true);
  assert.ok(result.conservation.relativeKineticEnergyThermalizedJ > 0);
  assert.equal(result.conservation.conserved, true);
  nearlyEqual(result.conservation.delta.massKg, 0);
  nearlyEqualVector(result.conservation.delta.momentumKgMPerS, [0, 0, 0]);
  nearlyEqualVector(result.conservation.delta.firstMomentKgM, [0, 0, 0]);
  nearlyEqual(
    result.conservation.delta.internalEnergyJ,
    result.conservation.relativeKineticEnergyThermalizedJ
  );
  nearlyEqual(result.conservation.delta.totalEnergyJ, 0);
  assert.deepEqual(slots, before, 'successful redistribution must not mutate its sources');
});

test('four-phase-lane aggregation reaches phase four and is component-order deterministic', () => {
  const slots = fourPhaseLaneSlots();
  const phaseThreeComponents = [
    fourPhaseComponent(3, 0.25),
    fourPhaseComponent(4, 0.75)
  ];
  slots[2].massKg = 2;
  slots[2].specificInternalEnergyJPerKg = fourPhaseSpecificEnergy(phaseThreeComponents);
  slots[2].phaseComponents = phaseThreeComponents;

  const reversedComponents = structuredClone(slots);
  for (const slot of reversedComponents) slot.phaseComponents.reverse();
  const forward = redistributeFourPhaseLaneCarrierReference({ slots });
  const reversed = redistributeFourPhaseLaneCarrierReference({ slots: reversedComponents });

  assert.equal(forward.ok, true);
  assert.equal(reversed.ok, true);
  assert.deepEqual(reversed, forward);
  nearlyEqual(forward.slots[2].massKg, 3.5);
  nearlyEqual(forward.slots[3].massKg, 1.5);
  assert.deepEqual(forward.slots[3].phaseComponents, [{
    phaseId: 4,
    fraction: 1,
    specificInternalEnergyJPerKg: FOUR_PHASE_ENERGY_J_PER_KG[4]
  }]);
  assert.equal(forward.conservation.conserved, true);
});

test('melting and freezing sweeps preserve roles and all required invariants through 49/51 percent', async (t) => {
  const traversals = [
    ['melting', FRACTION_SWEEP],
    ['freezing', [...FRACTION_SWEEP].reverse()]
  ];

  for (const [label, fractions] of traversals) {
    await t.test(label, () => {
      for (const companionFraction of fractions) {
        const pair = carrierPair({ primaryFraction: companionFraction });
        const before = structuredClone(pair);
        const result = redistribute(pair);

        assert.equal(result.ok, true, `${label} fraction ${companionFraction}`);
        assert.equal(result.status, 'redistributed-two-slot-phase-carriers');
        assert.equal(result.schema, ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_SCHEMA);
        assert.equal(result.primary.slotId, before.primary.slotId);
        assert.equal(result.companion.slotId, before.companion.slotId);
        assert.equal(result.primary.slotRole, 'primary');
        assert.equal(result.companion.slotRole, 'companion');
        assert.equal(result.primary.phaseId, PRIMARY_PHASE_ID);
        assert.equal(result.companion.phaseId, COMPANION_PHASE_ID);
        assert.equal(result.primary.lineageId, before.primary.lineageId);
        assert.equal(result.companion.lineageId, before.companion.lineageId);
        nearlyEqual(result.primary.massKg, 10 * (1 - companionFraction));
        nearlyEqual(result.companion.massKg, 10 * companionFraction);

        if (result.primary.massKg > 0) {
          nearlyEqual(result.primary.specificInternalEnergyJPerKg, PRIMARY_ENERGY_J_PER_KG);
          assert.equal(result.primary.phaseComponents.length, 1);
          assert.equal(result.primary.phaseComponents[0].phaseId, PRIMARY_PHASE_ID);
          assert.equal(result.primary.phaseComponents[0].fraction, 1);
          nearlyEqual(
            result.primary.phaseComponents[0].specificInternalEnergyJPerKg,
            PRIMARY_ENERGY_J_PER_KG
          );
        } else {
          assert.deepEqual(result.primary.phaseComponents, []);
        }
        if (result.companion.massKg > 0) {
          nearlyEqual(
            result.companion.specificInternalEnergyJPerKg,
            COMPANION_ENERGY_J_PER_KG
          );
          assert.equal(result.companion.phaseComponents.length, 1);
          assert.equal(result.companion.phaseComponents[0].phaseId, COMPANION_PHASE_ID);
          assert.equal(result.companion.phaseComponents[0].fraction, 1);
          nearlyEqual(
            result.companion.phaseComponents[0].specificInternalEnergyJPerKg,
            COMPANION_ENERGY_J_PER_KG
          );
        } else {
          assert.deepEqual(result.companion.phaseComponents, []);
        }

        assert.equal(result.conservation.massConserved, true);
        assert.equal(result.conservation.momentumConserved, true);
        assert.equal(result.conservation.firstMomentConserved, true);
        assert.equal(result.conservation.internalEnergyConserved, true);
        assert.equal(result.conservation.conserved, true);
        nearlyEqual(result.conservation.delta.massKg, 0);
        nearlyEqualVector(result.conservation.delta.momentumKgMPerS, [0, 0, 0]);
        nearlyEqualVector(result.conservation.delta.firstMomentKgM, [0, 0, 0]);
        nearlyEqual(result.conservation.delta.internalEnergyJ, 0);
        assert.deepEqual(pair, before, 'the reference must never mutate its source slots');
      }
    });
  }
});

test('source-specific fractions transport phase momentum and first moment before materialization', () => {
  const pair = carrierPair({ primaryFraction: 0.25, companionFraction: 0.75 });
  const result = redistribute(pair);

  assert.equal(result.ok, true);
  nearlyEqual(result.primary.massKg, 5.5);
  nearlyEqual(result.companion.massKg, 4.5);
  nearlyEqualVector(result.primary.positionM, [8.5 / 5.5, 7 / 5.5, 14.5 / 5.5]);
  nearlyEqualVector(result.companion.positionM, [13.5 / 4.5, -3 / 4.5, 7.5 / 4.5]);
  nearlyEqualVector(result.primary.velocityMPerS, [8 / 5.5, -1.5 / 5.5, 2 / 5.5]);
  nearlyEqualVector(result.companion.velocityMPerS, [0, 7.5 / 4.5, 0]);
  assert.equal(result.conservation.conserved, true);
});

test('a vacant companion activates on melt and a vacant primary reactivates on freeze', () => {
  const meltPair = carrierPair({ primaryFraction: 0.25 });
  meltPair.primary.massKg = 10;
  meltPair.companion.massKg = 0;
  meltPair.companion.phaseComponents = [];
  const melted = redistribute(meltPair);
  assert.equal(melted.ok, true);
  nearlyEqual(melted.primary.massKg, 7.5);
  nearlyEqual(melted.companion.massKg, 2.5);
  nearlyEqualVector(melted.primary.positionM, meltPair.primary.positionM);
  nearlyEqualVector(melted.companion.positionM, meltPair.primary.positionM);
  nearlyEqualVector(melted.primary.velocityMPerS, meltPair.primary.velocityMPerS);
  nearlyEqualVector(melted.companion.velocityMPerS, meltPair.primary.velocityMPerS);
  assert.equal(melted.conservation.conserved, true);

  const freezePair = carrierPair({ primaryFraction: 0.25, companionFraction: 0.25 });
  freezePair.primary.massKg = 0;
  freezePair.primary.phaseComponents = [];
  freezePair.companion.massKg = 10;
  const frozen = redistribute(freezePair);
  assert.equal(frozen.ok, true);
  nearlyEqual(frozen.primary.massKg, 7.5);
  nearlyEqual(frozen.companion.massKg, 2.5);
  nearlyEqualVector(frozen.primary.positionM, freezePair.companion.positionM);
  nearlyEqualVector(frozen.companion.positionM, freezePair.companion.positionM);
  nearlyEqualVector(frozen.primary.velocityMPerS, freezePair.companion.velocityMPerS);
  nearlyEqualVector(frozen.companion.velocityMPerS, freezePair.companion.velocityMPerS);
  assert.equal(frozen.conservation.conserved, true);
});

test('more than two positive phases reject without changing either reserved slot', () => {
  const pair = carrierPair({ primaryFraction: 0.5 });
  pair.primary.phaseComponents = [
    { phaseId: 0, fraction: 0.3, specificInternalEnergyJPerKg: 100 },
    { phaseId: 1, fraction: 0.3, specificInternalEnergyJPerKg: 200 },
    { phaseId: 2, fraction: 0.4, specificInternalEnergyJPerKg: 300 }
  ];
  pair.primary.specificInternalEnergyJPerKg = 230;
  const before = structuredClone(pair);
  const result = redistribute(pair);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'rejected-more-than-two-positive-phases');
  assert.equal(result.conservation, null);
  assert.deepEqual(result.primary, before.primary);
  assert.deepEqual(result.companion, before.companion);
  assert.deepEqual(pair, before);
});

test('invalid topology, thermodynamics, or numerics fail closed without source mutation', () => {
  const cases = [
    {
      reason: 'lineage-mismatch',
      mutate(pair) { pair.companion.lineageId = 'different-lineage'; }
    },
    {
      reason: 'primary-slot-role-mismatch',
      mutate(pair) { pair.primary.slotRole = 'companion'; }
    },
    {
      reason: 'slot-ids-not-distinct',
      mutate(pair) { pair.companion.slotId = pair.primary.slotId; }
    },
    {
      reason: 'phase-fractions-do-not-sum-to-one',
      mutate(pair) { pair.primary.phaseComponents[0].fraction = 0.2; }
    },
    {
      reason: 'phase-energy-reconstruction-mismatch',
      mutate(pair) { pair.primary.specificInternalEnergyJPerKg += 10_000; }
    },
    {
      reason: 'duplicate-phase-component',
      mutate(pair) { pair.primary.phaseComponents[1].phaseId = PRIMARY_PHASE_ID; }
    },
    {
      reason: 'phase-outside-declared-pair',
      mutate(pair) {
        pair.primary.massKg = 10;
        pair.primary.phaseComponents[1].phaseId = 2;
        pair.companion.massKg = 0;
        pair.companion.phaseComponents = [];
      }
    },
    {
      reason: 'companion-velocity-invalid',
      mutate(pair) { pair.companion.velocityMPerS[2] = Number.NaN; }
    },
    {
      reason: 'primary-mass-invalid',
      mutate(pair) { pair.primary.massKg = -1; }
    }
  ];

  for (const fixture of cases) {
    const pair = carrierPair({ primaryFraction: 0.5 });
    fixture.mutate(pair);
    const before = structuredClone(pair);
    const result = redistribute(pair);
    assert.equal(result.ok, false, fixture.reason);
    assert.equal(result.reason, fixture.reason);
    assert.equal(result.status, `rejected-${fixture.reason}`);
    assert.equal(result.conservation, null);
    assert.deepEqual(result.primary, before.primary, fixture.reason);
    assert.deepEqual(result.companion, before.companion, fixture.reason);
    assert.deepEqual(pair, before, `${fixture.reason}: source pair was mutated`);
  }
});

test('four-phase-lane malformed, non-adjacent, and energy-inconsistent input fails closed', () => {
  const cases = [
    {
      reason: 'slot-count-not-four',
      mutate(slots) { slots.pop(); }
    },
    {
      reason: 'phase-2-slot-phase-id-mismatch',
      mutate(slots) { slots[1].phaseId = 3; }
    },
    {
      reason: 'slot-ids-not-distinct',
      mutate(slots) { slots[3].slotId = slots[0].slotId; }
    },
    {
      reason: 'lineage-mismatch',
      mutate(slots) { slots[2].lineageId = 'different-lineage'; }
    },
    {
      reason: 'phase-1-component-count-invalid',
      mutate(slots) {
        slots[0].phaseComponents.push(fourPhaseComponent(3, 0));
      }
    },
    {
      reason: 'phase-components-not-adjacent',
      mutate(slots) {
        slots[0].phaseComponents = [
          fourPhaseComponent(1, 0.5),
          fourPhaseComponent(3, 0.5)
        ];
        slots[0].specificInternalEnergyJPerKg = 200_000;
      }
    },
    {
      reason: 'phase-fractions-do-not-sum-to-one',
      mutate(slots) { slots[1].phaseComponents[0].fraction = 0.25; }
    },
    {
      reason: 'phase-energy-reconstruction-mismatch',
      mutate(slots) { slots[1].specificInternalEnergyJPerKg += 1_000; }
    },
    {
      reason: 'duplicate-phase-component',
      mutate(slots) { slots[1].phaseComponents[1].phaseId = 2; }
    },
    {
      reason: 'phase-component-invalid',
      mutate(slots) { slots[0].phaseComponents[0].fraction = Number.NaN; }
    },
    {
      reason: 'phase-4-vacant-slot-has-components',
      mutate(slots) { slots[3].phaseComponents = [fourPhaseComponent(4, 1)]; }
    }
  ];

  for (const fixture of cases) {
    const slots = fourPhaseLaneSlots();
    fixture.mutate(slots);
    const before = structuredClone(slots);
    const result = redistributeFourPhaseLaneCarrierReference({ slots });

    assert.equal(result.ok, false, fixture.reason);
    assert.equal(result.schema, ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_V2_SCHEMA);
    assert.equal(result.reason, fixture.reason);
    assert.equal(result.status, `rejected-${fixture.reason}`);
    assert.equal(result.conservation, null);
    assert.deepEqual(result.slots, before, fixture.reason);
    assert.deepEqual(slots, before, `${fixture.reason}: source slots were mutated`);
  }
});
