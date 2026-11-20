import { computeBufferBinding, createCachedExplicitComputePipeline } from '../webgpuComputeLayout.js';

// G2 integer ledger, Phase 6 optics (plan/todo/g2-integer-ledger-proposal.md):
// condensate rendered from the parcels' own droplets. After the render-field
// gather, this pass adds each parcel population's extinction to the H2O
// collective-medium surface's cells, in the gather's units (wgsl.js
// render-field main): lane 1 holds optical depth per render cell, so the sum
// of tau * edge^2 over cells is the deposited cross-section.
//
// A parcel's multiplicity is a droplet count over its gas cell, the volume
// the vapor-parcel exchange resolves (super-droplet concentration). Its
// cross-section is therefore spread with a normalized tent kernel of
// half-width one gas cell (cloud-in-cell at the gas-grid resolution), not
// deposited at a point: a point deposit would pack a whole gas cell's
// droplets into a few render cells and draw structure the physics never
// resolved. Render cells sample the kernel at their nodes, the same node
// positions the gather's CIC uses; mass leaving through the box walls is
// not folded back, so wall-adjacent parcels render slightly thinner.
//
// Per parcel: N droplets of radius r (the exchange's projection), extinction
// efficiency from van de Hulst's anomalous-diffraction approximation for
// water at 550 nm (n = 1.333, no absorption), Q = 2 - 4/rho sin rho +
// 4/rho^2 (1 - cos rho), rho = 2x(n-1), x = 2 pi r / lambda; asymmetry 0.85
// (cloud droplets, Hansen & Travis 1974). These are benchmark optics choices.
export const SPH_LEDGER_PARCEL_OPTICS = Object.freeze({
  wavelengthM: 550e-9, refractiveIndex: 1.333, asymmetry: 0.85
});
const GPU_BUFFER_USAGE = Object.freeze({ STORAGE: 0x80, UNIFORM: 0x40, COPY_DST: 0x08 });

export const sphLedgerParcelOpticsWgsl = /* wgsl */ `
struct OpticsParams {
  // parcel_count, resolution, field_offset, unused
  counts: vec4<u32>,
  // field padding, reference edge (m), wavelength (m), refractive index
  map: vec4<f32>,
  // asymmetry, gas-cell size (m), unused...
  optics: vec4<f32>,
};
@group(0) @binding(0) var<uniform> params: OpticsParams;
@group(0) @binding(1) var<storage, read> parcels: array<f32>;
@group(0) @binding(2) var<storage, read_write> field_rows: array<f32>;
const PI: f32 = 3.14159265358979;
const PARAM_FLOATS: u32 = 8u;
const CELL_FLOATS: u32 = 8u;

// Normalized tent of half-width h: integrates to one along the axis.
fn tent(distance: f32, h: f32) -> f32 {
  return max(0.0, 1.0 - abs(distance) / h) / h;
}
fn extinction_efficiency(radius_m: f32) -> f32 {
  let size = 2.0 * PI * radius_m / params.map.z;
  let rho = 2.0 * size * (params.map.w - 1.0);
  if (rho < 1.0e-2) { return 0.5 * rho * rho; }
  return 2.0 - 4.0 / rho * sin(rho) + 4.0 / (rho * rho) * (1.0 - cos(rho));
}

@compute @workgroup_size(64)
fn add_parcel_optics(@builtin(global_invocation_id) id: vec3<u32>) {
  let resolution = params.counts.y;
  let cell = id.x;
  if (cell >= resolution * resolution * resolution) { return; }
  let xy = resolution * resolution;
  let z = cell / xy; let rem = cell - z * xy; let y = rem / resolution; let x = rem - y * resolution;
  let padding = params.map.x; let span = 1.0 - 2.0 * padding;
  let ref_edge = params.map.y;
  let render_edge = ref_edge / (span * f32(resolution));
  let h = params.optics.y;
  // World position of this render cell's node: the inverse of the gather map
  // p = padding + (pos / ref_edge) * span with node i at p = i / resolution.
  let node = (vec3<f32>(f32(x), f32(y), f32(z)) / f32(resolution) - vec3<f32>(padding)) * (ref_edge / span);
  var scattering = 0.0;
  var weighted_temperature = 0.0;
  for (var p = 0u; p < params.counts.x; p++) {
    let base = p * PARAM_FLOATS;
    let radius = parcels[base + 7u];
    let count = parcels[base + 3u];
    if (!(radius > 0.0) || !(count > 0.0)) { continue; }
    let d = node - vec3<f32>(parcels[base], parcels[base + 1u], parcels[base + 2u]);
    let density = tent(d.x, h) * tent(d.y, h) * tent(d.z, h);
    if (density <= 0.0) { continue; }
    // Extinction coefficient (1/m) times the render cell edge.
    let cross_section = count * PI * radius * radius * extinction_efficiency(radius);
    let tau = (cross_section * density) * render_edge;
    scattering += tau;
    weighted_temperature += parcels[base + 6u] * tau;
  }
  if (!(scattering > 0.0)) { return; }
  let row = (params.counts.z + cell) * CELL_FLOATS;
  // Lane 1 is (T, tau_s, tau_a, tau_g); T is extinction-weighted like the
  // gather's dispersed temperature, so the medium's emission stays consistent.
  let prior_extinction = max(field_rows[row + 5u], 0.0) + max(field_rows[row + 6u], 0.0);
  field_rows[row + 4u] = (field_rows[row + 4u] * prior_extinction + weighted_temperature)
    / (prior_extinction + scattering);
  field_rows[row + 5u] = field_rows[row + 5u] + scattering;
  field_rows[row + 7u] = field_rows[row + 7u] + params.optics.x * scattering;
}
`;

/** Encode the parcel optics pass into an encoder that will then pack the medium. */
export function encodeSphLedgerParcelOpticsWebGpu({ device, encoder, parcels, fieldRowsBuffer, fieldOffset,
  resolution, fieldPadding, refEdgeM } = {}) {
  if (!parcels?.count || !fieldRowsBuffer || !(resolution > 0) || !(refEdgeM > 0)) return null;
  const gasCellM = parcels.boxDimensionsM[0] / parcels.cellsPerAxis;
  if (!(gasCellM > 0)) throw new TypeError('Ledger parcel optics require the parcel gas-cell size');
  const pipeline = createCachedExplicitComputePipeline(device, { cacheKey: 'ulg-ledger-parcel-optics.v1',
    label: 'ulg-ledger-parcel-optics', code: sphLedgerParcelOpticsWgsl, entryPoint: 'add_parcel_optics',
    bindings: ['uniform', 'read-only-storage', 'storage'].map((type, binding) => computeBufferBinding(binding, type)) });
  const params = device.createBuffer({ label: 'ulg-ledger-parcel-optics-params', size: 48,
    usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
  const words = new ArrayBuffer(48), u = new Uint32Array(words), f = new Float32Array(words);
  u.set([parcels.count, resolution, fieldOffset, 0], 0);
  f.set([fieldPadding, refEdgeM, SPH_LEDGER_PARCEL_OPTICS.wavelengthM, SPH_LEDGER_PARCEL_OPTICS.refractiveIndex], 4);
  f.set([SPH_LEDGER_PARCEL_OPTICS.asymmetry, gasCellM, 0, 0], 8);
  device.queue.writeBuffer(params, 0, words);
  const bindGroup = device.createBindGroup({ layout: pipeline.bindGroupLayout,
    entries: [params, parcels.paramsBuffer, fieldRowsBuffer].map((buffer, binding) => ({ binding, resource: { buffer } })) });
  const pass = encoder.beginComputePass({ label: 'ulg-ledger-parcel-optics' });
  pass.setPipeline(pipeline.pipeline); pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(resolution ** 3 / 64)); pass.end();
  return params;
}
