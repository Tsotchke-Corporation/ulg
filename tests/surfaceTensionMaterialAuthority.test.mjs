import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createReferenceAnchoredMaterialClosure
} from '../src/runtime/material/materialDerivation.js';
import {
  buildMlsMpmMechanicsMaterialTable,
  findMechanicsMaterialPhaseRecord
} from '../src/runtime/sph/sphMechanicsMaterialTable.js';
import {
  gpuPhaseId,
  stableOpticalMaterialId
} from '../src/runtime/material/opticalGpuBuffers.js';

test('reference anchoring carries Fe liquid transport coefficients into CSS', () => {
  const properties = createReferenceAnchoredMaterialClosure('fe').properties;
  const solid = properties.phases.find((phase) => phase.name === 'solid');
  const liquid = properties.phases.find((phase) => phase.name === 'liquid');

  assert.equal(solid.surfaceTensionNPerM, undefined);
  assert.equal(liquid.dynamicViscosityPaS, 0.006);
  assert.equal(liquid.surfaceTensionNPerM, 1.9);
  assert.deepEqual(
    properties.referenceBankAnchoring.derivationResiduals
      .liquidSurfaceTension,
    {
      derivedSurfaceTensionNPerM: null,
      referenceSurfaceTensionNPerM: 1.9
    }
  );

  const enabled = buildMlsMpmMechanicsMaterialTable(
    { fe: properties },
    { surfaceTensionEnabled: true }
  );
  const liquidRecord = findMechanicsMaterialPhaseRecord(
    enabled,
    stableOpticalMaterialId('fe'),
    gpuPhaseId('liquid')
  );
  assert.equal(liquidRecord.surfaceTensionNPerM, Math.fround(1.9));
  assert.equal(enabled.positiveSurfaceTensionPhaseRecordCount, 1);
  assert.equal(
    enabled.surfaceTensionCoefficientStatus,
    'positive-surface-tension-coefficient-ready'
  );

  const disabled = buildMlsMpmMechanicsMaterialTable(
    { fe: properties },
    { surfaceTensionEnabled: false }
  );
  assert.equal(
    findMechanicsMaterialPhaseRecord(
      disabled,
      stableOpticalMaterialId('fe'),
      gpuPhaseId('liquid')
    ).surfaceTensionNPerM,
    0
  );
  assert.equal(disabled.positiveSurfaceTensionPhaseRecordCount, 0);
  assert.equal(
    disabled.surfaceTensionCoefficientStatus,
    'surface-tension-disabled'
  );
});
