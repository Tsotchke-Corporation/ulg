export const ULG_WGSL_COMPOSED_MODULE_SCHEMA =
  'peercompute.ulg.wgsl-composed-module.v1';

function fnv1a32Hex(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function normalizeSlotName(slot, context) {
  const name = String(slot ?? '').trim();
  if (!name || !/^[a-zA-Z0-9._:-]+$/.test(name)) {
    throw new TypeError(`${context}: invalid WGSL fragment slot name "${slot}"`);
  }
  return name;
}

/**
 * Compose a WGSL module from an ordered list of named fragments with optional
 * named slot overrides and appended fragments. Every override target must exist
 * in the base fragments (making silent no-op edits impossible).
 */
export function composeWgslModule({
  moduleId,
  variantId = 'base',
  fragments = [],
  overrides = {},
  append = [],
  includeProvenanceHeader = true
} = {}) {
  const id = normalizeSlotName(moduleId, 'composeWgslModule.moduleId');
  const variant = normalizeSlotName(variantId, 'composeWgslModule.variantId');
  if (!Array.isArray(fragments) || fragments.length === 0) {
    throw new TypeError(`${id}: composeWgslModule requires a non-empty fragments array`);
  }
  const seenSlots = new Set();
  const resolved = [];
  for (let i = 0; i < fragments.length; i += 1) {
    const frag = fragments[i];
    const slot = normalizeSlotName(frag?.slot, `${id}.fragments[${i}]`);
    if (seenSlots.has(slot)) {
      throw new Error(`${id}: duplicate WGSL fragment slot "${slot}"`);
    }
    seenSlots.add(slot);
    if (typeof frag.code !== 'string') {
      throw new TypeError(`${id}: fragment "${slot}" code must be a string`);
    }
    resolved.push({ slot, code: frag.code, overridden: false });
  }

  const overrideKeys = Object.keys(overrides || {});
  const overriddenSlots = [];
  for (const key of overrideKeys) {
    const slot = normalizeSlotName(key, `${id}.overrides`);
    if (!seenSlots.has(slot)) {
      throw new Error(`${id}:${variant}: override targets unknown fragment slot "${slot}"`);
    }
    const replacement = overrides[key];
    if (typeof replacement !== 'string') {
      throw new TypeError(`${id}:${variant}: override for slot "${slot}" must be a string`);
    }
    const entry = resolved.find((item) => item.slot === slot);
    entry.code = replacement;
    entry.overridden = true;
    overriddenSlots.push(slot);
  }

  for (let i = 0; i < (append?.length ?? 0); i += 1) {
    const frag = append[i];
    const slot = normalizeSlotName(frag?.slot, `${id}.append[${i}]`);
    if (seenSlots.has(slot)) {
      throw new Error(`${id}:${variant}: appended WGSL fragment slot "${slot}" collides with existing slot`);
    }
    seenSlots.add(slot);
    if (typeof frag.code !== 'string') {
      throw new TypeError(`${id}:${variant}: appended fragment "${slot}" code must be a string`);
    }
    resolved.push({ slot, code: frag.code, overridden: false });
  }

  const activeFragments = Object.freeze(resolved.map((item) => item.slot));
  const body = resolved.map((item) => item.code).filter((c) => c.length > 0).join('\n\n');
  if (!body.trim()) {
    throw new Error(`${id}:${variant}: composed WGSL module is empty`);
  }
  const header = includeProvenanceHeader
    ? `// [ulg-wgsl-module:${id}:${variant} slots=${activeFragments.join(',')}]\n`
    : '';
  const code = `${header}${body}`;
  return Object.freeze({
    schema: ULG_WGSL_COMPOSED_MODULE_SCHEMA,
    moduleId: id,
    variantId: variant,
    activeFragments,
    overriddenSlots: Object.freeze(overriddenSlots),
    fingerprint: fnv1a32Hex(code),
    code
  });
}

/**
 * Declarative, fail-closed variant builder for migrating existing monolithic
 * WGSL templates onto named slots. Every slot anchor must match EXACTLY ONCE
 * (0 matches OR >1 ambiguous matches throw synchronously) and produces a frozen
 * provenance manifest naming every active slot override.
 */
export function composeWgslVariantFromSource({
  moduleId,
  variantId,
  baseSource,
  slots = [],
  append = [],
  includeProvenanceHeader = false
} = {}) {
  const id = normalizeSlotName(moduleId, 'composeWgslVariantFromSource.moduleId');
  const variant = normalizeSlotName(variantId, 'composeWgslVariantFromSource.variantId');
  if (typeof baseSource !== 'string' || !baseSource.trim()) {
    throw new TypeError(`${id}:${variant}: baseSource must be a non-empty WGSL string`);
  }
  let current = baseSource;
  const appliedSlots = [];
  const seenSlots = new Set();

  for (let i = 0; i < slots.length; i += 1) {
    const spec = slots[i];
    const slot = normalizeSlotName(spec?.slot, `${id}:${variant}.slots[${i}]`);
    if (seenSlots.has(slot)) {
      throw new Error(`${id}:${variant}: duplicate variant slot "${slot}"`);
    }
    seenSlots.add(slot);
    const kind = spec.kind || 'exact';
    if (typeof spec.code !== 'string') {
      throw new TypeError(`${id}:${variant}: slot "${slot}" code must be a string`);
    }
    if (kind === 'exact') {
      if (typeof spec.match !== 'string' || spec.match.length === 0) {
        throw new TypeError(`${id}:${variant}: exact slot "${slot}" requires non-empty match`);
      }
      const first = current.indexOf(spec.match);
      if (first < 0) {
        if (spec.optional === true) continue;
        throw new Error(`${id}:${variant}: missing WGSL slot anchor "${slot}"`);
      }
      const second = current.indexOf(spec.match, first + spec.match.length);
      if (second >= 0) {
        throw new Error(`${id}:${variant}: ambiguous WGSL slot anchor "${slot}" matched multiple locations`);
      }
      current = `${current.slice(0, first)}${spec.code}${current.slice(first + spec.match.length)}`;
    } else if (kind === 'range') {
      if (typeof spec.start !== 'string' || typeof spec.end !== 'string' || !spec.start || !spec.end) {
        throw new TypeError(`${id}:${variant}: range slot "${slot}" requires non-empty start and end`);
      }
      const startIndex = current.indexOf(spec.start);
      if (startIndex < 0) {
        if (spec.optional === true) continue;
        throw new Error(`${id}:${variant}: missing WGSL range start for slot "${slot}"`);
      }
      const duplicateStart = current.indexOf(spec.start, startIndex + spec.start.length);
      if (duplicateStart >= 0) {
        throw new Error(`${id}:${variant}: ambiguous WGSL range start for slot "${slot}"`);
      }
      const endIndex = current.indexOf(spec.end, startIndex + spec.start.length);
      if (endIndex < 0) {
        throw new Error(`${id}:${variant}: missing WGSL range end for slot "${slot}"`);
      }
      current = `${current.slice(0, startIndex)}${spec.code}${current.slice(endIndex)}`;
    } else {
      throw new TypeError(`${id}:${variant}: unsupported slot kind "${kind}"`);
    }
    appliedSlots.push(slot);
  }

  for (let i = 0; i < append.length; i += 1) {
    const extra = append[i];
    const slot = normalizeSlotName(extra?.slot, `${id}:${variant}.append[${i}]`);
    if (seenSlots.has(slot)) {
      throw new Error(`${id}:${variant}: duplicate appended slot "${slot}"`);
    }
    seenSlots.add(slot);
    if (typeof extra.code !== 'string') {
      throw new TypeError(`${id}:${variant}: appended slot "${slot}" code must be a string`);
    }
    current = `${current}\n\n${extra.code}`;
    appliedSlots.push(slot);
  }

  const code = includeProvenanceHeader
    ? `// [ulg-wgsl-variant:${id}:${variant} slots=${appliedSlots.join(',')}]\n${current}`
    : current;

  return Object.freeze({
    schema: ULG_WGSL_COMPOSED_MODULE_SCHEMA,
    moduleId: id,
    variantId: variant,
    activeFragments: Object.freeze(appliedSlots),
    overriddenSlots: Object.freeze(appliedSlots),
    fingerprint: fnv1a32Hex(code),
    code
  });
}
