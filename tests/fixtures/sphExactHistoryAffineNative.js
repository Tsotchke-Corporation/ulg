import { mlsMpmP2gGridProjectionWgsl } from '../../ulg-gpu-abi/src/wgsl.js';
import { mlsMpmP2gGridProjectionCanonicalSpatialUnobservedActiveSourceV2DenseSingleLevelWgsl }
  from '../../ulg-gpu-abi/src/schroederMechanicsSpatialAuthorityWgsl.js';
import { originalWgslDeclaration } from '../../src/runtime/sph/originalPhysicalHelpers.js';
import { specializeExactHistoryP2gWgsl } from '../../src/runtime/sph/sphExactHistoryP2gWgsl.js';
import { computeBufferBinding, prewarmCachedExplicitComputePipeline } from '../../src/runtime/webgpuComputeLayout.js';

// Isolate the actual history scatter's pre-quantization stress/APIC calculation.
// Analytic cases give measurable values independent of tiny residual mass and
// integer-grid rounding. These numerical inputs never become history owners;
// the separate original-producer tests cover admission, counts and lifetimes.
export async function inspectExactHistoryAffineNative(device, read) {
  const specialized = specializeExactHistoryP2gWgsl(
    mlsMpmP2gGridProjectionCanonicalSpatialUnobservedActiveSourceV2DenseSingleLevelWgsl, { rowWords: 2048 });
  const scatter = originalWgslDeclaration(specialized, 'fn', 'scatter_product_events');
  const start = scatter.indexOf('  let state_base = '), end = scatter.indexOf('  for (var ox = ');
  if (start < 0 || end < start) throw new Error('History scatter numerical body changed');
  const declarations = ['P2gProjectionParams', 'StressRows'].map(name => originalWgslDeclaration(mlsMpmP2gGridProjectionWgsl, 'struct', name));
  const helpers = ['det3', 'packed_pressure', 'corotated_stress', 'quadratic_weights']
    .map(name => originalWgslDeclaration(mlsMpmP2gGridProjectionWgsl, 'fn', name));
  const bulk = mlsMpmP2gGridProjectionWgsl.match(/const ARTIFICIAL_BULK_VISCOSITY_ALPHA: f32 = [^;]+;/)?.[0];
  if (!bulk) throw new Error('Original bulk viscosity coefficient missing');
  const code = [...declarations, ...helpers, bulk].join('\n') + `
@group(0) @binding(0) var<storage,read_write> output:array<vec4<f32>>;
@group(0) @binding(4) var<uniform> params:P2gProjectionParams;
@group(0) @binding(5) var<storage,read> product_events:array<vec4<f32>>;
@compute @workgroup_size(1) fn inspect_history_affine(){
  let event_index=0u;
${scatter.slice(start, end)}
  output[0]=vec4<f32>(aff_x,volume);output[1]=vec4<f32>(aff_y,0.0);output[2]=vec4<f32>(aff_z,0.0);
  output[3]=vec4<f32>(sigma.x,0.0);output[4]=vec4<f32>(sigma.y,0.0);output[5]=vec4<f32>(sigma.z,0.0);
}`;
  const prepared = await prewarmCachedExplicitComputePipeline(device, { label: 'exact-history-affine-numeric',
    cacheKey: 'ulg-exact-history-affine-numeric-v1', code, entryPoint: 'inspect_history_affine',
    bindings: [computeBufferBinding(0, 'storage'), computeBufferBinding(4, 'uniform'), computeBufferBinding(5, 'read-only-storage')] });
  if (!prepared.pipeline) throw prepared.error ?? new Error('History affine numerical pipeline unavailable');
  const diagonal = (a, b = a, c = a) => [a, 0, 0, 0, b, 0, 0, 0, c];
  const cases = [
    { name: 'all-nine-apic-components', dt: 0, pressure: 0, C: [1, 2, 3, 4, 5, 6, 7, 8, 9], sigma: diagonal(0) },
    { name: 'ambient-gas-fraction', eos: 2, gas: .25, ambient: 101325, sigma: diagonal(-2.25) },
    { name: 'vacuum-gas-fraction', eos: 2, gas: .25, sigma: diagonal(-4.5) },
    { name: 'liquid-compression', eos: 1, sound: 2, sigma: diagonal(-4 / 7 * 127) },
    { name: 'shear-and-compression-viscosity', pressure: 0, viscosity: .5,
      C: [-2, 3, 0, -1, 1, 2, 0, 4, 0], sigma: [-5 / 3 - .12, 1, 0, 1, 4 / 3 - .12, 3, 0, 3, 1 / 3 - .12] },
    { name: 'deformed-solid', F: diagonal(2, 1, .5), solid: 1, shear: 2, lambda: 3, sigma: diagonal(8, 0, -1) },
    { name: 'condensed-external-traction', pressure: 0, condensed: .5, external: 8, sigma: diagonal(4) }
  ];
  const results = [];
  for (const c of cases) {
    const owned = [], make = (label, values, usage) => {
      const buffer = device.createBuffer({ label, size: values.byteLength, usage }); owned.push(buffer);
      device.queue.writeBuffer(buffer, 0, values); return buffer;
    };
    try {
      const values = new Float32Array(84), physical = 32, mechanics = physical + 20;
      values[23] = 1; values[physical + 3] = 2; values[physical + 11] = 1;
      values[physical + 12] = c.condensed ?? 0; values[physical + 14] = c.gas ?? 0;
      values.set(c.F ?? diagonal(1), mechanics); values.set(c.C ?? diagonal(0), mechanics + 9);
      values[mechanics + 18] = 1; values[mechanics + 19] = 1;
      values[mechanics + 20] = c.solid ?? 0; values[mechanics + 23] = c.shear ?? 0;
      values[mechanics + 24] = c.lambda ?? 0; values[mechanics + 25] = c.sound ?? 3;
      values[mechanics + 26] = c.eos ?? 0; values[mechanics + 28] = 12345;
      values[mechanics + 29] = c.viscosity ?? 0;
      const param = new Float32Array(36), flags = new Uint32Array(param.buffer), dt = c.dt ?? .125;
      param[6] = .5; param[7] = 2; param[8] = dt; param[10] = c.pressure ?? 1;
      param[17] = c.ambient ?? 0; param[18] = c.external ?? 0; flags[19] = Number(c.external !== undefined);
      const input = make('history-affine-numeric-input', values, 128 | 8);
      const params = make('history-affine-numeric-params', param, 64 | 8);
      const output = make('history-affine-numeric-output', new Float32Array(24), 128 | 8 | 4);
      const group = device.createBindGroup({ layout: prepared.bindGroupLayout, entries: [
        { binding: 0, resource: { buffer: output } }, { binding: 4, resource: { buffer: params } },
        { binding: 5, resource: { buffer: input } }] });
      const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
      pass.setPipeline(prepared.pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(1); pass.end();
      device.queue.submit([encoder.finish()]);
      const actual = new Float32Array((await read(output)).buffer);
      const C = c.C ?? diagonal(0), expected = C.map((v, i) => 2 * v - dt * 16 * c.sigma[i]);
      const close = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= 2e-6 * Math.max(1, Math.abs(b));
      const affine = expected.every((v, i) => close(actual[Math.floor(i / 3) * 4 + i % 3], v));
      const stress = c.sigma.every((v, i) => close(actual[12 + Math.floor(i / 3) * 4 + i % 3], v));
      results.push({ name: c.name, affine, stress, actual: Array.from(actual), expected,
        expectedStress: c.sigma, pass: affine && stress && actual[3] === 1 });
    } finally { await device.queue.onSubmittedWorkDone(); for (const buffer of owned) buffer.destroy(); }
  }
  return { numericalOnly: true, results, pass: results.every(r => r.pass) };
}
