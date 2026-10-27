import { mlsMpmP2gGridProjectionWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { originalWgslDeclaration } from './originalPhysicalHelpers.js';

// A view contains the 32-word event followed by its 52-word physical state.
// Use the original particle solver for constitutive stress and APIC. Only
// source addressing, the authenticated live-row guard, and the two retained
// extensive projections (momentum and current volume) differ.
export function specializeExactHistoryP2gWgsl(code, layout) {
  const replace = (source, from, to) => {
    if (source.split(from).length !== 2) throw new Error(`Exact history P2G source contract changed: ${from}`);
    return source.replace(from, to);
  };
  code = replace(code, 'params.expected_product_history_row_stride_vec4 == 8u',
    `params.expected_product_history_row_stride_vec4 == ${layout.rowWords / 4}u`);
  code = replace(code, '/ params.expected_product_history_row_stride_vec4', '/ 21u');
  code = replace(code, '|| !p2g_product_history_control_admitted())',
    '|| !p2g_product_history_control_admitted() || exact_history_p2g_validation[0u] != 0u || exact_history_p2g_validation[1u] != 0x48503247u)');

  const original = originalWgslDeclaration(mlsMpmP2gGridProjectionWgsl, 'fn', 'main');
  const start = original.indexOf('  let state_base = particle_index * 2u;');
  if (start < 0) throw new Error('Original particle P2G input contract changed');
  let body = original.slice(start);
  body = replace(body, 'let state_base = particle_index * 2u;', 'let state_base = event_index * 21u + 8u;');
  body = replace(body, 'let thermo_base = particle_index * 3u;', 'let thermo_base = event_index * 21u + 10u;');
  body = replace(body, 'let mechanics_base = particle_index * 8u;', 'let mechanics_base = event_index * 21u + 13u;');
  for (const name of ['sph_state', 'sph_thermo', 'mls_mechanics']) body = body.replaceAll(`${name}[`, 'product_events[');
  body = replace(body, `let volume = select(
    0.0,
    row4.w * row4.z,
    row4.w > 0.0 && row4.z > 0.0
  );`, 'let volume = product_events[event_index * 21u + 5u].w;');
  body = replace(body, 'pos_mass.w * vel_u.xyz + affine_momentum',
    'product_events[event_index * 21u + 5u].xyz + affine_momentum');
  const previous = originalWgslDeclaration(code, 'fn', 'scatter_product_events');
  const prefixEnd = previous.indexOf('  let event0 = product_event_row0(event_index);');
  if (prefixEnd < 0) throw new Error('Original product P2G admission contract changed');
  code = replace(code, previous, previous.slice(0, prefixEnd) + body);
  // Keep the original event accessors consistent even though the full solver
  // reads the packed view directly. Their record stride is no longer eight.
  code = code.replaceAll('product_events[event_index * 8u', 'product_events[event_index * 21u');
  return code + '\n@group(0) @binding(9) var<storage,read> exact_history_p2g_validation:array<u32>;\n';
}
