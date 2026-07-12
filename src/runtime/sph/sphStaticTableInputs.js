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

function materialPropertiesLookup(material, materialProperties = null) {
  if (!materialProperties || !material) return null;
  return materialProperties[material]
    ?? materialProperties[String(material).toLowerCase()]
    ?? materialProperties[String(material).toUpperCase()]
    ?? null;
}

function renderKeyForMaterialPhase(material, phase) {
  if (material === 'h2o' && phase === 'solid') return 'ice';
  if (material === 'h2o' && phase === 'gas') return 'steam';
  return material || 'unknown';
}

function reactionTableMaterialKeys(reactionTable = null) {
  const keys = new Set();
  for (const family of ['reactantTermMetadata', 'productTermMetadata']) {
    for (const term of reactionTable?.[family] || []) {
      if (term?.material) keys.add(term.material);
    }
  }
  return keys;
}

// The native resident renderer preallocates surfaces for every phase that can
// become active without returning to the host. Build the static optical table
// over that same domain so a phase transition cannot trigger a full optical
// closure rebuild on the presentation thread.
export function residentSurfaceDescriptorsFromViewState(viewState = {}, {
  reactionTable = null
} = {}) {
  const descriptors = surfaceDescriptorsFromMaterials(viewState.materials || []);
  const descriptorsByKey = new Map(descriptors.map((descriptor) => [descriptor.surfaceKey, descriptor]));
  const materialKeys = new Set(descriptors.map((descriptor) => descriptor.material));
  for (const material of reactionTableMaterialKeys(reactionTable)) materialKeys.add(material);

  for (const material of materialKeys) {
    const properties = materialPropertiesLookup(material, viewState.materialProperties || {});
    for (const phaseRecord of properties?.phases || []) {
      const phase = phaseRecord?.name;
      if (!phase) continue;
      const descriptor = renderDescriptorOf({
        material,
        phase,
        renderKey: renderKeyForMaterialPhase(material, phase)
      });
      if (!descriptorsByKey.has(descriptor.surfaceKey)) {
        descriptorsByKey.set(descriptor.surfaceKey, descriptor);
      }
    }
  }
  return [...descriptorsByKey.values()];
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

export function sphStaticTableInputsFromViewState(viewState = {}) {
  const materialProperties = viewState.materialProperties || {};
  const thermalMaterialTable = buildSphThermalMaterialTable(materialProperties, {
    materialPropertyBankGpuWarmInputTable:
      viewState.initialParticleSpacing?.materialPropertyBankGpuWarmInputTable ?? null
  });
  const thermalClosureGraphSet = buildSphThermalClosureGraphBuffers(thermalMaterialTable);
  const thermalPhaseResponseTable = buildSphThermalPhaseResponseTable(thermalMaterialTable, thermalClosureGraphSet);
  const reactionTable = buildSphReactionTable(viewState.reactions || [], {
    materialProperties,
    contactRadiusM: viewState.reactionContactRadiusM ?? viewState.sphGpuParticleState?.smoothingLengthM ?? 0
  });
  const opticalGpuTable = buildOpticalGpuTableForSurfaceDescriptors(
    residentSurfaceDescriptorsFromViewState(viewState, { reactionTable }),
    {
      materialProperties,
      materialPropertyBankGpuWarmInputTable:
      viewState.initialParticleSpacing?.materialPropertyBankGpuWarmInputTable ?? null
    }
  );
  return {
    thermalMaterialTable,
    thermalClosureGraphSet,
    thermalPhaseResponseTable,
    opticalGpuTable,
    reactionTable
  };
}
