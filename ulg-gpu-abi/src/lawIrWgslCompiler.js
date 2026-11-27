// Declarative Law-IR -> WGSL Compiler (`ulg-gpu-abi/src/lawIrWgslCompiler.js`).
//
// Compiles ULG's restricted GPU-safe physics Law-IR AST (compatible 1-to-1 with
// Eshkol's symbolic AD `SymNode` ops in `vm_symbolic_ad.c`) paired with a typed
// Law Adapter Descriptor and canonical `*_ROW_LAYOUT` specs directly into:
//   - Exact `@group(0) @binding(k)` declarations matching the Law Descriptor,
//   - Generated `*_ROW_LAYOUT` vec4 lane accessors (`generateVec4LaneAccessorsWgsl`),
//   - Paired `RepresentedVolume` WGSL constructors (`generateRepresentedVolumeWgsl`),
//   - Exact symbolic forward-mode AD derivatives (`differentiateLawIrExpr`),
//   - Inline fail-closed validity envelope watch & 8-word atomic debt receipt,
//   - Deterministic FNV-1a64 fingerprint & bind-group layout manifest.
//
// Fails closed on any non-GPU-safe construct (closures, heap allocation,
// unbounded recursion, undeclared lane accesses, writing read-only resources,
// or unsafely assigning raw `volumeRatioJ`/`restVolumeM3` outside RepresentedVolume).

import {
  generateVec4LaneAccessorsWgsl,
  parseRowLayoutDescriptor,
  resolveLayoutFieldOffset
} from './laneAccessorGenerator.js';
import { generateRepresentedVolumeWgsl } from './representedVolume.js';

export const ULG_LAW_IR_SCHEMA = 'peercompute.ulg.law-ir.v1';
export const ULG_COMPILED_LAW_IR_WGSL_SCHEMA = 'peercompute.ulg.compiled-law-ir-wgsl.v1';

export const LAW_IR_FORBIDDEN_OPS = Object.freeze([
  'closure',
  'lambda',
  'alloc',
  'heapAlloc',
  'recurse',
  'callDynamic',
  'io',
  'eval'
]);

const FORBIDDEN_OP_SET = new Set(LAW_IR_FORBIDDEN_OPS);
const COMPUTE_STAGE = globalThis.GPUShaderStage?.COMPUTE ?? 4;

function fnv1a64Hex(text) {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + (i & 255)), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function formatF32Literal(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new RangeError(`Law-IR constant must be finite (got ${value})`);
  }
  if (Object.is(n, -0) || n === 0) return '0.0';
  const s = String(n);
  return (s.includes('.') || s.includes('e') || s.includes('E')) ? s : `${s}.0`;
}

function requireIdent(name, label) {
  const s = String(name ?? '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) {
    throw new TypeError(`${label} must be a valid WGSL identifier (got "${name}")`);
  }
  return s;
}

function toSnakeCase(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .toLowerCase();
}

// ============================================================================
// Symbolic Automatic Differentiation & Algebraic Simplification on Law-IR AST
// (Matches ../eshkol/lib/backend/vm_symbolic_ad.c 1-to-1!)
// ============================================================================

export function irConst(value) {
  return Object.freeze({ op: 'const', value: Number(value) });
}

export function irVar(name) {
  return Object.freeze({ op: 'var', name: String(name) });
}

export function irParam(name) {
  return Object.freeze({ op: 'param', name: String(name) });
}

export function irBin(op, left, right) {
  return Object.freeze({ op, left, right });
}

export function irUnary(op, arg) {
  return Object.freeze({ op, arg });
}

export function simplifyLawIrExpr(node) {
  if (!node || typeof node !== 'object') return node;
  if (FORBIDDEN_OP_SET.has(node.op)) {
    const err = new Error(`Law-IR rejected forbidden non-GPU op "${node.op}"`);
    err.code = 'ERR_LAW_IR_UNSAFE_GPU_OP';
    throw err;
  }
  if (node.op === 'const' || node.op === 'var' || node.op === 'param' || node.op === 'laneRead') {
    return node;
  }
  if (node.op === 'neg') {
    const a = simplifyLawIrExpr(node.arg);
    if (a.op === 'const') return irConst(-a.value);
    if (a.op === 'neg') return a.arg;
    return irUnary('neg', a);
  }
  if (['sqrt', 'exp', 'log', 'sin', 'cos', 'abs'].includes(node.op)) {
    const a = simplifyLawIrExpr(node.arg);
    if (a.op === 'const') {
      const fn = { sqrt: Math.sqrt, exp: Math.exp, log: Math.log, sin: Math.sin, cos: Math.cos, abs: Math.abs }[node.op];
      const v = fn(a.value);
      if (Number.isFinite(v)) return irConst(v);
    }
    if (node.op === 'exp' && a.op === 'log') return a.arg;
    if (node.op === 'log' && a.op === 'exp') return a.arg;
    return irUnary(node.op, a);
  }
  if (['add', 'sub', 'mul', 'div', 'pow', 'min', 'max'].includes(node.op)) {
    const l = simplifyLawIrExpr(node.left);
    const r = simplifyLawIrExpr(node.right);
    if (l.op === 'const' && r.op === 'const') {
      const v = node.op === 'add' ? l.value + r.value
        : node.op === 'sub' ? l.value - r.value
        : node.op === 'mul' ? l.value * r.value
        : node.op === 'div' ? (r.value !== 0 ? l.value / r.value : NaN)
        : node.op === 'pow' ? Math.pow(l.value, r.value)
        : node.op === 'min' ? Math.min(l.value, r.value)
        : Math.max(l.value, r.value);
      if (Number.isFinite(v)) return irConst(v);
    }
    if (node.op === 'add') {
      if (l.op === 'const' && l.value === 0) return r;
      if (r.op === 'const' && r.value === 0) return l;
    } else if (node.op === 'sub') {
      if (r.op === 'const' && r.value === 0) return l;
      if (l.op === 'const' && l.value === 0) return simplifyLawIrExpr(irUnary('neg', r));
      if (l.op === 'var' && r.op === 'var' && l.name === r.name) return irConst(0);
    } else if (node.op === 'mul') {
      if ((l.op === 'const' && l.value === 0) || (r.op === 'const' && r.value === 0)) return irConst(0);
      if (l.op === 'const' && l.value === 1) return r;
      if (r.op === 'const' && r.value === 1) return l;
    } else if (node.op === 'div') {
      if (l.op === 'const' && l.value === 0) return irConst(0);
      if (r.op === 'const' && r.value === 1) return l;
    } else if (node.op === 'pow') {
      if (r.op === 'const' && r.value === 0) return irConst(1);
      if (r.op === 'const' && r.value === 1) return l;
    }
    return irBin(node.op, l, r);
  }
  if (node.op === 'clamp') {
    return Object.freeze({
      op: 'clamp',
      arg: simplifyLawIrExpr(node.arg),
      lo: simplifyLawIrExpr(node.lo),
      hi: simplifyLawIrExpr(node.hi)
    });
  }
  if (node.op === 'select') {
    return Object.freeze({
      op: 'select',
      cond: simplifyLawIrExpr(node.cond),
      whenTrue: simplifyLawIrExpr(node.whenTrue),
      whenFalse: simplifyLawIrExpr(node.whenFalse)
    });
  }
  if (['gt', 'lt', 'ge', 'le', 'eq', 'and', 'or'].includes(node.op)) {
    return irBin(node.op, simplifyLawIrExpr(node.left), simplifyLawIrExpr(node.right));
  }
  return node;
}

/**
 * Exact symbolic automatic differentiation `d(expr)/d(varName)` over Law-IR AST.
 * Mirrors Eshkol's `sym_differentiate` rules cleanly.
 */
export function differentiateLawIrExpr(expr, varName) {
  if (!expr || typeof expr !== 'object') return irConst(0);
  if (FORBIDDEN_OP_SET.has(expr.op)) {
    const err = new Error(`Law-IR cannot differentiate forbidden op "${expr.op}"`);
    err.code = 'ERR_LAW_IR_UNSAFE_GPU_OP';
    throw err;
  }
  const target = String(varName);
  const diff = (n) => differentiateLawIrExpr(n, target);

  switch (expr.op) {
    case 'const':
    case 'param':
    case 'laneRead':
      return irConst(0);
    case 'var':
      return irConst(expr.name === target ? 1 : 0);
    case 'neg':
      return simplifyLawIrExpr(irUnary('neg', diff(expr.arg)));
    case 'add':
      return simplifyLawIrExpr(irBin('add', diff(expr.left), diff(expr.right)));
    case 'sub':
      return simplifyLawIrExpr(irBin('sub', diff(expr.left), diff(expr.right)));
    case 'mul':
      return simplifyLawIrExpr(irBin(
        'add',
        irBin('mul', diff(expr.left), expr.right),
        irBin('mul', expr.left, diff(expr.right))
      ));
    case 'div':
      return simplifyLawIrExpr(irBin(
        'div',
        irBin('sub', irBin('mul', diff(expr.left), expr.right), irBin('mul', expr.left, diff(expr.right))),
        irBin('mul', expr.right, expr.right)
      ));
    case 'pow': {
      const base = expr.left;
      const exp = expr.right;
      if (exp.op === 'const') {
        const n = exp.value;
        return simplifyLawIrExpr(irBin(
          'mul',
          irBin('mul', irConst(n), irBin('pow', base, irConst(n - 1))),
          diff(base)
        ));
      }
      // General f(x)^g(x) -> f^g * (g' * ln(f) + g * f' / f)
      return simplifyLawIrExpr(irBin(
        'mul',
        expr,
        irBin(
          'add',
          irBin('mul', diff(exp), irUnary('log', base)),
          irBin('div', irBin('mul', exp, diff(base)), base)
        )
      ));
    }
    case 'sqrt':
      return simplifyLawIrExpr(irBin('div', diff(expr.arg), irBin('mul', irConst(2), expr)));
    case 'exp':
      return simplifyLawIrExpr(irBin('mul', expr, diff(expr.arg)));
    case 'log':
      return simplifyLawIrExpr(irBin('div', diff(expr.arg), expr.arg));
    case 'sin':
      return simplifyLawIrExpr(irBin('mul', irUnary('cos', expr.arg), diff(expr.arg)));
    case 'cos':
      return simplifyLawIrExpr(irBin('mul', irUnary('neg', irUnary('sin', expr.arg)), diff(expr.arg)));
    case 'abs':
      return simplifyLawIrExpr(irBin(
        'mul',
        Object.freeze({ op: 'select', cond: irBin('ge', expr.arg, irConst(0)), whenTrue: irConst(1), whenFalse: irConst(-1) }),
        diff(expr.arg)
      ));
    case 'max':
      return simplifyLawIrExpr(Object.freeze({
        op: 'select',
        cond: irBin('ge', expr.left, expr.right),
        whenTrue: diff(expr.left),
        whenFalse: diff(expr.right)
      }));
    case 'min':
      return simplifyLawIrExpr(Object.freeze({
        op: 'select',
        cond: irBin('le', expr.left, expr.right),
        whenTrue: diff(expr.left),
        whenFalse: diff(expr.right)
      }));
    case 'clamp':
      return simplifyLawIrExpr(Object.freeze({
        op: 'select',
        cond: irBin('and', irBin('gt', expr.arg, expr.lo), irBin('lt', expr.arg, expr.hi)),
        whenTrue: diff(expr.arg),
        whenFalse: irConst(0)
      }));
    case 'select':
      return simplifyLawIrExpr(Object.freeze({
        op: 'select',
        cond: expr.cond,
        whenTrue: diff(expr.whenTrue),
        whenFalse: diff(expr.whenFalse)
      }));
    default:
      throw new TypeError(`Law-IR cannot differentiate unsupported op "${expr.op}"`);
  }
}

// ============================================================================
// Law-IR -> Validated WGSL Emitter
// ============================================================================

const RAW_VOLUME_LANE_NAMES = new Set(['volumeRatioJ', 'restVolumeM3']);

/**
 * Compile a declarative `peercompute.ulg.law-ir.v1` specification into a
 * self-contained, bind-group-verified WGSL compute module + layout manifest.
 */
export function compileLawIrToWgsl(lawIr, {
  rowLayouts = {},
  resourceLayouts = null,
  resourceBindingTable = null,
  workgroupSize = 64,
  includeEnvelopeWatch = true
} = {}) {
  if (!lawIr || typeof lawIr !== 'object') {
    throw new TypeError('compileLawIrToWgsl requires a Law-IR specification object');
  }
  if (lawIr.schema !== ULG_LAW_IR_SCHEMA) {
    throw new TypeError(`Expected Law-IR schema "${ULG_LAW_IR_SCHEMA}", got "${lawIr.schema}"`);
  }
  const lawId = String(lawIr.id || lawIr.descriptor?.id || '').trim();
  if (!lawId) throw new TypeError('Law-IR requires a non-empty id');
  const entryPoint = requireIdent(lawIr.entryPoint || `law_${toSnakeCase(lawId)}`, 'entryPoint');
  const wgSize = Math.max(1, Math.min(256, Math.trunc(Number(workgroupSize) || 64)));
  const descriptor = lawIr.descriptor;
  if (!descriptor || typeof descriptor !== 'object') {
    throw new TypeError(`Law-IR "${lawId}" requires an embedded Law Adapter descriptor`);
  }

  const reads = [...new Set((descriptor.reads || []).map(String))];
  const writes = [...new Set((descriptor.writes || []).map(String))];
  const accumulates = [...new Set((descriptor.accumulates || []).map(String))];
  const writeSet = new Set(writes);
  const accSet = new Set(accumulates);
  for (const acc of accumulates) {
    if (writeSet.has(acc)) {
      const err = new Error(`Law-IR "${lawId}": resource "${acc}" cannot be in both writes[] and accumulates[]`);
      err.code = 'ERR_LAW_IR_WRITE_ACCUMULATE_CONFLICT';
      throw err;
    }
  }
  const allResources = [...new Set([...reads, ...writes, ...accumulates])];
  const readableResources = new Set([...reads, ...writes, ...accumulates]);
  const writableResources = new Set([...writes, ...accumulates]);

  const bindingTable = resourceBindingTable || lawIr.resourceBindingTable || {};
  const paramsList = Array.isArray(lawIr.params) ? lawIr.params.map((p) => requireIdent(p.name || p, 'param')) : [];
  const paramSet = new Set(paramsList);
  const uniformBinding = Number.isSafeInteger(lawIr.uniformBinding) ? lawIr.uniformBinding : 0;
  const receiptBinding = includeEnvelopeWatch
    ? (Number.isSafeInteger(lawIr.receiptBinding) ? lawIr.receiptBinding : null)
    : null;

  // Map each declared resource to its WGSL buffer identifier, binding index, and parsed row layout
  const usedBindingIndices = new Set([uniformBinding]);
  const resourceSpecs = new Map();
  const bindGroupLayoutEntries = [
    Object.freeze({
      binding: uniformBinding,
      visibility: COMPUTE_STAGE,
      buffer: Object.freeze({ type: 'uniform' })
    })
  ];

  let autoCursor = uniformBinding + 1;
  const nextAutoBinding = () => {
    while (usedBindingIndices.has(autoCursor)) autoCursor += 1;
    const b = autoCursor;
    usedBindingIndices.add(b);
    return b;
  };

  for (const res of allResources) {
    const rawBind = bindingTable[res];
    const binding = Number.isSafeInteger(rawBind) && rawBind >= 0 ? rawBind : nextAutoBinding();
    if (usedBindingIndices.has(binding) && rawBind !== undefined) {
      const err = new Error(`Law-IR "${lawId}": binding index ${binding} collision on resource "${res}"`);
      err.code = 'ERR_LAW_IR_BINDING_COLLISION';
      throw err;
    }
    usedBindingIndices.add(binding);
    const bufferName = requireIdent(lawIr.resourceBuffers?.[res] || `buf_${toSnakeCase(res)}`, `resourceBuffers.${res}`);
    const layoutSource = rowLayouts?.[res] || resourceLayouts?.[res] || lawIr.rowLayouts?.[res] || null;
    const parsedLayout = layoutSource
      ? (layoutSource.schema ? layoutSource : parseRowLayoutDescriptor(layoutSource, { layoutName: res, requireVec4Aligned: true }))
      : null;
    const isWritable = writableResources.has(res);
    resourceSpecs.set(res, {
      resource: res,
      binding,
      bufferName,
      isWritable,
      isAccumulator: accSet.has(res),
      parsedLayout,
      readFields: new Set(),
      writeFields: new Set()
    });
    bindGroupLayoutEntries.push(Object.freeze({
      binding,
      visibility: COMPUTE_STAGE,
      buffer: Object.freeze({ type: isWritable ? 'storage' : 'read-only-storage' })
    }));
  }

  const resolvedReceiptBinding = includeEnvelopeWatch
    ? (receiptBinding != null ? receiptBinding : nextAutoBinding())
    : null;
  if (includeEnvelopeWatch && resolvedReceiptBinding != null) {
    if (receiptBinding != null && usedBindingIndices.has(resolvedReceiptBinding)) {
      const err = new Error(`Law-IR "${lawId}": receiptBinding ${resolvedReceiptBinding} collides with another binding`);
      err.code = 'ERR_LAW_IR_BINDING_COLLISION';
      throw err;
    }
    usedBindingIndices.add(resolvedReceiptBinding);
    bindGroupLayoutEntries.push(Object.freeze({
      binding: resolvedReceiptBinding,
      visibility: COMPUTE_STAGE,
      buffer: Object.freeze({ type: 'storage' })
    }));
  }

  bindGroupLayoutEntries.sort((a, b) => a.binding - b.binding);

  // Track active lexical variables + derived AD expressions
  const localVars = new Map();
  let usesRepresentedVolume = descriptor.pairedVolumeState && descriptor.pairedVolumeState !== 'not-applicable';
  const mechanicsResourceKey = lawIr.mechanicsResource || (resourceSpecs.has('mls-mpm-mechanics') ? 'mls-mpm-mechanics' : null);

  function assertSafeExpr(node) {
    if (!node || typeof node !== 'object') {
      throw new TypeError(`Law-IR "${lawId}": malformed expression node`);
    }
    if (FORBIDDEN_OP_SET.has(node.op)) {
      const err = new Error(`Law-IR "${lawId}": forbidden non-GPU op "${node.op}" rejected fail-closed`);
      err.code = 'ERR_LAW_IR_UNSAFE_GPU_OP';
      throw err;
    }
  }

  function emitExpr(node, idxExpr = 'gid_x') {
    assertSafeExpr(node);
    switch (node.op) {
      case 'const':
        return formatF32Literal(node.value);
      case 'var': {
        const name = requireIdent(node.name, 'var.name');
        if (!localVars.has(name)) {
          const err = new ReferenceError(`Law-IR "${lawId}": undeclared variable "${name}"`);
          err.code = 'ERR_LAW_IR_UNDECLARED_VAR';
          throw err;
        }
        return name;
      }
      case 'param': {
        const name = requireIdent(node.name, 'param.name');
        if (!paramSet.has(name)) {
          const err = new ReferenceError(`Law-IR "${lawId}": undeclared uniform param "${name}"`);
          err.code = 'ERR_LAW_IR_UNDECLARED_PARAM';
          throw err;
        }
        return `law_params.${name}`;
      }
      case 'laneRead': {
        const res = String(node.resource || '');
        const field = String(node.field || '');
        if (!readableResources.has(res) || !resourceSpecs.has(res)) {
          const err = new Error(`Law-IR "${lawId}": laneRead references undeclared resource "${res}"`);
          err.code = 'ERR_LAW_IR_UNDECLARED_RESOURCE';
          throw err;
        }
        const spec = resourceSpecs.get(res);
        if (!spec.parsedLayout) {
          throw new TypeError(`Law-IR "${lawId}": resource "${res}" has no row layout for laneRead("${field}")`);
        }
        const resolved = resolveLayoutFieldOffset(spec.parsedLayout, field, { layoutName: res });
        spec.readFields.add(resolved.name);
        const indexWgsl = node.indexExpr ? emitU32Expr(node.indexExpr) : idxExpr;
        return `${spec.bufferName}_${resolved.snakeName}(${indexWgsl})`;
      }
      case 'representedVolumeField': {
        const vName = requireIdent(node.varName, 'representedVolumeField.varName');
        if (!localVars.has(vName)) {
          throw new ReferenceError(`Law-IR "${lawId}": undeclared RepresentedVolume "${vName}"`);
        }
        const prop = String(node.prop || '');
        if (!['v0_m3', 'j', 'current_m3'].includes(prop)) {
          throw new RangeError(`Law-IR "${lawId}": invalid RepresentedVolume field "${prop}"`);
        }
        return `${vName}.${prop}`;
      }
      case 'neg':
        return `(-(${emitExpr(node.arg, idxExpr)}))`;
      case 'abs':
      case 'sqrt':
      case 'exp':
      case 'log':
      case 'sin':
      case 'cos':
        return `${node.op}(${emitExpr(node.arg, idxExpr)})`;
      case 'add':
        return `(${emitExpr(node.left, idxExpr)} + ${emitExpr(node.right, idxExpr)})`;
      case 'sub':
        return `(${emitExpr(node.left, idxExpr)} - ${emitExpr(node.right, idxExpr)})`;
      case 'mul':
        return `(${emitExpr(node.left, idxExpr)} * ${emitExpr(node.right, idxExpr)})`;
      case 'div':
        return `(${emitExpr(node.left, idxExpr)} / ${emitExpr(node.right, idxExpr)})`;
      case 'pow':
        return `pow(${emitExpr(node.left, idxExpr)}, ${emitExpr(node.right, idxExpr)})`;
      case 'min':
        return `min(${emitExpr(node.left, idxExpr)}, ${emitExpr(node.right, idxExpr)})`;
      case 'max':
        return `max(${emitExpr(node.left, idxExpr)}, ${emitExpr(node.right, idxExpr)})`;
      case 'clamp':
        return `clamp(${emitExpr(node.arg, idxExpr)}, ${emitExpr(node.lo, idxExpr)}, ${emitExpr(node.hi, idxExpr)})`;
      case 'select':
        return `select(${emitExpr(node.whenFalse, idxExpr)}, ${emitExpr(node.whenTrue, idxExpr)}, ${emitExpr(node.cond, idxExpr)})`;
      case 'gt': return `(${emitExpr(node.left, idxExpr)} > ${emitExpr(node.right, idxExpr)})`;
      case 'lt': return `(${emitExpr(node.left, idxExpr)} < ${emitExpr(node.right, idxExpr)})`;
      case 'ge': return `(${emitExpr(node.left, idxExpr)} >= ${emitExpr(node.right, idxExpr)})`;
      case 'le': return `(${emitExpr(node.left, idxExpr)} <= ${emitExpr(node.right, idxExpr)})`;
      case 'eq': return `(${emitExpr(node.left, idxExpr)} == ${emitExpr(node.right, idxExpr)})`;
      case 'and': return `(${emitExpr(node.left, idxExpr)} && ${emitExpr(node.right, idxExpr)})`;
      case 'or': return `(${emitExpr(node.left, idxExpr)} || ${emitExpr(node.right, idxExpr)})`;
      default:
        throw new TypeError(`Law-IR "${lawId}": unsupported expression op "${node.op}"`);
    }
  }

  function emitU32Expr(node) {
    if (typeof node === 'string') return requireIdent(node, 'indexExpr');
    if (typeof node === 'number') return `${Math.max(0, Math.trunc(node))}u`;
    throw new TypeError(`Law-IR "${lawId}": unsupported u32 index expression`);
  }

  const bodyLines = [];
  const derivedExpressions = {};
  const statements = Array.isArray(lawIr.body) ? lawIr.body : [];

  function emitStatements(stmts, indent = '  ') {
    for (const stmt of stmts) {
      assertSafeExpr(stmt);
      if (stmt.op === 'let') {
        const name = requireIdent(stmt.name, 'let.name');
        const simplified = simplifyLawIrExpr(stmt.expr);
        const wgslExpr = emitExpr(simplified);
        localVars.set(name, simplified);
        bodyLines.push(`${indent}let ${name}: f32 = ${wgslExpr};`);
      } else if (stmt.op === 'letDerivative') {
        // Compile-time exact symbolic AD over a previously defined Law-IR expression!
        const name = requireIdent(stmt.name, 'letDerivative.name');
        const ofVar = requireIdent(stmt.ofVar, 'letDerivative.ofVar');
        const wrtVar = requireIdent(stmt.wrtVar, 'letDerivative.wrtVar');
        const sourceAst = localVars.get(ofVar);
        if (!sourceAst) {
          throw new ReferenceError(`Law-IR "${lawId}": letDerivative references unknown expression "${ofVar}"`);
        }
        const derivAst = simplifyLawIrExpr(differentiateLawIrExpr(sourceAst, wrtVar));
        const wgslExpr = emitExpr(derivAst);
        localVars.set(name, derivAst);
        derivedExpressions[name] = wgslExpr;
        bodyLines.push(`${indent}// Symbolic AD: d(${ofVar})/d(${wrtVar})`);
        bodyLines.push(`${indent}let ${name}: f32 = ${wgslExpr};`);
      } else if (stmt.op === 'letRepresentedVolume') {
        usesRepresentedVolume = true;
        const name = requireIdent(stmt.name, 'letRepresentedVolume.name');
        const mode = String(stmt.mode || 'fromMechanics');
        if (mode === 'fromMechanics') {
          const idxWgsl = stmt.indexExpr ? emitU32Expr(stmt.indexExpr) : 'gid_x';
          localVars.set(name, { op: 'representedVolume' });
          bodyLines.push(`${indent}let ${name}: RepresentedVolume = represented_volume_from_mechanics(${idxWgsl});`);
        } else if (mode === 'atRest') {
          localVars.set(name, { op: 'representedVolume' });
          bodyLines.push(`${indent}let ${name}: RepresentedVolume = represented_volume_at_rest(${emitExpr(stmt.massExpr)}, ${emitExpr(stmt.restDensityExpr)});`);
        } else if (mode === 'retargetPhase') {
          const srcVar = requireIdent(stmt.sourceVar, 'retargetPhase.sourceVar');
          if (!localVars.has(srcVar)) {
            throw new ReferenceError(`Law-IR "${lawId}": retargetPhase references unknown RepresentedVolume "${srcVar}"`);
          }
          localVars.set(name, { op: 'representedVolume' });
          bodyLines.push(`${indent}let ${name}: RepresentedVolume = represented_volume_retarget_phase(${srcVar}, ${emitExpr(stmt.massExpr)}, ${emitExpr(stmt.targetRestDensityExpr)});`);
        } else {
          throw new RangeError(`Law-IR "${lawId}": unsupported letRepresentedVolume mode "${mode}"`);
        }
      } else if (stmt.op === 'envelopeCheck') {
        const valWgsl = emitExpr(stmt.expr);
        const loWgsl = formatF32Literal(stmt.min);
        const hiWgsl = formatF32Literal(stmt.max);
        const policy = String(stmt.policy || descriptor.fallbackPolicy || 'strict');
        bodyLines.push(`${indent}{`);
        bodyLines.push(`${indent}  let _env_v = ${valWgsl};`);
        bodyLines.push(`${indent}  let _env_fin = (_env_v == _env_v) && abs(_env_v) < 1.0e34;`);
        if (includeEnvelopeWatch) {
          bodyLines.push(`${indent}  if (!_env_fin) { atomicAdd(&law_receipt[4u], 1u); ${policy === 'strict' ? 'return;' : 'atomicAdd(&law_receipt[5u], 1u);'} }`);
          bodyLines.push(`${indent}  else if (_env_v < ${loWgsl}) { atomicAdd(&law_receipt[1u], 1u); ${policy === 'strict' ? 'return;' : 'atomicAdd(&law_receipt[5u], 1u);'} }`);
          bodyLines.push(`${indent}  else if (_env_v > ${hiWgsl}) { atomicAdd(&law_receipt[2u], 1u); ${policy === 'strict' ? 'return;' : 'atomicAdd(&law_receipt[5u], 1u);'} }`);
          bodyLines.push(`${indent}  else { atomicAdd(&law_receipt[0u], 1u); }`);
        } else if (policy === 'strict') {
          bodyLines.push(`${indent}  if (!_env_fin || _env_v < ${loWgsl} || _env_v > ${hiWgsl}) { return; }`);
        }
        bodyLines.push(`${indent}}`);
      } else if (stmt.op === 'laneWrite') {
        const res = String(stmt.resource || '');
        const field = String(stmt.field || '');
        if (!writableResources.has(res) || !resourceSpecs.has(res)) {
          const err = new Error(`Law-IR "${lawId}": laneWrite cannot write read-only or undeclared resource "${res}"`);
          err.code = 'ERR_LAW_IR_WRITE_VIOLATION';
          throw err;
        }
        // Structurally forbid independent raw writes to volumeRatioJ or restVolumeM3!
        if (RAW_VOLUME_LANE_NAMES.has(field)) {
          const err = new Error(
            `Law-IR "${lawId}": raw laneWrite to "${field}" is forbidden; use representedVolumeWrite so (V0, J) stay paired`
          );
          err.code = 'ERR_LAW_IR_UNPAIRED_VOLUME_WRITE';
          throw err;
        }
        const spec = resourceSpecs.get(res);
        if (!spec.parsedLayout) {
          throw new TypeError(`Law-IR "${lawId}": resource "${res}" has no row layout for laneWrite("${field}")`);
        }
        const resolved = resolveLayoutFieldOffset(spec.parsedLayout, field, { layoutName: res });
        spec.writeFields.add(resolved.name);
        const idxWgsl = stmt.indexExpr ? emitU32Expr(stmt.indexExpr) : 'gid_x';
        const valWgsl = emitExpr(simplifyLawIrExpr(stmt.expr));
        bodyLines.push(`${indent}set_${spec.bufferName}_${resolved.snakeName}(${idxWgsl}, ${valWgsl});`);
      } else if (stmt.op === 'representedVolumeWrite') {
        usesRepresentedVolume = true;
        const res = String(stmt.resource || mechanicsResourceKey || 'mls-mpm-mechanics');
        if (!writableResources.has(res) || !resourceSpecs.has(res)) {
          const err = new Error(`Law-IR "${lawId}": representedVolumeWrite requires writable mechanics resource "${res}"`);
          err.code = 'ERR_LAW_IR_WRITE_VIOLATION';
          throw err;
        }
        const spec = resourceSpecs.get(res);
        const jField = resolveLayoutFieldOffset(spec.parsedLayout, 'volumeRatioJ', { layoutName: res });
        const v0Field = resolveLayoutFieldOffset(spec.parsedLayout, 'restVolumeM3', { layoutName: res });
        spec.writeFields.add(jField.name);
        spec.writeFields.add(v0Field.name);
        const volVar = requireIdent(stmt.varName, 'representedVolumeWrite.varName');
        if (!localVars.has(volVar)) {
          throw new ReferenceError(`Law-IR "${lawId}": representedVolumeWrite references unknown "${volVar}"`);
        }
        const idxWgsl = stmt.indexExpr ? emitU32Expr(stmt.indexExpr) : 'gid_x';
        bodyLines.push(`${indent}if (${volVar}.valid == 1u) {`);
        bodyLines.push(`${indent}  set_${spec.bufferName}_${jField.snakeName}(${idxWgsl}, ${volVar}.j);`);
        bodyLines.push(`${indent}  set_${spec.bufferName}_${v0Field.snakeName}(${idxWgsl}, ${volVar}.v0_m3);`);
        bodyLines.push(`${indent}}`);
      } else if (stmt.op === 'boundedFor') {
        const iter = requireIdent(stmt.iterVar || '_k', 'boundedFor.iterVar');
        const maxIters = Math.trunc(Number(stmt.count));
        if (!Number.isSafeInteger(maxIters) || maxIters < 1 || maxIters > 256) {
          const err = new RangeError(`Law-IR "${lawId}": boundedFor count must be in [1, 256], got ${stmt.count}`);
          err.code = 'ERR_LAW_IR_UNBOUNDED_LOOP';
          throw err;
        }
        bodyLines.push(`${indent}for (var ${iter}: u32 = 0u; ${iter} < ${maxIters}u; ${iter} = ${iter} + 1u) {`);
        emitStatements(stmt.body || [], `${indent}  `);
        bodyLines.push(`${indent}}`);
      } else {
        throw new TypeError(`Law-IR "${lawId}": unsupported statement op "${stmt.op}"`);
      }
    }
  }

  emitStatements(statements);

  // Assemble uniform Params struct (16-byte aligned)
  const paramFields = [
    '  count: u32,',
    '  generation: u32,',
    '  flags: u32,',
    '  _hdr_pad: u32,'
  ];
  for (const p of paramsList) {
    paramFields.push(`  ${p}: f32,`);
  }
  const padCount = (4 - (paramsList.length % 4)) % 4;
  for (let p = 0; p < padCount; p += 1) {
    paramFields.push(`  _param_pad_${p}: f32,`);
  }

  // Assemble WGSL bindings & generated accessors
  const bindingLines = [
    `struct LawParams {\n${paramFields.join('\n')}\n};`,
    `@group(0) @binding(${uniformBinding}) var<uniform> law_params: LawParams;`
  ];
  const accessorBlocks = [];
  const usedLanes = {};

  for (const spec of [...resourceSpecs.values()].sort((a, b) => a.binding - b.binding)) {
    const access = spec.isWritable ? 'read_write' : 'read';
    bindingLines.push(
      `@group(0) @binding(${spec.binding}) var<storage, ${access}> ${spec.bufferName}: array<vec4<f32>>;`
    );
    const touched = [...new Set([...spec.readFields, ...spec.writeFields])];
    usedLanes[spec.resource] = Object.freeze({
      reads: Object.freeze([...spec.readFields]),
      writes: Object.freeze([...spec.writeFields])
    });
    if (spec.parsedLayout && touched.length > 0) {
      accessorBlocks.push(generateVec4LaneAccessorsWgsl({
        layout: spec.parsedLayout,
        layoutName: spec.resource,
        bufferName: spec.bufferName,
        prefix: spec.bufferName,
        fields: touched,
        includeWriters: spec.writeFields.size > 0
      }));
    }
  }

  if (includeEnvelopeWatch && resolvedReceiptBinding != null) {
    bindingLines.push(
      `@group(0) @binding(${resolvedReceiptBinding}) var<storage, read_write> law_receipt: array<atomic<u32>>;`
    );
  }

  if (usesRepresentedVolume) {
    const mechSpec = mechanicsResourceKey ? resourceSpecs.get(mechanicsResourceKey) : null;
    if (!mechSpec || !mechSpec.parsedLayout) {
      throw new TypeError(`Law-IR "${lawId}": RepresentedVolume requires a mechanics resource layout`);
    }
    accessorBlocks.push(generateRepresentedVolumeWgsl({
      mechanicsLayout: mechSpec.parsedLayout,
      bufferName: mechSpec.bufferName
    }));
  }

  const wgsl = [
    `// Compiled by ULG Declarative Law-IR -> WGSL Compiler (${ULG_LAW_IR_SCHEMA})`,
    `// Law ID: ${lawId} | AdapterMode: ${descriptor.adapterMode || 'cell-local'} | Authority: ${descriptor.spatialAuthority || 'canonical-ss-epoch'}`,
    bindingLines.join('\n'),
    accessorBlocks.join('\n\n'),
    `@compute @workgroup_size(${wgSize}, 1, 1)`,
    `fn ${entryPoint}(@builtin(global_invocation_id) gid: vec3<u32>) {`,
    `  let gid_x = gid.x;`,
    `  if (gid_x >= law_params.count) { return; }`,
    ...bodyLines,
    `}`
  ].filter(Boolean).join('\n\n');

  const fingerprint = `lawir-wgsl-fnv1a64:${fnv1a64Hex(wgsl)}`;
  return Object.freeze({
    schema: ULG_COMPILED_LAW_IR_WGSL_SCHEMA,
    lawId,
    entryPoint,
    workgroupSize: wgSize,
    fingerprint,
    wgsl,
    uniformBinding,
    receiptBinding: resolvedReceiptBinding,
    bindGroupLayoutEntries: Object.freeze(bindGroupLayoutEntries),
    usedLanes: Object.freeze(usedLanes),
    derivedExpressions: Object.freeze(derivedExpressions)
  });
}

// ============================================================================
// Canonical Built-In Physics Law-IR Definitions (Zero Hand-Offset WGSL!)
// ============================================================================

export function createTaitEosCavitationLawIr() {
  // Tait EOS with exact physical zero-gauge cavitation floor (P >= 0) AND
  // compile-time symbolic AD for bulk stiffness K(J) = -J * dP/dJ!
  return Object.freeze({
    schema: ULG_LAW_IR_SCHEMA,
    id: 'tait-eos-cavitation-ad',
    entryPoint: 'eval_tait_eos_cavitation',
    params: Object.freeze(['stiffnessPa', 'gamma']),
    uniformBinding: 0,
    resourceBindingTable: Object.freeze({
      'mls-mpm-mechanics': 1
    }),
    receiptBinding: 2,
    descriptor: Object.freeze({
      id: 'tait-eos-cavitation-ad',
      adapterMode: 'cell-local',
      spatialAuthority: 'canonical-ss-epoch',
      reads: Object.freeze(['mls-mpm-mechanics']),
      writes: Object.freeze(['mls-mpm-mechanics']),
      accumulates: Object.freeze([]),
      pairedVolumeState: Object.freeze({ v0Lane: 'mls-mpm-mechanics.restVolumeM3', jLane: 'mls-mpm-mechanics.volumeRatioJ' }),
      conservedQuantities: Object.freeze(['linear-momentum']),
      validityDomain: Object.freeze({ jMin: 0.25, jMax: 4.0, cavitationFloorGaugePa: 0.0 }),
      fallbackPolicy: 'strict'
    }),
    body: Object.freeze([
      { op: 'letRepresentedVolume', name: 'vol', mode: 'fromMechanics' },
      { op: 'let', name: 'j_val', expr: { op: 'representedVolumeField', varName: 'vol', prop: 'j' } },
      { op: 'envelopeCheck', expr: irVar('j_val'), min: 0.25, max: 4.0, policy: 'strict' },
      {
        op: 'let',
        name: 'p_raw',
        expr: irBin(
          'mul',
          irParam('stiffnessPa'),
          irBin('sub', irBin('pow', irBin('div', irConst(1), irVar('j_val')), irParam('gamma')), irConst(1))
        )
      },
      { op: 'letDerivative', name: 'dp_dj', ofVar: 'p_raw', wrtVar: 'j_val' },
      // Physical zero-gauge cavitation floor: zero tensile glue when J > 1.0
      { op: 'let', name: 'p_gauge', expr: irBin('max', irConst(0), irVar('p_raw')) },
      { op: 'let', name: 'k_eff', expr: Object.freeze({
        op: 'select',
        cond: irBin('le', irVar('j_val'), irConst(1.0)),
        whenTrue: irBin('mul', irUnary('neg', irVar('j_val')), irVar('dp_dj')),
        whenFalse: irConst(0)
      }) },
      { op: 'laneWrite', resource: 'mls-mpm-mechanics', field: 'resolvedAbsolutePressurePa', expr: irVar('p_gauge') },
      { op: 'laneWrite', resource: 'mls-mpm-mechanics', field: 'effectiveBulkModulusPa', expr: irVar('k_eff') }
    ])
  });
}

export function createRepresentedVolumePhaseRetargetLawIr() {
  return Object.freeze({
    schema: ULG_LAW_IR_SCHEMA,
    id: 'represented-volume-phase-retarget',
    entryPoint: 'retarget_represented_volume',
    params: Object.freeze(['targetRestDensityKgPerM3']),
    uniformBinding: 0,
    resourceBindingTable: Object.freeze({
      'sph-particle-state': 1,
      'mls-mpm-mechanics': 2
    }),
    receiptBinding: 3,
    descriptor: Object.freeze({
      id: 'represented-volume-phase-retarget',
      adapterMode: 'cell-local',
      spatialAuthority: 'canonical-ss-epoch',
      reads: Object.freeze(['sph-particle-state', 'mls-mpm-mechanics']),
      writes: Object.freeze(['mls-mpm-mechanics']),
      accumulates: Object.freeze([]),
      pairedVolumeState: Object.freeze({ v0Lane: 'mls-mpm-mechanics.restVolumeM3', jLane: 'mls-mpm-mechanics.volumeRatioJ' }),
      conservedQuantities: Object.freeze(['mass', 'represented-volume']),
      validityDomain: Object.freeze({ targetRestDensityMin: 1e-4, targetRestDensityMax: 1e6 }),
      fallbackPolicy: 'strict'
    }),
    body: Object.freeze([
      { op: 'letRepresentedVolume', name: 'src_vol', mode: 'fromMechanics' },
      { op: 'let', name: 'mass_kg', expr: { op: 'laneRead', resource: 'sph-particle-state', field: 'massKg' } },
      { op: 'envelopeCheck', expr: irParam('targetRestDensityKgPerM3'), min: 1e-4, max: 1e6, policy: 'strict' },
      {
        op: 'letRepresentedVolume',
        name: 'dst_vol',
        mode: 'retargetPhase',
        sourceVar: 'src_vol',
        massExpr: irVar('mass_kg'),
        targetRestDensityExpr: irParam('targetRestDensityKgPerM3')
      },
      { op: 'representedVolumeWrite', resource: 'mls-mpm-mechanics', varName: 'dst_vol' }
    ])
  });
}

/**
 * Multi-material / multi-phase continuum-safe declarative Law-IR kernel for live
 * hot-loop execution: reads per-particle `eosModelId`, `solidFlag`, `effectiveBulkModulusPa`,
 * and paired `(V0, J)` directly from `mls-mpm-mechanics`, evaluates Tait EOS + compile-time
 * symbolic AD + zero-gauge cavitation floor strictly on live liquid rows while preserving
 * solids, gases, and dormant spare lineages bit-identically.
 */
export function createPerParticleTaitEosCavitationLawIr() {
  return Object.freeze({
    schema: ULG_LAW_IR_SCHEMA,
    id: 'per-particle-tait-eos-cavitation-ad',
    entryPoint: 'eval_per_particle_tait_eos_cavitation',
    params: Object.freeze(['gamma']),
    uniformBinding: 0,
    resourceBindingTable: Object.freeze({
      'mls-mpm-mechanics': 1
    }),
    receiptBinding: 2,
    descriptor: Object.freeze({
      id: 'per-particle-tait-eos-cavitation-ad',
      adapterMode: 'cell-local',
      spatialAuthority: 'canonical-ss-epoch',
      reads: Object.freeze(['mls-mpm-mechanics']),
      writes: Object.freeze(['mls-mpm-mechanics']),
      accumulates: Object.freeze([]),
      pairedVolumeState: Object.freeze({ v0Lane: 'mls-mpm-mechanics.restVolumeM3', jLane: 'mls-mpm-mechanics.volumeRatioJ' }),
      conservedQuantities: Object.freeze(['linear-momentum']),
      validityDomain: Object.freeze({ jMin: 0.25, jMax: 4.0, cavitationFloorGaugePa: 0.0 }),
      fallbackPolicy: 'strict'
    }),
    body: Object.freeze([
      { op: 'letRepresentedVolume', name: 'vol', mode: 'fromMechanics' },
      { op: 'let', name: 'j_raw', expr: { op: 'representedVolumeField', varName: 'vol', prop: 'j' } },
      { op: 'let', name: 'eos_model', expr: { op: 'laneRead', resource: 'mls-mpm-mechanics', field: 'eosModelId' } },
      { op: 'let', name: 'solid_flag', expr: { op: 'laneRead', resource: 'mls-mpm-mechanics', field: 'solidFlag' } },
      { op: 'let', name: 'k0', expr: { op: 'laneRead', resource: 'mls-mpm-mechanics', field: 'effectiveBulkModulusPa' } },
      { op: 'let', name: 'p_old', expr: { op: 'laneRead', resource: 'mls-mpm-mechanics', field: 'resolvedAbsolutePressurePa' } },
      {
        op: 'let',
        name: 'is_tait_liquid',
        expr: Object.freeze({
          op: 'select',
          cond: irBin(
            'and',
            irBin('and', irBin('gt', irVar('eos_model'), irConst(0.5)), irBin('lt', irVar('eos_model'), irConst(1.5))),
            irBin('and', irBin('lt', irVar('solid_flag'), irConst(0.5)), irBin('gt', irVar('k0'), irConst(0)))
          ),
          whenTrue: irConst(1),
          whenFalse: irConst(0)
        })
      },
      {
        op: 'let',
        name: 'j_checked',
        expr: Object.freeze({
          op: 'select',
          cond: irBin('gt', irVar('is_tait_liquid'), irConst(0.5)),
          whenTrue: irVar('j_raw'),
          whenFalse: irConst(1)
        })
      },
      { op: 'envelopeCheck', expr: irVar('j_checked'), min: 0.25, max: 4.0, policy: 'strict' },
      {
        op: 'let',
        name: 'p_raw',
        expr: irBin(
          'mul',
          irBin('div', irVar('k0'), irParam('gamma')),
          irBin('sub', irBin('pow', irBin('div', irConst(1), irVar('j_checked')), irParam('gamma')), irConst(1))
        )
      },
      { op: 'letDerivative', name: 'dp_dj', ofVar: 'p_raw', wrtVar: 'j_checked' },
      { op: 'let', name: 'p_gauge', expr: irBin('max', irConst(0), irVar('p_raw')) },
      {
        op: 'let',
        name: 'p_out',
        expr: Object.freeze({
          op: 'select',
          cond: irBin('gt', irVar('is_tait_liquid'), irConst(0.5)),
          whenTrue: irVar('p_gauge'),
          whenFalse: irVar('p_old')
        })
      },
      { op: 'laneWrite', resource: 'mls-mpm-mechanics', field: 'resolvedAbsolutePressurePa', expr: irVar('p_out') }
    ])
  });
}
