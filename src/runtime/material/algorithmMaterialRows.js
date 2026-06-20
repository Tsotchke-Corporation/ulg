export const ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROWS_SCHEMA =
  'peercompute.ulg.algorithm-material-particle-initialization-rows.v0';
export const ULG_ALGORITHM_PARTICLE_INITIALIZATION_ROW_SCHEMA =
  'peercompute.ulg.algorithm-material-particle-initialization-row.v0';

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
        ? 'closure-rest-volume-authoritative-crystal-packing-diagnostic'
        : 'closure-rest-volume-authoritative',
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
