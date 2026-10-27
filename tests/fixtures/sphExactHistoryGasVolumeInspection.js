import { schroederQuadraticControlVolumeAxisProjection as axisProjection }
  from '../../ulg-gpu-abi/src/schroederQuadraticControlVolumeProjection.js';

// CPU geometry oracle over actual original moment fields and independently
// exact-checked retained projections. No history or count owner is invented.
export async function inspectExactHistoryGasVolume({ result, captures, read,
  pressureCells, views, count, descriptor, expectedCondensedRows, aerosolRead = null, aerosolWords = null }) {
  let control, output;
  for (const [label, buffer] of captures) {
    if (!label.endsWith('-control')) continue;
    const candidate = await read(buffer);
    if (candidate[44] !== 1) continue;
    if (control) throw new Error('More than one original history volume execution');
    control = candidate;
    output = await read(captures.get(label.replace(/-control$/, '-rows')));
  }
  if (!control) throw new Error('Original history free-volume output was not observed');
  const level = result.mechanicsLevelViews[0], field = level.mechanicsFieldView;
  const moments = await read(level.phaseVolumeMoment.momentBuffer);
  const momentControl = await read(level.phaseVolumeMoment.controlBuffer);
  const momentFloats = new Float32Array(moments.buffer), outputFloats = new Float32Array(output.buffer);
  const condensed = Array.from({ length: count[3] }, (_, i) => i)
    .filter(i => views[i * 32 + 11] === 1 || views[i * 32 + 11] === 2);
  const axis = (node, cell) => {
    const a = axisProjection(node, 0, 0, 4, 0);
    if (!a.valid) throw new Error('Invalid CPU volume projection');
    return (a.cell0 === cell ? a.weight0 : 0) + (a.cell1 === cell ? a.weight1 : 0);
  };
  const weight = (node, cell) => node.reduce((v, n, i) => v * axis(n, cell[i]), 1);
  const quadratic = (f, i) => i === 0 ? .5 * (1.5 - f) ** 2
    : i === 1 ? .75 - (f - 1) ** 2 : .5 * (f - .5) ** 2;
  const cells = pressureCells.map(cell => {
    let carrierVolume = 0, historyVolume = 0, aerosolVolume = 0;
    for (let i = 0; i < momentControl[18]; i++) {
      const at = i * 12;
      if (moments[at + 1] !== 1 && moments[at + 1] !== 2) continue;
      const dense = moments[at], [, ny, nz] = field.gridDims;
      const node = [Math.floor(dense / (ny * nz)), Math.floor(dense / nz) % ny, dense % nz]
        .map(n => n - field.gridShift);
      carrierVolume += momentFloats[at + 4] * weight(node, cell.gridIndex);
    }
    const project = (xyz, volume) => {
      let sum = 0;
      const position = xyz.map(p => Math.fround(p / field.gridSpacingM));
      const base = position.map(p => Math.floor(p - .5)), f = position.map((p, a) => p - base[a]);
      for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) {
        const b = quadratic(f[0], x) * quadratic(f[1], y) * quadratic(f[2], z);
        sum += volume * b * weight([base[0] + x, base[1] + y, base[2] + z], cell.gridIndex);
      }
      return sum;
    };
    for (const i of condensed) {
      const at = i * 32;
      historyVolume += project([views[at], views[at + 1], views[at + 2]], views[at + 23]);
    }
    if (aerosolRead) {
      const f = new Float32Array(aerosolWords.buffer);
      for (let i = 0; i < aerosolRead.capacity; i++) {
        const at = i * 24;
        if (aerosolWords[at + 22] !== 1) continue;
        aerosolVolume += project([f[at], f[at + 1], f[at + 2]], Math.fround(f[at + 3] / f[at + 9]));
      }
    }
    const at = cell.index * 4, expected = carrierVolume + historyVolume + aerosolVolume;
    const occupied = outputFloats[at + 1], free = outputFloats[at + 2];
    // Scale to the observed occupied volume, which can be far below a cell's
    // geometric volume. Keep both the accuracy and 10x signal checks strict.
    const tolerance = Math.max(1e-15, expected * 1e-6);
    return { carrierVolume, historyVolume, aerosolVolume, expected, occupied, free, tolerance,
      matches: Math.abs(occupied - expected) <= tolerance
        && output[at + 3] === 3 && cell.volumeM3 === free
        && free === Math.fround(Math.max(0, outputFloats[at] - occupied)),
      residualMeasured: expectedCondensedRows === 0 || (historyVolume > tolerance * 10
        && occupied - carrierVolume > tolerance * 10) };
  });
  const checks = {
    originalHistoryCount: control[44] === 1 && control[45] === descriptor.generation
      && control[46] === descriptor.seal && control[47] === descriptor.rowCapacity
      && control[48] === count[3] && control[49] === descriptor.rowCapacity
      && control[50] === expectedCondensedRows && condensed.length === expectedCondensedRows
      && control[51] === 0 && control[52] === control[4]
      && control[53] === descriptor.rowStrideFloats / 4 && control[54] === 1,
    aerosolOwner: aerosolRead ? control[35] === 1 && control[36] === aerosolRead.familyId
      && control[37] === aerosolRead.generation && control[38] === aerosolRead.capacity
      && control[39] === aerosolRead.capacity
      && control[40] === Array.from({ length: aerosolRead.capacity }, (_, i) => aerosolWords[i * 24 + 22]).filter(v => v === 1).length
      && control[41] === 0
      && control[43] === control[4] : control.slice(35, 44).every(v => v === 0),
    volume: cells.length > 0 && cells.every(c => c.matches && c.residualMeasured)
  };
  return { control: Array.from(control), cells, checks, pass: Object.values(checks).every(Boolean) };
}
