export const ULG_LANE_ACCESSOR_DESCRIPTOR_SCHEMA =
  'peercompute.ulg.lane-accessor-descriptor.v1';

const VEC4_COMPONENTS = Object.freeze(['x', 'y', 'z', 'w']);

function toSnakeCase(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .toLowerCase();
}

function wgslTypeForRawType(rawType) {
  switch (rawType) {
    case 'f32':
    case 'f32-bits':
      return 'f32';
    case 'u32':
      return 'u32';
    case 'i32':
    case 'i32-bits':
      return 'i32';
    default:
      throw new TypeError(`Unsupported ABI lane type "${rawType}"`);
  }
}

/**
 * Parse any canonical `*_ROW_LAYOUT` array (e.g. `MLS_MPM_GPU_PARTICLE_MECHANICS_ROW_LAYOUT`)
 * into deterministic, frozen scalar & vec4 lane descriptors.
 */
export function parseRowLayoutDescriptor(layout, {
  layoutName = 'anonymous-layout',
  requireVec4Aligned = false
} = {}) {
  if (!Array.isArray(layout) || layout.length === 0) {
    throw new TypeError(`${layoutName}: row layout must be a non-empty array`);
  }
  if (requireVec4Aligned && layout.length % 4 !== 0) {
    throw new RangeError(
      `${layoutName}: vec4-aligned layout length ${layout.length} is not a multiple of 4`
    );
  }
  const fields = [];
  const byName = Object.create(null);
  for (let scalarIndex = 0; scalarIndex < layout.length; scalarIndex += 1) {
    const entry = String(layout[scalarIndex] ?? '').trim();
    const colon = entry.indexOf(':');
    if (colon <= 0 || colon === entry.length - 1) {
      throw new TypeError(`${layoutName}[${scalarIndex}]: malformed lane entry "${entry}"`);
    }
    const name = entry.slice(0, colon).trim();
    const rawType = entry.slice(colon + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new TypeError(`${layoutName}[${scalarIndex}]: invalid field name "${name}"`);
    }
    if (Object.hasOwn(byName, name)) {
      throw new TypeError(`${layoutName}: duplicate lane field "${name}"`);
    }
    const wgslType = wgslTypeForRawType(rawType);
    const vec4Index = Math.floor(scalarIndex / 4);
    const componentIndex = scalarIndex % 4;
    const field = Object.freeze({
      name,
      snakeName: toSnakeCase(name),
      rawType,
      wgslType,
      scalarIndex,
      vec4Index,
      componentIndex,
      component: VEC4_COMPONENTS[componentIndex]
    });
    fields.push(field);
    byName[name] = field;
  }
  return Object.freeze({
    schema: ULG_LANE_ACCESSOR_DESCRIPTOR_SCHEMA,
    layoutName,
    scalarCount: layout.length,
    vec4Stride: Math.ceil(layout.length / 4),
    fields: Object.freeze(fields),
    byName: Object.freeze(byName)
  });
}

/**
 * Look up a field's exact scalar and vec4 offset from a canonical `*_ROW_LAYOUT`.
 * Throws synchronously if the field does not exist (making offset drift fail-closed).
 */
export function resolveLayoutFieldOffset(layout, fieldName, {
  layoutName = 'anonymous-layout'
} = {}) {
  const parsed = layout?.schema === ULG_LANE_ACCESSOR_DESCRIPTOR_SCHEMA
    ? layout
    : parseRowLayoutDescriptor(layout, { layoutName });
  const field = parsed.byName[fieldName];
  if (!field) {
    throw new RangeError(
      `${parsed.layoutName}: lane field "${fieldName}" does not exist in ABI row layout`
    );
  }
  return field;
}

/**
 * Generate deterministic WGSL vec4-buffer reader (and optional writer) accessor
 * functions directly from a canonical `*_ROW_LAYOUT` descriptor.
 */
export function generateVec4LaneAccessorsWgsl({
  layout,
  layoutName = 'anonymous-layout',
  bufferName,
  prefix = bufferName,
  indexParam = 'particle_index',
  fields = null,
  includeWriters = false
} = {}) {
  if (!bufferName || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(bufferName)) {
    throw new TypeError('generateVec4LaneAccessorsWgsl requires a valid WGSL bufferName');
  }
  if (!prefix || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(prefix)) {
    throw new TypeError('generateVec4LaneAccessorsWgsl requires a valid WGSL function prefix');
  }
  const parsed = layout?.schema === ULG_LANE_ACCESSOR_DESCRIPTOR_SCHEMA
    ? layout
    : parseRowLayoutDescriptor(layout, { layoutName, requireVec4Aligned: true });
  if (parsed.scalarCount % 4 !== 0) {
    throw new RangeError(
      `${parsed.layoutName}: vec4 accessor generation requires scalarCount divisible by 4`
    );
  }
  const selectedFields = fields == null
    ? parsed.fields
    : fields.map((name) => resolveLayoutFieldOffset(parsed, name, { layoutName: parsed.layoutName }));

  const lines = [
    `// Generated from ${parsed.layoutName} (stride = ${parsed.vec4Stride} vec4<f32> rows). Do not hand-offset.`
  ];
  const stride = parsed.vec4Stride;
  for (const field of selectedFields) {
    if (field.wgslType !== 'f32') {
      throw new TypeError(
        `${parsed.layoutName}.${field.name}: vec4<f32> accessor requires f32 lane, got ${field.wgslType}`
      );
    }
    const rowExpr = field.vec4Index === 0
      ? `${indexParam} * ${stride}u`
      : `${indexParam} * ${stride}u + ${field.vec4Index}u`;
    lines.push(
      `fn ${prefix}_${field.snakeName}(${indexParam}: u32) -> f32 {`,
      `  return ${bufferName}[${rowExpr}].${field.component};`,
      `}`
    );
    if (includeWriters) {
      lines.push(
        `fn set_${prefix}_${field.snakeName}(${indexParam}: u32, value: f32) {`,
        `  ${bufferName}[${rowExpr}].${field.component} = value;`,
        `}`
      );
    }
  }
  return lines.join('\n');
}
