import { buildOpticalGpuTable, stableOpticalStateKey } from '../material/opticalGpuBuffers.js';
import { buildSphReactionTable } from './sphReactionGpuKernel.js';
import {
  buildSphThermalClosureGraphBuffers,
  buildSphThermalMaterialTable,
  buildSphThermalPhaseResponseTable
} from './sphThermalGpuKernel.js';

function materialKeyOf(value) {
  return typeof value === 'string' && value.length > 0 ? value : 'default';
}

function surfaceKeyForDescriptor({ renderKey, material, phase, opticalState = null }) {
  const base = `${renderKey}|${material}|${phase ?? 'phase-unspecified'}`;
  const opticalStateKey = stableOpticalStateKey(opticalState);
  return opticalStateKey === 'default' ? base : `${base}|opt:${opticalStateKey}`;
}

export function renderDescriptorOf(value) {
  if (value && typeof value === 'object') {
    const renderKey = materialKeyOf(value.renderKey ?? value.key ?? value.material);
    const material = materialKeyOf(value.material ?? ((renderKey === 'steam' || renderKey === 'ice') ? 'h2o' : renderKey));
    const phase = value.phase ?? (renderKey === 'steam' ? 'gas' : (renderKey === 'ice' ? 'solid' : null));
    const opticalState = value.opticalState || null;
    return {
      renderKey,
      material,
      phase,
      opticalState,
      opticalStateKey: stableOpticalStateKey(opticalState),
      surfaceKey: surfaceKeyForDescriptor({ renderKey, material, phase, opticalState })
    };
  }
  const renderKey = materialKeyOf(value);
  const material = (renderKey === 'steam' || renderKey === 'ice') ? 'h2o' : renderKey;
  const phase = renderKey === 'steam' ? 'gas' : (renderKey === 'ice' ? 'solid' : null);
  return {
    renderKey,
    material,
    phase,
    opticalState: null,
    opticalStateKey: 'default',
    surfaceKey: surfaceKeyForDescriptor({ renderKey, material, phase })
  };
}

function opticalPhaseForDescriptor(descriptor) {
  return descriptor.phase ?? (descriptor.renderKey === 'steam' ? 'gas' : (descriptor.renderKey === 'ice' ? 'solid' : 'liquid'));
}

function materialPropertiesForSurfaceDescriptor(descriptor, materialProperties) {
  if (!materialProperties) return null;
  const materialKey = descriptor.material;
  const renderKey = descriptor.renderKey;
  return materialProperties[materialKey]
    ?? materialProperties[materialKey?.toLowerCase?.()]
    ?? materialProperties[renderKey]
    ?? materialProperties[renderKey?.toLowerCase?.()]
    ?? null;
}

export function surfaceDescriptorsFromMaterials(materials = []) {
  const descriptors = [];
  const seen = new Set();
  for (const material of materials || []) {
    const descriptor = renderDescriptorOf(material);
    if (seen.has(descriptor.surfaceKey)) continue;
    seen.add(descriptor.surfaceKey);
    descriptors.push(descriptor);
  }
  return descriptors;
}

export function buildOpticalGpuTableForSurfaceDescriptors(descriptors = [], {
  materialProperties = null,
  materialPropertyBankGpuWarmInputTable = null
} = {}) {
  return buildOpticalGpuTable(descriptors.map((descriptor) => ({
    material: descriptor.material,
    phase: opticalPhaseForDescriptor(descriptor),
    renderKey: descriptor.renderKey,
    opticalState: descriptor.opticalState || null,
    properties: materialPropertiesForSurfaceDescriptor(descriptor, materialProperties)
  })), {
    materialProperties: materialProperties || {},
    materialPropertyBankGpuWarmInputTable
  });
}

function typedArrayBytesExactlyEqual(left, right) {
  if (!ArrayBuffer.isView(left) || !ArrayBuffer.isView(right)) return false;
  if (left.constructor !== right.constructor || left.byteLength !== right.byteLength) return false;
  const leftBytes = new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
  const rightBytes = new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
  for (let index = 0; index < leftBytes.length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false;
  }
  return true;
}

export function thermalMaterialTablesExactlyEqual(cachedTable, liveTable) {
  if (!cachedTable?.schema || !liveTable?.schema) return false;
  for (const field of [
    'schema',
    'materialCount',
    'segmentCount',
    'recordStrideFloats',
    'segmentStrideFloats'
  ]) {
    if (cachedTable[field] !== liveTable[field]) return false;
  }
  if (
    JSON.stringify(cachedTable.recordLayout) !== JSON.stringify(liveTable.recordLayout)
    || JSON.stringify(cachedTable.segmentLayout) !== JSON.stringify(liveTable.segmentLayout)
  ) {
    return false;
  }
  return (
    typedArrayBytesExactlyEqual(cachedTable.records, liveTable.records)
    && typedArrayBytesExactlyEqual(cachedTable.segments, liveTable.segments)
  );
}

export function buildSphThermalMaterialTableFromViewState(viewState = {}) {
  const materialProperties = viewState.materialProperties || {};
  return buildSphThermalMaterialTable(materialProperties, {
    materialPropertyBankGpuWarmInputTable:
      viewState.initialParticleSpacing?.materialPropertyBankGpuWarmInputTable ?? null
  });
}

export function sphStaticTableInputsFromViewState(viewState = {}, {
  thermalMaterialTable: providedThermalMaterialTable = null
} = {}) {
  const materialProperties = viewState.materialProperties || {};
  const thermalMaterialTable = providedThermalMaterialTable
    ?? buildSphThermalMaterialTableFromViewState(viewState);
  const thermalClosureGraphSet = buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const thermalPhaseResponseTable = buildSphThermalPhaseResponseTable(thermalMaterialTable, thermalClosureGraphSet);
  const opticalGpuTable = buildOpticalGpuTableForSurfaceDescriptors(
    surfaceDescriptorsFromMaterials(viewState.materials || []),
    {
      materialProperties,
      materialPropertyBankGpuWarmInputTable:
        viewState.initialParticleSpacing?.materialPropertyBankGpuWarmInputTable ?? null
    }
  );
  const reactionTable = buildSphReactionTable(viewState.reactions || [], {
    materialProperties,
    contactRadiusM: viewState.reactionContactRadiusM ?? viewState.sphGpuParticleState?.smoothingLengthM ?? 0
  });
  return {
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalPhaseResponseTable,
    opticalGpuTable,
    reactionTable
  };
}
