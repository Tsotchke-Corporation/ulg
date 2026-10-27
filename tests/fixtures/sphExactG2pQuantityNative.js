import { prepareSphExactG2pNumericQuantities } from '../../src/runtime/sph/sphExactG2pQuantityGpu.js';
import { sphExactRationalQuantityLayout } from '../../src/runtime/sph/sphExactRationalQuantityWgsl.js';
import { createSphExactMassFormat } from '../../ulg-gpu-abi/src/sphExactMassInventory.js';
import { inspectExactG2pQuantities } from './sphExactPlacementQuantityInspection.js';

// Isolated numerical fixture, not a registered particle/history producer.
// Deliberately give the correction a rounded J=1 and retained V/V0=8:
// its scale must be two, including F[3]/F[7], without modifying any C word.
export async function inspectExactG2pDeformationNative(device, read, {
  wordCount = 1, quantumExponent = 0, rationalWordCount = 1, count = 65, activeCount = 1
} = {}) {
  const results = [];
  for (const indirect of [false, true]) {
    const owned = [], allocate = descriptor => {
      const buffer = device.createBuffer(descriptor); owned.push(buffer); return buffer;
    };
    const format = createSphExactMassFormat({ wordCount, quantumExponent });
    const scalar = sphExactRationalQuantityLayout({ wordCount: rationalWordCount });
    const layout = { rowCount: count, massOffsetWords: 16, scalarOffsetWords: 16 + wordCount, scalar,
      recordWords: 16 + wordCount + 7 * scalar.recordWords,
      fields: ['Px', 'Py', 'Pz', 'E', 'V0', 'V', 'M31'] };
    const quantities = new Uint32Array(count * layout.recordWords);
    const massUnits = (1n << BigInt(-quantumExponent)) + (quantumExponent < -24 ? 1n : 0n);
    for (let row = 0; row < activeCount; row++) {
      const base = row * layout.recordWords; quantities[base] = 1;
      for (let i = 0; i < wordCount; i++) quantities[base + 16 + i] = Number((massUnits >> BigInt(i * 32)) & 0xffffffffn);
      [massUnits, 2n * massUnits, 3n * massUnits, 16n * massUnits, 1n, 8n, massUnits].forEach((value, field) => {
        const at = base + layout.scalarOffsetWords + field * scalar.recordWords;
        let exponent = field === 4 || field === 5 ? 0 : quantumExponent;
        while (value && value % 2n === 0n) { value /= 2n; exponent++; }
        quantities[at + 2] = exponent;
        for (let i = 0; i < scalar.wordCount; i++) quantities[at + 4 + i] = Number((value >> BigInt(i * 32)) & 0xffffffffn);
        quantities[at + 4 + scalar.wordCount] = 1;
      });
    }
    const state = new Float32Array(count * 8), mechanics = new Float32Array(count * 32);
    for (let row = 0; row < activeCount; row++) {
      state.set([.25, .5, .75, 1, 1, 2, 3, 9], row * 8);
      mechanics.set([1, 1, 0, 1, 2, 1, 0, 1, 2, .125, -.25, .5, -.75, 1, -1.25, 1.5, -1.75, 2, 1, 1], row * 32);
      mechanics[row * 32 + 31] = 1;
    }
    const upload = (label, data, usage = 128 | 4 | 8) => {
      const buffer = allocate({ label, size: data.byteLength, usage }); device.queue.writeBuffer(buffer, 0, data); return buffer;
    };
    let released = false;
    try {
      const original = upload('g2p-numeric-source', quantities);
      const oldState = upload('g2p-numeric-old-state', state), oldMechanics = upload('g2p-numeric-old-mechanics', mechanics);
      const outState = upload('g2p-numeric-new-state', state), outMechanics = upload('g2p-numeric-new-mechanics', mechanics);
      const dispatch = indirect ? upload('g2p-numeric-indirect',
        new Uint32Array([Math.ceil(activeCount / 32), 1, 1, Math.ceil(activeCount * 6 / 32), 1, 1]), 256 | 8) : null;
      const update = await prepareSphExactG2pNumericQuantities({ device, quantityBuffer: original,
        quantityLayout: layout, format, particleCount: count, allocate,
        validate() { if (released) throw new Error('Numerical input released'); }, markDerivedBuffers() {},
        indirectDispatch: dispatch ? { buffer: dispatch, rowOffset: 0, projectionOffset: 12 } : null });
      device.queue.writeBuffer(update.quantityBuffer, 0, new Uint32Array(quantities.length).fill(0xdeadbeef));
      const encoder = device.createCommandEncoder();
      update.encode(encoder, { stateBuffer: oldState, mechanicsBuffer: oldMechanics,
        outStateBuffer: outState, outMechanicsBuffer: outMechanics });
      device.queue.submit([encoder.finish()]);
      const after = await read(update.quantityBuffer), updatedState = await read(outState), updatedMechanics = await read(outMechanics);
      const numeric = inspectExactG2pQuantities({ before: quantities, after, sourceState: new Uint32Array(state.buffer),
        sourceMechanics: new Uint32Array(mechanics.buffer), state: updatedState, mechanics: updatedMechanics,
        increments: await read(update.projectionBuffer), layout, format, validation: await read(update.validationBuffer) });
      const values = new Float32Array(updatedMechanics.buffer);
      const initialBits = new Uint32Array(mechanics.buffer), activeRows = Array.from({ length: activeCount }, (_, i) => i);
      const deformation = activeRows.every(row => Array.from(mechanics.slice(row * 32, row * 32 + 9))
        .every((v, i) => Math.abs(values[row * 32 + i] - 2 * v) <= 2e-6));
      const affine = activeRows.every(row => updatedMechanics.slice(row * 32 + 9, row * 32 + 18)
        .every((v, i) => v === initialBits[row * 32 + 9 + i]));
      const otherMechanics = activeRows.every(row => updatedMechanics.slice(row * 32 + 19, row * 32 + 32)
        .every((v, i) => v === initialBits[row * 32 + 19 + i]));
      const sourceUnchanged = (await read(original)).every((v, i) => v === quantities[i])
        && (await read(oldMechanics)).every((v, i) => v === new Uint32Array(mechanics.buffer)[i]);
      results.push({ indirect, wordCount, rationalWordCount, count, activeCount, numeric, deformation, affine, otherMechanics, sourceUnchanged,
        inactiveCleared: after.slice(activeCount * layout.recordWords).every(v => v === 0), projectedJ: values[18],
        pass: numeric.matches && deformation && affine && otherMechanics && sourceUnchanged && values[18] === 8 });
    } finally {
      await device.queue.onSubmittedWorkDone(); released = true; for (const buffer of owned) buffer.destroy();
    }
  }
  return { numericalOnly: true, results, pass: results.every(result => result.pass && result.inactiveCleared) };
}
