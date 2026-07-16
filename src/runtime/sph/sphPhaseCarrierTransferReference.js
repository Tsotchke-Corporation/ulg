// Deterministic CPU reference for redistributing one thermodynamic lineage across
// two mechanically independent carrier slots during a two-phase plateau.
//
// This is intentionally a small, allocation-only oracle rather than a runtime
// kernel. Each source slot supplies the phase decomposition produced by the
// thermal closure. A component carries both its mass fraction and its endpoint
// specific internal energy, so a plateau source satisfies
//
//   u_source = sum(f_phase * u_phase).
//
// The redistribution then accumulates mass, momentum, position first moment,
// and internal energy per phase. The lower/primary phase always materializes in
// the primary slot and the upper/companion phase always materializes in the
// companion slot, regardless of whether the upper fraction is below or above
// 50 percent. Invalid input is rejected without mutating either source slot.

export const ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_SCHEMA =
  'peercompute.ulg.sph-phase-carrier-transfer-reference.v1';

export const ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_V2_SCHEMA =
  'peercompute.ulg.sph-phase-carrier-transfer-reference.v2';

const DEFAULT_RELATIVE_TOLERANCE = 1e-10;
const VECTOR_WIDTH = 3;
const FOUR_PHASE_LANE_IDS = Object.freeze([1, 2, 3, 4]);
const FOUR_PHASE_LANE_ID_SET = new Set(FOUR_PHASE_LANE_IDS);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneCarrier(carrier) {
  if (!isRecord(carrier)) return carrier;
  return {
    ...carrier,
    positionM: Array.isArray(carrier.positionM) ? [...carrier.positionM] : carrier.positionM,
    velocityMPerS: Array.isArray(carrier.velocityMPerS)
      ? [...carrier.velocityMPerS]
      : carrier.velocityMPerS,
    phaseComponents: Array.isArray(carrier.phaseComponents)
      ? carrier.phaseComponents.map((component) => (
        isRecord(component) ? { ...component } : component
      ))
      : carrier.phaseComponents
  };
}

function finiteVector(value) {
  return Array.isArray(value)
    && value.length === VECTOR_WIDTH
    && value.every(Number.isFinite);
}

function validPhaseId(value) {
  return Number.isInteger(value) && value >= 0;
}

function scaledTolerance(values, relativeTolerance) {
  let scale = 1;
  for (const value of values) {
    if (Number.isFinite(value)) scale = Math.max(scale, Math.abs(value));
  }
  return relativeTolerance * scale;
}

function nearlyEqual(left, right, relativeTolerance) {
  return Math.abs(left - right) <= scaledTolerance([left, right], relativeTolerance);
}

function sumVector(left, right) {
  return left.map((value, axis) => value + right[axis]);
}

function subtractVector(left, right) {
  return left.map((value, axis) => value - right[axis]);
}

function scaledVector(value, scale) {
  return value.map((component) => component * scale);
}

function zeroVector() {
  return Array(VECTOR_WIDTH).fill(0);
}

function emptyPhaseAccumulator() {
  return {
    massKg: 0,
    momentumKgMPerS: zeroVector(),
    firstMomentKgM: zeroVector(),
    internalEnergyJ: 0,
    kineticEnergyJ: 0,
    totalEnergyJ: 0
  };
}

function carrierTotals(carrier) {
  const massKg = carrier.massKg;
  const velocitySquared = carrier.velocityMPerS.reduce(
    (sum, component) => sum + component * component,
    0
  );
  const internalEnergyJ = massKg * carrier.specificInternalEnergyJPerKg;
  const kineticEnergyJ = 0.5 * massKg * velocitySquared;
  return {
    massKg,
    momentumKgMPerS: scaledVector(carrier.velocityMPerS, massKg),
    firstMomentKgM: scaledVector(carrier.positionM, massKg),
    internalEnergyJ,
    kineticEnergyJ,
    totalEnergyJ: internalEnergyJ + kineticEnergyJ
  };
}

function pairTotals(primary, companion) {
  const primaryTotals = carrierTotals(primary);
  const companionTotals = carrierTotals(companion);
  return {
    massKg: primaryTotals.massKg + companionTotals.massKg,
    momentumKgMPerS: sumVector(
      primaryTotals.momentumKgMPerS,
      companionTotals.momentumKgMPerS
    ),
    firstMomentKgM: sumVector(
      primaryTotals.firstMomentKgM,
      companionTotals.firstMomentKgM
    ),
    internalEnergyJ: primaryTotals.internalEnergyJ + companionTotals.internalEnergyJ,
    kineticEnergyJ: primaryTotals.kineticEnergyJ + companionTotals.kineticEnergyJ,
    totalEnergyJ: primaryTotals.totalEnergyJ + companionTotals.totalEnergyJ
  };
}

function conservationReport(before, after, relativeTolerance) {
  const delta = {
    massKg: after.massKg - before.massKg,
    momentumKgMPerS: subtractVector(after.momentumKgMPerS, before.momentumKgMPerS),
    firstMomentKgM: subtractVector(after.firstMomentKgM, before.firstMomentKgM),
    internalEnergyJ: after.internalEnergyJ - before.internalEnergyJ
  };
  const momentumConserved = delta.momentumKgMPerS.every((value, axis) => nearlyEqual(
    after.momentumKgMPerS[axis],
    before.momentumKgMPerS[axis],
    relativeTolerance
  ));
  const firstMomentConserved = delta.firstMomentKgM.every((value, axis) => nearlyEqual(
    after.firstMomentKgM[axis],
    before.firstMomentKgM[axis],
    relativeTolerance
  ));
  return {
    before,
    after,
    delta,
    massConserved: nearlyEqual(after.massKg, before.massKg, relativeTolerance),
    momentumConserved,
    firstMomentConserved,
    internalEnergyConserved: nearlyEqual(
      after.internalEnergyJ,
      before.internalEnergyJ,
      relativeTolerance
    ),
    conserved: nearlyEqual(after.massKg, before.massKg, relativeTolerance)
      && momentumConserved
      && firstMomentConserved
      && nearlyEqual(after.internalEnergyJ, before.internalEnergyJ, relativeTolerance)
  };
}

function rejectedResult(reason, primary, companion) {
  return {
    schema: ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_SCHEMA,
    ok: false,
    status: `rejected-${reason}`,
    reason,
    primary: cloneCarrier(primary),
    companion: cloneCarrier(companion),
    conservation: null
  };
}

function validateCarrier(carrier, expectedRole, expectedPhaseId) {
  if (!isRecord(carrier)) return 'carrier-not-an-object';
  if (carrier.slotRole !== expectedRole) return `${expectedRole}-slot-role-mismatch`;
  if (carrier.phaseId !== expectedPhaseId) return `${expectedRole}-phase-id-mismatch`;
  if (carrier.slotId === null || carrier.slotId === undefined || carrier.slotId === '') {
    return `${expectedRole}-slot-id-missing`;
  }
  if (!Number.isFinite(carrier.massKg) || carrier.massKg < 0) {
    return `${expectedRole}-mass-invalid`;
  }
  if (!finiteVector(carrier.positionM)) return `${expectedRole}-position-invalid`;
  if (!finiteVector(carrier.velocityMPerS)) return `${expectedRole}-velocity-invalid`;
  if (!Number.isFinite(carrier.specificInternalEnergyJPerKg)) {
    return `${expectedRole}-specific-internal-energy-invalid`;
  }
  if (!Array.isArray(carrier.phaseComponents)) {
    return `${expectedRole}-phase-components-invalid`;
  }
  return null;
}

function materializePhaseSlot(sourceSlot, phaseId, accumulator) {
  const output = cloneCarrier(sourceSlot);
  output.phaseId = phaseId;
  output.massKg = accumulator.massKg;
  if (accumulator.massKg > 0) {
    const inverseMass = 1 / accumulator.massKg;
    output.positionM = scaledVector(accumulator.firstMomentKgM, inverseMass);
    output.velocityMPerS = scaledVector(accumulator.momentumKgMPerS, inverseMass);
    output.specificInternalEnergyJPerKg = accumulator.internalEnergyJ * inverseMass;
    output.phaseComponents = [{
      phaseId,
      fraction: 1,
      specificInternalEnergyJPerKg: output.specificInternalEnergyJPerKg
    }];
  } else {
    // A vacant role remains a stable reserved slot. Its kinematic anchor and
    // specific energy do not contribute to any invariant and stay untouched.
    output.phaseComponents = [];
  }
  return output;
}

/**
 * Redistribute a primary/companion carrier pair into two phase-pure slots.
 *
 * Required carrier fields:
 *   slotId, slotRole, lineageId, phaseId, massKg, positionM[3],
 *   velocityMPerS[3], specificInternalEnergyJPerKg, and phaseComponents.
 *
 * Each positive-mass carrier's phaseComponents must contain one or two rows:
 *   { phaseId, fraction, specificInternalEnergyJPerKg }.
 * Fractions must sum to one and their endpoint-energy mixture must reconstruct
 * the carrier's specific internal energy. The explicit phase pair fixes slot
 * roles and prevents the historical 50-percent dominant-phase swap.
 */
export function redistributeTwoSlotPhaseCarrierReference({
  primary,
  companion,
  primaryPhaseId,
  companionPhaseId,
  relativeTolerance = DEFAULT_RELATIVE_TOLERANCE
} = {}) {
  if (!validPhaseId(primaryPhaseId)
    || !validPhaseId(companionPhaseId)
    || primaryPhaseId === companionPhaseId) {
    return rejectedResult('phase-pair-invalid', primary, companion);
  }
  if (!Number.isFinite(relativeTolerance) || relativeTolerance <= 0) {
    return rejectedResult('relative-tolerance-invalid', primary, companion);
  }

  const primaryError = validateCarrier(primary, 'primary', primaryPhaseId);
  if (primaryError) return rejectedResult(primaryError, primary, companion);
  const companionError = validateCarrier(companion, 'companion', companionPhaseId);
  if (companionError) return rejectedResult(companionError, primary, companion);
  if (primary.slotId === companion.slotId) {
    return rejectedResult('slot-ids-not-distinct', primary, companion);
  }
  if (primary.lineageId === null
    || primary.lineageId === undefined
    || primary.lineageId !== companion.lineageId) {
    return rejectedResult('lineage-mismatch', primary, companion);
  }
  if (!(primary.massKg + companion.massKg > 0)) {
    return rejectedResult('pair-mass-not-positive', primary, companion);
  }

  const sources = [primary, companion];
  const positivePhaseIds = new Set();
  for (const source of sources) {
    for (const component of source.phaseComponents) {
      if (!isRecord(component)
        || !validPhaseId(component.phaseId)
        || !Number.isFinite(component.fraction)
        || component.fraction < 0
        || component.fraction > 1
        || !Number.isFinite(component.specificInternalEnergyJPerKg)) {
        return rejectedResult('phase-component-invalid', primary, companion);
      }
      if (component.fraction > 0) positivePhaseIds.add(component.phaseId);
    }
  }
  if (positivePhaseIds.size > 2) {
    return rejectedResult('more-than-two-positive-phases', primary, companion);
  }
  for (const phaseId of positivePhaseIds) {
    if (phaseId !== primaryPhaseId && phaseId !== companionPhaseId) {
      return rejectedResult('phase-outside-declared-pair', primary, companion);
    }
  }

  for (const source of sources) {
    if (source.massKg === 0) continue;
    if (source.phaseComponents.length === 0) {
      return rejectedResult('positive-mass-source-has-no-components', primary, companion);
    }
    const componentIds = new Set();
    let fractionSum = 0;
    let reconstructedSpecificEnergy = 0;
    for (const component of source.phaseComponents) {
      if (componentIds.has(component.phaseId)) {
        return rejectedResult('duplicate-phase-component', primary, companion);
      }
      componentIds.add(component.phaseId);
      fractionSum += component.fraction;
      reconstructedSpecificEnergy += (
        component.fraction * component.specificInternalEnergyJPerKg
      );
    }
    if (!nearlyEqual(fractionSum, 1, relativeTolerance)) {
      return rejectedResult('phase-fractions-do-not-sum-to-one', primary, companion);
    }
    if (!nearlyEqual(
      reconstructedSpecificEnergy,
      source.specificInternalEnergyJPerKg,
      relativeTolerance
    )) {
      return rejectedResult('phase-energy-reconstruction-mismatch', primary, companion);
    }
  }

  const byPhase = new Map([
    [primaryPhaseId, emptyPhaseAccumulator()],
    [companionPhaseId, emptyPhaseAccumulator()]
  ]);
  for (const source of sources) {
    for (const component of source.phaseComponents) {
      if (component.fraction === 0 || source.massKg === 0) continue;
      const accumulator = byPhase.get(component.phaseId);
      if (!accumulator) {
        return rejectedResult('phase-outside-declared-pair', primary, companion);
      }
      const componentMassKg = source.massKg * component.fraction;
      accumulator.massKg += componentMassKg;
      accumulator.momentumKgMPerS = sumVector(
        accumulator.momentumKgMPerS,
        scaledVector(source.velocityMPerS, componentMassKg)
      );
      accumulator.firstMomentKgM = sumVector(
        accumulator.firstMomentKgM,
        scaledVector(source.positionM, componentMassKg)
      );
      accumulator.internalEnergyJ += (
        componentMassKg * component.specificInternalEnergyJPerKg
      );
    }
  }

  const nextPrimary = materializePhaseSlot(primary, primaryPhaseId, byPhase.get(primaryPhaseId));
  const nextCompanion = materializePhaseSlot(
    companion,
    companionPhaseId,
    byPhase.get(companionPhaseId)
  );
  const numericOutputs = [
    nextPrimary.massKg,
    nextCompanion.massKg,
    nextPrimary.specificInternalEnergyJPerKg,
    nextCompanion.specificInternalEnergyJPerKg,
    ...nextPrimary.positionM,
    ...nextCompanion.positionM,
    ...nextPrimary.velocityMPerS,
    ...nextCompanion.velocityMPerS
  ];
  if (!numericOutputs.every(Number.isFinite)) {
    return rejectedResult('non-finite-output', primary, companion);
  }

  const before = pairTotals(primary, companion);
  const after = pairTotals(nextPrimary, nextCompanion);
  const conservation = conservationReport(before, after, relativeTolerance);
  if (!conservation.conserved) {
    return rejectedResult('conservation-check-failed', primary, companion);
  }

  return {
    schema: ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_SCHEMA,
    ok: true,
    status: 'redistributed-two-slot-phase-carriers',
    reason: null,
    primary: nextPrimary,
    companion: nextCompanion,
    conservation
  };
}

function cloneCarrierSlots(slots) {
  return Array.isArray(slots) ? slots.map(cloneCarrier) : slots;
}

function rejectedFourPhaseLaneResult(reason, slots) {
  return {
    schema: ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_V2_SCHEMA,
    ok: false,
    status: `rejected-${reason}`,
    reason,
    slots: cloneCarrierSlots(slots),
    conservation: null
  };
}

function carrierArrayTotals(carriers) {
  const totals = emptyPhaseAccumulator();
  for (const carrier of carriers) {
    const source = carrierTotals(carrier);
    totals.massKg += source.massKg;
    totals.momentumKgMPerS = sumVector(
      totals.momentumKgMPerS,
      source.momentumKgMPerS
    );
    totals.firstMomentKgM = sumVector(
      totals.firstMomentKgM,
      source.firstMomentKgM
    );
    totals.internalEnergyJ += source.internalEnergyJ;
    totals.kineticEnergyJ += source.kineticEnergyJ;
    totals.totalEnergyJ += source.totalEnergyJ;
  }
  return totals;
}

function finiteTotals(totals) {
  return Number.isFinite(totals.massKg)
    && finiteVector(totals.momentumKgMPerS)
    && finiteVector(totals.firstMomentKgM)
    && Number.isFinite(totals.internalEnergyJ)
    && Number.isFinite(totals.kineticEnergyJ)
    && Number.isFinite(totals.totalEnergyJ);
}

function materializeFourPhaseLaneSlot(sourceSlot, phaseId, accumulator) {
  const output = cloneCarrier(sourceSlot);
  output.phaseId = phaseId;
  output.massKg = accumulator.massKg;
  if (accumulator.massKg > 0) {
    const inverseMass = 1 / accumulator.massKg;
    output.positionM = scaledVector(accumulator.firstMomentKgM, inverseMass);
    output.velocityMPerS = scaledVector(accumulator.momentumKgMPerS, inverseMass);
    const mergedVelocitySquared = output.velocityMPerS.reduce(
      (sum, component) => sum + component * component,
      0
    );
    const mergedKineticEnergyJ = 0.5 * accumulator.massKg * mergedVelocitySquared;
    const thermalizedKineticEnergyJ = Math.max(
      accumulator.kineticEnergyJ - mergedKineticEnergyJ,
      0
    );
    output.specificInternalEnergyJPerKg = (
      accumulator.internalEnergyJ + thermalizedKineticEnergyJ
    ) * inverseMass;
    output.phaseComponents = [{
      phaseId,
      fraction: 1,
      specificInternalEnergyJPerKg: output.specificInternalEnergyJPerKg
    }];
  } else {
    output.phaseComponents = [];
  }
  return output;
}

function totalEnergyConservationReport(before, after, relativeTolerance) {
  const base = conservationReport(before, after, relativeTolerance);
  const kineticEnergyDeltaJ = after.kineticEnergyJ - before.kineticEnergyJ;
  const totalEnergyDeltaJ = after.totalEnergyJ - before.totalEnergyJ;
  const totalEnergyConserved = nearlyEqual(
    after.totalEnergyJ,
    before.totalEnergyJ,
    relativeTolerance
  );
  return {
    ...base,
    delta: {
      ...base.delta,
      kineticEnergyJ: kineticEnergyDeltaJ,
      totalEnergyJ: totalEnergyDeltaJ
    },
    kineticEnergyConserved: nearlyEqual(
      after.kineticEnergyJ,
      before.kineticEnergyJ,
      relativeTolerance
    ),
    totalEnergyConserved,
    relativeKineticEnergyThermalizedJ: Math.max(-kineticEnergyDeltaJ, 0),
    conserved: base.massConserved
      && base.momentumConserved
      && base.firstMomentConserved
      && totalEnergyConserved
  };
}

function validateFourPhaseLaneCarrier(carrier, expectedPhaseId) {
  const prefix = `phase-${expectedPhaseId}`;
  if (!isRecord(carrier)) return `${prefix}-slot-not-an-object`;
  if (carrier.phaseId !== expectedPhaseId) return `${prefix}-slot-phase-id-mismatch`;
  if (carrier.slotId === null || carrier.slotId === undefined || carrier.slotId === '') {
    return `${prefix}-slot-id-missing`;
  }
  if (carrier.lineageId === null || carrier.lineageId === undefined) {
    return `${prefix}-lineage-id-missing`;
  }
  if (!Number.isFinite(carrier.massKg) || carrier.massKg < 0) {
    return `${prefix}-mass-invalid`;
  }
  if (!finiteVector(carrier.positionM)) return `${prefix}-position-invalid`;
  if (!finiteVector(carrier.velocityMPerS)) return `${prefix}-velocity-invalid`;
  if (!Number.isFinite(carrier.specificInternalEnergyJPerKg)) {
    return `${prefix}-specific-internal-energy-invalid`;
  }
  if (!Array.isArray(carrier.phaseComponents)) {
    return `${prefix}-phase-components-invalid`;
  }
  if (carrier.massKg === 0 && carrier.phaseComponents.length !== 0) {
    return `${prefix}-vacant-slot-has-components`;
  }
  if (carrier.massKg > 0
    && (carrier.phaseComponents.length < 1 || carrier.phaseComponents.length > 2)) {
    return `${prefix}-component-count-invalid`;
  }
  return null;
}

/**
 * Redistribute one lineage across four stable, phase-pure carrier lanes.
 *
 * `slots` must contain exactly four carriers in phase-lane order. Slot zero is
 * fixed to phase 1, slot one to phase 2, slot two to phase 3, and slot three to
 * phase 4. A positive-mass source describes itself with one pure component or
 * two components whose phase IDs are adjacent. Components may target lanes
 * other than their source lane, which permits a single call to collect, for
 * example, solid, liquid, and gas carried by different source slots.
 *
 * Each output lane is either vacant (`phaseComponents: []`) or one-hot for its
 * fixed phase. Slot identity and caller-owned metadata are inherited from the
 * corresponding fixed destination lane. Input slots are never mutated.
 */
export function redistributeFourPhaseLaneCarrierReference({
  slots,
  relativeTolerance = DEFAULT_RELATIVE_TOLERANCE
} = {}) {
  if (!Array.isArray(slots)) {
    return rejectedFourPhaseLaneResult('slots-not-an-array', slots);
  }
  if (slots.length !== FOUR_PHASE_LANE_IDS.length) {
    return rejectedFourPhaseLaneResult('slot-count-not-four', slots);
  }
  if (!Number.isFinite(relativeTolerance) || relativeTolerance <= 0) {
    return rejectedFourPhaseLaneResult('relative-tolerance-invalid', slots);
  }

  for (let laneIndex = 0; laneIndex < FOUR_PHASE_LANE_IDS.length; laneIndex += 1) {
    const laneError = validateFourPhaseLaneCarrier(
      slots[laneIndex],
      FOUR_PHASE_LANE_IDS[laneIndex]
    );
    if (laneError) return rejectedFourPhaseLaneResult(laneError, slots);
  }

  const slotIds = new Set(slots.map((slot) => slot.slotId));
  if (slotIds.size !== slots.length) {
    return rejectedFourPhaseLaneResult('slot-ids-not-distinct', slots);
  }
  const lineageId = slots[0].lineageId;
  if (slots.some((slot) => slot.lineageId !== lineageId)) {
    return rejectedFourPhaseLaneResult('lineage-mismatch', slots);
  }
  if (!(slots.reduce((massKg, slot) => massKg + slot.massKg, 0) > 0)) {
    return rejectedFourPhaseLaneResult('lineage-mass-not-positive', slots);
  }

  const normalizedComponents = [];
  for (let laneIndex = 0; laneIndex < slots.length; laneIndex += 1) {
    const source = slots[laneIndex];
    if (source.massKg === 0) {
      normalizedComponents.push([]);
      continue;
    }

    const components = [];
    const componentPhaseIds = new Set();
    for (const component of source.phaseComponents) {
      if (!isRecord(component)
        || !FOUR_PHASE_LANE_ID_SET.has(component.phaseId)
        || !Number.isFinite(component.fraction)
        || component.fraction < 0
        || component.fraction > 1
        || !Number.isFinite(component.specificInternalEnergyJPerKg)) {
        return rejectedFourPhaseLaneResult('phase-component-invalid', slots);
      }
      if (componentPhaseIds.has(component.phaseId)) {
        return rejectedFourPhaseLaneResult('duplicate-phase-component', slots);
      }
      componentPhaseIds.add(component.phaseId);
      components.push(component);
    }
    components.sort((left, right) => left.phaseId - right.phaseId);
    if (components.length === 2
      && components[1].phaseId !== components[0].phaseId + 1) {
      return rejectedFourPhaseLaneResult('phase-components-not-adjacent', slots);
    }

    let fractionSum = 0;
    let reconstructedSpecificEnergy = 0;
    for (const component of components) {
      fractionSum += component.fraction;
      reconstructedSpecificEnergy += (
        component.fraction * component.specificInternalEnergyJPerKg
      );
    }
    if (!nearlyEqual(fractionSum, 1, relativeTolerance)) {
      return rejectedFourPhaseLaneResult('phase-fractions-do-not-sum-to-one', slots);
    }
    if (!nearlyEqual(
      reconstructedSpecificEnergy,
      source.specificInternalEnergyJPerKg,
      relativeTolerance
    )) {
      return rejectedFourPhaseLaneResult('phase-energy-reconstruction-mismatch', slots);
    }
    normalizedComponents.push(components);
  }

  const before = carrierArrayTotals(slots);
  if (!finiteTotals(before)) {
    return rejectedFourPhaseLaneResult('source-totals-non-finite', slots);
  }

  const byPhase = new Map(FOUR_PHASE_LANE_IDS.map((phaseId) => (
    [phaseId, emptyPhaseAccumulator()]
  )));
  for (let laneIndex = 0; laneIndex < slots.length; laneIndex += 1) {
    const source = slots[laneIndex];
    for (const component of normalizedComponents[laneIndex]) {
      if (component.fraction === 0) continue;
      const componentMassKg = source.massKg * component.fraction;
      const accumulator = byPhase.get(component.phaseId);
      accumulator.massKg += componentMassKg;
      accumulator.momentumKgMPerS = sumVector(
        accumulator.momentumKgMPerS,
        scaledVector(source.velocityMPerS, componentMassKg)
      );
      accumulator.firstMomentKgM = sumVector(
        accumulator.firstMomentKgM,
        scaledVector(source.positionM, componentMassKg)
      );
      accumulator.internalEnergyJ += (
        componentMassKg * component.specificInternalEnergyJPerKg
      );
      accumulator.kineticEnergyJ += 0.5 * componentMassKg
        * source.velocityMPerS.reduce(
          (sum, velocity) => sum + velocity * velocity,
          0
        );
    }
  }

  const nextSlots = FOUR_PHASE_LANE_IDS.map((phaseId, laneIndex) => (
    materializeFourPhaseLaneSlot(slots[laneIndex], phaseId, byPhase.get(phaseId))
  ));
  const numericOutputs = nextSlots.flatMap((slot) => [
    slot.massKg,
    slot.specificInternalEnergyJPerKg,
    ...slot.positionM,
    ...slot.velocityMPerS
  ]);
  if (!numericOutputs.every(Number.isFinite)) {
    return rejectedFourPhaseLaneResult('non-finite-output', slots);
  }

  const after = carrierArrayTotals(nextSlots);
  if (!finiteTotals(after)) {
    return rejectedFourPhaseLaneResult('non-finite-output-totals', slots);
  }
  const conservation = totalEnergyConservationReport(before, after, relativeTolerance);
  if (!conservation.conserved) {
    return rejectedFourPhaseLaneResult('conservation-check-failed', slots);
  }

  return {
    schema: ULG_SPH_PHASE_CARRIER_TRANSFER_REFERENCE_V2_SCHEMA,
    ok: true,
    status: 'redistributed-four-phase-lane-carriers',
    reason: null,
    slots: nextSlots,
    conservation
  };
}
