import { mlsMpmMechanicsRefreshWgsl } from '../../../ulg-gpu-abi/src/wgsl.js';
import { sphReactionProductPlacementCaptureApplyWgsl } from '../../../ulg-gpu-abi/src/sphReactionProductPlacementSegmentedWgsl.js';
import { sphGasConstitutiveWgsl } from '../../../ulg-gpu-abi/src/sphGasConstitutiveWgsl.js';

// A narrow, byte-preserving extraction. No scientific token/expression rewrite.
// Adoption can move these same functions to a shared factory; this external
// draft imports the actual generated production shaders to prevent a stale copy.
export function originalWgslDeclaration(source, kind, name) {
  const marker = `${kind} ${name}${kind === 'fn' ? '(' : ' {'}`;
  const start = source.indexOf(marker);
  if (start < 0 || source.indexOf(marker, start + marker.length) >= 0) throw Error(`Missing/ambiguous original ${marker}`);
  const open = source.indexOf('{', start); if (open < 0) throw Error(`Missing original body ${name}`);
  let depth = 1, end = open + 1;
  while (depth && end < source.length) { const c = source[end++]; if (c === '{') depth++; if (c === '}') depth--; }
  if (depth) throw Error(`Unclosed original body ${name}`);
  if (source[end] === ';') end++;
  return source.slice(start, end);
}
export const originalMechanicsFunctionNames = Object.freeze([
  'mechanics_refresh_finite', 'mechanics_refresh_finite_vec4',
  'mechanics_refresh_determinant', 'mechanics_refresh_determinant_matches',
  'phase_record_row0', 'phase_record_row1', 'phase_record_row2',
  'find_phase_mechanics', 'mechanics_refresh_should_reset'
]);
export const originalPlacementFunctionNames = Object.freeze([
  'phase_is_gas', 'finite_scalar', 'finite_vec3', 'finite_vec4',
  'support_fits_box', 'clamp_to_box', 'route_merged_gas'
]);
export function originalExactPhysicalHelpers() {
  const mechanics = originalMechanicsFunctionNames.map(n => originalWgslDeclaration(mlsMpmMechanicsRefreshWgsl, 'fn', n));
  const placement = originalPlacementFunctionNames.map(n => originalWgslDeclaration(sphReactionProductPlacementCaptureApplyWgsl, 'fn', n));
  return { phaseStruct: originalWgslDeclaration(mlsMpmMechanicsRefreshWgsl, 'struct', 'PhaseMechanics'),
    placementStruct: originalWgslDeclaration(sphReactionProductPlacementCaptureApplyWgsl, 'struct', 'ProductPlacementParams'),
    mechanics, placement, gas: sphGasConstitutiveWgsl };
}
