export const ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROWS_SCHEMA =
  'peercompute.ulg.algorithm-material-particle-initialization-rows.v0';
export const ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROW_SCHEMA =
  'peercompute.ulg.algorithm-material-particle-initialization-row.v0';
export const ULG_ALGORITHM_MLS_MPM_MECHANICS_ROWS_SCHEMA =
  'peercompute.ulg.algorithm-material-mls-mpm-mechanics-rows.v0';
export const ULG_ALGORITHM_MLS_MPM_MECHANICS_ROW_SCHEMA =
  'peercompute.ulg.algorithm-material-mls-mpm-mechanics-row.v0';
export const ULG_ALGORITHM_CONTACT_MATERIAL_ROWS_SCHEMA =
  'peercompute.ulg.algorithm-material-contact-rows.v0';
export const ULG_ALGORITHM_CONTACT_MATERIAL_ROW_SCHEMA =
  'peercompute.ulg.algorithm-material-contact-row.v0';
export const ULG_ALGORITHM_SURFACE_EXTRACTION_ROWS_SCHEMA =
  'peercompute.ulg.algorithm-material-surface-extraction-rows.v0';
export const ULG_ALGORITHM_SURFACE_EXTRACTION_ROW_SCHEMA =
  'peercompute.ulg.algorithm-material-surface-extraction-row.v0';

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) ? fallbackNumber : 0;
}

function particleRadiusFromCrystalPackingFraction(spacingM, packingFraction) {
  const spacing = finiteNumber(spacingM, 0);
  const packing = finiteNumber(packingFraction, 0);
  if (!(spacing > 0) || !(packing > 0)) return 0;
  return spacing * Math.cbrt((3 * packing) / (4 * Math.PI));
}

function roleWarmInput(warmInputs, role) {
  return warmInputs?.roles?.[role] || null;
}

function roleCrystalWarmInput(crystalWarmInputs, role) {
  return crystalWarmInputs?.roles?.[role] || null;
}

export function buildAlgorithmMaterialParticleInitializationRows({
  initialParticleSpacing = null,
  dropMaterial = null,
  baseMaterial = null,
  dropTemperatureK = null,
  baseTemperatureK = null
} = {}) {
  const spacing = initialParticleSpacing || {};
  const materialWarmInputs = spacing.materialPropertyBankWarmInputs || null;
  const crystalWarmInputs = spacing.materialPropertyCrystalStructureWarmInputs || null;
  const roleInputs = [
    { role: 'drop', requestedMaterial: dropMaterial, temperatureK: dropTemperatureK },
    { role: 'base', requestedMaterial: baseMaterial, temperatureK: baseTemperatureK }
  ];
  const rows = [];
  for (const input of roleInputs) {
    const rolePlan = spacing[input.role];
    if (!rolePlan) continue;
    const warmInput = roleWarmInput(materialWarmInputs, input.role);
    const crystalWarmInput = roleCrystalWarmInput(crystalWarmInputs, input.role);
    const crystalUnitCell = crystalWarmInput?.unitCell || {};
    const crystalPackingFraction = finiteNumber(crystalUnitCell.packingFraction, 0);
    const crystalPackingParticleRadiusM = particleRadiusFromCrystalPackingFraction(
      rolePlan.spacingM,
      crystalPackingFraction
    );
    rows.push({
      schema: ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROW_SCHEMA,
      status: 'algorithm-derived-particle-initialization-row-ready',
      role: input.role,
      requestedMaterial: input.requestedMaterial,
      material: warmInput?.material ?? input.requestedMaterial ?? null,
      materialId: finiteNumber(warmInput?.atomicNumber, 0),
      temperatureK: finiteNumber(warmInput?.temperatureK, input.temperatureK),
      pressurePa: finiteNumber(warmInput?.pressurePa ?? rolePlan.pressurePa, 0),
      densityKgPerM3: finiteNumber(rolePlan.densityKgPerM3, 0),
      particlesPerEdge: finiteNumber(rolePlan.particlesPerEdge, 0),
      spacingM: finiteNumber(rolePlan.spacingM, 0),
      restVolumeM3: finiteNumber(rolePlan.restVolumeM3, 0),
      mechanicsRestVolumeM3: finiteNumber(rolePlan.mechanicsRestVolumeM3, rolePlan.continuumCellVolumeM3),
      volumeEquivalentParticleRadiusM: finiteNumber(rolePlan.volumeEquivalentParticleRadiusM, 0),
      pressureAdjustedParticleRadiusM: finiteNumber(rolePlan.pressureAdjustedParticleRadiusM, 0),
      targetSmoothingLengthM: finiteNumber(rolePlan.targetSmoothingLengthM, 0),
      globalSmoothingLengthM: finiteNumber(rolePlan.globalSmoothingLengthM, 0),
      targetNeighborCount: finiteNumber(rolePlan.targetNeighborCount ?? spacing.targetNeighborCount, 0),
      estimatedNeighborCount: finiteNumber(rolePlan.estimatedNeighborCount, 0),
      crystalStructureKey: crystalWarmInput?.structureKey ?? null,
      crystalStructureStatus: crystalWarmInput?.status ?? null,
      crystalPackingFraction,
      crystalCoordinationNumber: finiteNumber(crystalUnitCell.coordinationNumber, 0),
      crystalAtomsPerConventionalCell: finiteNumber(crystalUnitCell.atomsPerConventionalCell, 0),
      crystalPackingParticleRadiusM,
      particleRadiusPolicy: crystalWarmInput
        ? 'global-particle-volume-authoritative-crystal-packing-diagnostic'
        : 'global-particle-volume-authoritative',
      appliedParticleRadiusM: finiteNumber(rolePlan.volumeEquivalentParticleRadiusM, 0),
      strictSourceOfTruth: false,
      provenance: {
        source: 'algorithm-derived-material-row',
        materialBankGeneratorFingerprint: materialWarmInputs?.generatorFingerprint ?? null,
        crystalBankGeneratorFingerprint: crystalWarmInputs?.generatorFingerprint ?? null,
        materialWarmInputStatus: warmInput?.status ?? null,
        crystalWarmInputStatus: crystalWarmInput?.status ?? null
      }
    });
  }
  return {
    schema: ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROWS_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-derived-particle-initialization-rows-ready'
      : 'algorithm-derived-particle-initialization-rows-empty',
    sourceSchema: spacing.schema ?? null,
    rowCount: rows.length,
    rows,
    strictSourceOfTruth: false,
    derivationAuthority: 'fundamental-closures-with-versioned-warm-inputs',
    cacheKeyParts: {
      sourceSchema: spacing.schema ?? null,
      targetNeighborCount: finiteNumber(spacing.targetNeighborCount, 0),
      materialBankGeneratorFingerprint: materialWarmInputs?.generatorFingerprint ?? null,
      crystalBankGeneratorFingerprint: crystalWarmInputs?.generatorFingerprint ?? null,
      roles: rows.map((row) => ({
        role: row.role,
        material: row.material,
        temperatureK: row.temperatureK,
        pressurePa: row.pressurePa,
        crystalStructureKey: row.crystalStructureKey
      }))
    }
  };
}

function initializationRowsByRole(particleInitializationRows) {
  const map = new Map();
  for (const row of particleInitializationRows?.rows || []) {
    if (row?.role) map.set(row.role, row);
  }
  return map;
}

function createMechanicsAccumulator({ role, material, phase, initializationRow }) {
  return {
    role,
    material,
    phase,
    initializationRow,
    particleCount: 0,
    solidParticleCount: 0,
    restVolumeM3Sum: 0,
    effectiveBulkModulusPaSum: 0,
    shearModulusPaSum: 0,
    lameLambdaPaSum: 0,
    soundSpeedMPerSSum: 0,
    dynamicViscosityPaSSum: 0,
    surfaceTensionNPerMSum: 0,
    maxHydrostaticPressurePa: 0
  };
}

export function buildAlgorithmMlsMpmMechanicsRows({
  particles = [],
  metadata = [],
  mechanics = null,
  mechanicsStrideFloats = 32,
  particleInitializationRows = null
} = {}) {
  const initRowsByRole = initializationRowsByRole(particleInitializationRows);
  const groups = new Map();
  const particleCount = Array.isArray(particles) ? particles.length : 0;
  for (let index = 0; index < particleCount; index += 1) {
    const particle = particles[index] || {};
    const meta = metadata[index] || {};
    // Spare product-placement rows are zero-mass reserves: they carry no
    // material-class statistics and must not mint a (role|material|phase)
    // class of their own.
    if (particle.spareProductSlot === true || meta.spareProductSlot === true) continue;
    const role = particle.role || meta.role || (particle.material === 'h2o' ? 'base' : 'drop');
    const material = meta.material || particle.material || 'unknown';
    const phase = meta.phase || particle.phase || 'unknown';
    const key = `${role}|${material}|${phase}`;
    let accumulator = groups.get(key);
    if (!accumulator) {
      accumulator = createMechanicsAccumulator({
        role,
        material,
        phase,
        initializationRow: initRowsByRole.get(role) || null
      });
      groups.set(key, accumulator);
    }
    const offset = index * mechanicsStrideFloats;
    accumulator.particleCount += 1;
    accumulator.solidParticleCount += finiteNumber(mechanics?.[offset + 20], meta.solid ? 1 : 0) > 0.5 ? 1 : 0;
    accumulator.restVolumeM3Sum += finiteNumber(mechanics?.[offset + 19], 0);
    accumulator.effectiveBulkModulusPaSum += finiteNumber(mechanics?.[offset + 22], meta.effectiveBulkModulusPa);
    accumulator.shearModulusPaSum += finiteNumber(mechanics?.[offset + 23], meta.shearModulusPa);
    accumulator.lameLambdaPaSum += finiteNumber(mechanics?.[offset + 24], meta.lameLambdaPa);
    accumulator.soundSpeedMPerSSum += finiteNumber(mechanics?.[offset + 25], meta.soundSpeedMPerS);
    accumulator.dynamicViscosityPaSSum += finiteNumber(mechanics?.[offset + 29], meta.dynamicViscosityPaS);
    accumulator.surfaceTensionNPerMSum += finiteNumber(mechanics?.[offset + 30], meta.surfaceTensionNPerM);
    accumulator.maxHydrostaticPressurePa = Math.max(
      accumulator.maxHydrostaticPressurePa,
      finiteNumber(mechanics?.[offset + 28], meta.hydrostaticPressurePa)
    );
  }
  const rows = [...groups.values()]
    .sort((a, b) => String(a.role).localeCompare(String(b.role)) || String(a.material).localeCompare(String(b.material)))
    .map((accumulator) => {
      const count = Math.max(1, accumulator.particleCount);
      const init = accumulator.initializationRow;
      return {
        schema: ULG_ALGORITHM_MLS_MPM_MECHANICS_ROW_SCHEMA,
        status: 'algorithm-derived-mls-mpm-mechanics-row-ready',
        role: accumulator.role,
        material: accumulator.material,
        phase: accumulator.phase,
        particleCount: accumulator.particleCount,
        solidParticleCount: accumulator.solidParticleCount,
        restVolumeM3Mean: accumulator.restVolumeM3Sum / count,
        effectiveBulkModulusPaMean: accumulator.effectiveBulkModulusPaSum / count,
        shearModulusPaMean: accumulator.shearModulusPaSum / count,
        lameLambdaPaMean: accumulator.lameLambdaPaSum / count,
        soundSpeedMPerSMean: accumulator.soundSpeedMPerSSum / count,
        dynamicViscosityPaSMean: accumulator.dynamicViscosityPaSSum / count,
        surfaceTensionNPerMMean: accumulator.surfaceTensionNPerMSum / count,
        maxHydrostaticPressurePa: accumulator.maxHydrostaticPressurePa,
        crystalStructureKey: init?.crystalStructureKey ?? null,
        crystalPackingFraction: finiteNumber(init?.crystalPackingFraction, 0),
        initializationSpacingM: finiteNumber(init?.spacingM, 0),
        initializationAppliedParticleRadiusM: finiteNumber(init?.appliedParticleRadiusM, 0),
        initializationTargetSmoothingLengthM: finiteNumber(init?.targetSmoothingLengthM, 0),
        particleInitializationRowStatus: init?.status ?? null,
        particleRadiusPolicy: init?.particleRadiusPolicy ?? null,
        strictSourceOfTruth: false,
        provenance: {
          source: 'algorithm-derived-mls-mpm-mechanics-row',
          particleInitializationRowSchema: init?.schema ?? null
        }
      };
    });
  return {
    schema: ULG_ALGORITHM_MLS_MPM_MECHANICS_ROWS_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-derived-mls-mpm-mechanics-rows-ready'
      : 'algorithm-derived-mls-mpm-mechanics-rows-empty',
    rowCount: rows.length,
    rows,
    particleCount,
    strictSourceOfTruth: false,
    derivationAuthority: 'packed-mls-mpm-mechanics-buffer-with-particle-initialization-rows'
  };
}

function nonZeroMin(values) {
  const positive = values.map((value) => finiteNumber(value, 0)).filter((value) => value > 0);
  return positive.length > 0 ? Math.min(...positive) : 0;
}

function materialContactPairRows(rows) {
  const dropRows = rows.filter((row) => row.role === 'drop');
  const baseRows = rows.filter((row) => row.role === 'base');
  const pairs = [];
  for (const drop of dropRows) {
    for (const base of baseRows) {
      pairs.push([drop, base]);
    }
  }
  return pairs;
}

export function buildAlgorithmMaterialContactRows({
  mlsMpmMechanicsRows = null
} = {}) {
  const mechanicsRows = Array.isArray(mlsMpmMechanicsRows?.rows) ? mlsMpmMechanicsRows.rows : [];
  const rows = materialContactPairRows(mechanicsRows).map(([drop, base]) => {
    const dropNormal = finiteNumber(drop.effectiveBulkModulusPaMean, 0)
      + (4 / 3) * finiteNumber(drop.shearModulusPaMean, 0);
    const baseNormal = finiteNumber(base.effectiveBulkModulusPaMean, 0)
      + (4 / 3) * finiteNumber(base.shearModulusPaMean, 0);
    const supportRadiusM = Math.max(
      finiteNumber(drop.initializationTargetSmoothingLengthM, 0),
      finiteNumber(base.initializationTargetSmoothingLengthM, 0),
      finiteNumber(drop.initializationAppliedParticleRadiusM, 0) + finiteNumber(base.initializationAppliedParticleRadiusM, 0)
    );
    return {
      schema: ULG_ALGORITHM_CONTACT_MATERIAL_ROW_SCHEMA,
      status: 'algorithm-derived-contact-row-ready',
      pairKey: `${drop.role}:${drop.material}|${base.role}:${base.material}`,
      roles: [drop.role, base.role],
      materials: [drop.material, base.material],
      phases: [drop.phase, base.phase],
      normalStiffnessPa: nonZeroMin([dropNormal, baseNormal]),
      dampingViscosityPaS: Math.max(
        finiteNumber(drop.dynamicViscosityPaSMean, 0),
        finiteNumber(base.dynamicViscosityPaSMean, 0)
      ),
      supportRadiusM,
      softerMaterial: dropNormal > 0 && baseNormal > 0 && dropNormal <= baseNormal ? drop.material : base.material,
      crystalStructureKeys: [drop.crystalStructureKey, base.crystalStructureKey],
      impulsePolicy: 'bounded-by-softer-constituent-and-initial-support-radius',
      strictSourceOfTruth: false,
      forceMutationAuthority: 'not-authoritative-contact-policy-row',
      provenance: {
        source: 'algorithm-derived-contact-row',
        mechanicsRowsSchema: mlsMpmMechanicsRows?.schema ?? null
      }
    };
  });
  return {
    schema: ULG_ALGORITHM_CONTACT_MATERIAL_ROWS_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-derived-contact-rows-ready'
      : 'algorithm-derived-contact-rows-empty',
    rowCount: rows.length,
    rows,
    strictSourceOfTruth: false,
    derivationAuthority: 'mls-mpm-mechanics-rows-contact-policy-view'
  };
}

export function buildAlgorithmSurfaceExtractionRows({
  particleInitializationRows = null,
  mlsMpmMechanicsRows = null,
  contactRows = null
} = {}) {
  const mechanicsRows = Array.isArray(mlsMpmMechanicsRows?.rows) ? mlsMpmMechanicsRows.rows : [];
  const contactSupportByRole = new Map();
  for (const row of contactRows?.rows || []) {
    for (const role of row.roles || []) {
      contactSupportByRole.set(role, Math.max(
        finiteNumber(contactSupportByRole.get(role), 0),
        finiteNumber(row.supportRadiusM, 0)
      ));
    }
  }
  const rows = (particleInitializationRows?.rows || []).map((init) => {
    const mechanics = mechanicsRows.find((row) => row.role === init.role) || null;
    const smoothingRadiusM = Math.max(
      finiteNumber(init.targetSmoothingLengthM, 0),
      finiteNumber(mechanics?.initializationTargetSmoothingLengthM, 0),
      finiteNumber(contactSupportByRole.get(init.role), 0)
    );
    const voxelSizeM = smoothingRadiusM > 0 ? smoothingRadiusM / 2 : finiteNumber(init.spacingM, 0);
    return {
      schema: ULG_ALGORITHM_SURFACE_EXTRACTION_ROW_SCHEMA,
      status: 'algorithm-derived-surface-extraction-row-ready',
      role: init.role,
      material: init.material,
      materialId: finiteNumber(init.materialId, 0),
      phase: mechanics?.phase ?? null,
      isovalue: 0.5,
      isovaluePolicy: 'density-kernel-half-occupancy',
      smoothingRadiusM,
      voxelSizeM,
      normalScaleM: smoothingRadiusM,
      supportRadiusM: finiteNumber(contactSupportByRole.get(init.role), smoothingRadiusM),
      particleRadiusM: finiteNumber(init.appliedParticleRadiusM, 0),
      crystalStructureKey: init.crystalStructureKey ?? null,
      crystalPackingFraction: finiteNumber(init.crystalPackingFraction, 0),
      drawPolicy: 'material-phase-surface-row',
      strictSourceOfTruth: false,
      rendererAuthority: 'not-renderer-authoritative-surface-policy-row',
      provenance: {
        source: 'algorithm-derived-surface-extraction-row',
        particleInitializationRowSchema: init.schema ?? null,
        mechanicsRowsSchema: mlsMpmMechanicsRows?.schema ?? null,
        contactRowsSchema: contactRows?.schema ?? null
      }
    };
  });
  return {
    schema: ULG_ALGORITHM_SURFACE_EXTRACTION_ROWS_SCHEMA,
    status: rows.length > 0
      ? 'algorithm-derived-surface-extraction-rows-ready'
      : 'algorithm-derived-surface-extraction-rows-empty',
    rowCount: rows.length,
    rows,
    strictSourceOfTruth: false,
    derivationAuthority: 'particle-initialization-mechanics-contact-surface-policy-view'
  };
}
