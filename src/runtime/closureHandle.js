function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`${label} must be finite`);
  }
  return number;
}

function readAxisName(table = {}) {
  if (table.axisName) return table.axisName;
  if (Array.isArray(table.axes) && table.axes[0]?.name) return table.axes[0].name;
  if (isObject(table.axes)) return Object.keys(table.axes)[0] || 'r';
  return 'r';
}

function readAxisValues(table, axisName) {
  if (Array.isArray(table.axisValues)) return table.axisValues;
  if (Array.isArray(table.axes?.[axisName])) return table.axes[axisName];
  if (Array.isArray(table.axes?.[0]?.values)) return table.axes[0].values;
  if (Array.isArray(table[axisName])) return table[axisName];
  return null;
}

function readOutputValues(table, outputName) {
  if (Array.isArray(table.outputValues)) return table.outputValues;
  if (Array.isArray(table.outputs?.[outputName])) return table.outputs[outputName];
  if (Array.isArray(table.outputs?.[0]?.values)) return table.outputs[0].values;
  if (Array.isArray(table[outputName])) return table[outputName];
  return null;
}

function readDerivativeValues(table, derivativeName) {
  if (Array.isArray(table.derivativeValues)) return table.derivativeValues;
  if (Array.isArray(table.derivatives?.[derivativeName])) return table.derivatives[derivativeName];
  if (Array.isArray(table.derivatives?.[0]?.values)) return table.derivatives[0].values;
  if (Array.isArray(table[derivativeName])) return table[derivativeName];
  return null;
}

function normalizeSamples(table = {}) {
  const axisName = readAxisName(table);
  const outputName = table.outputName || table.valueName || 'energy';
  const derivativeName = table.derivativeName || 'dEdr';
  if (Array.isArray(table.samples)) {
    return table.samples.map((sample, index) => ({
      axis: finiteNumber(sample[axisName] ?? sample.r ?? sample.x, `sample[${index}].${axisName}`),
      value: finiteNumber(sample[outputName] ?? sample.energy ?? sample.value, `sample[${index}].${outputName}`),
      derivative: sample[derivativeName] == null
        ? null
        : finiteNumber(sample[derivativeName], `sample[${index}].${derivativeName}`)
    })).sort((left, right) => left.axis - right.axis);
  }
  const axisValues = readAxisValues(table, axisName);
  const outputValues = readOutputValues(table, outputName);
  if (!Array.isArray(axisValues) || !Array.isArray(outputValues) || axisValues.length !== outputValues.length) {
    throw new Error('table-interpolation closures require matched axis and output samples');
  }
  const derivativeValues = readDerivativeValues(table, derivativeName);
  return axisValues.map((axis, index) => ({
    axis: finiteNumber(axis, `axis[${index}]`),
    value: finiteNumber(outputValues[index], `${outputName}[${index}]`),
    derivative: derivativeValues?.[index] == null
      ? null
      : finiteNumber(derivativeValues[index], `${derivativeName}[${index}]`)
  })).sort((left, right) => left.axis - right.axis);
}

export function normalizeClosureTableSamples(table = {}) {
  const axisName = readAxisName(table);
  const outputName = table.outputName || table.valueName || 'energy';
  const derivativeName = table.derivativeName || 'dEdr';
  return {
    axisName,
    outputName,
    derivativeName,
    samples: normalizeSamples(table)
  };
}

function interpolate(left, right, x) {
  if (right.axis === left.axis) return left.value;
  const t = (x - left.axis) / (right.axis - left.axis);
  return left.value + t * (right.value - left.value);
}

function interpolateDerivative(left, right, x) {
  if (left.derivative != null && right.derivative != null) {
    if (right.axis === left.axis) return left.derivative;
    const t = (x - left.axis) / (right.axis - left.axis);
    return left.derivative + t * (right.derivative - left.derivative);
  }
  return (right.value - left.value) / (right.axis - left.axis);
}

export function createClosureHandle(closureArtifact) {
  const mode = closureArtifact?.execution?.mode;
  if (mode !== 'table-interpolation') {
    throw new Error(`Unsupported closure execution mode for Phase 1 carrier runtime: ${mode || 'missing'}`);
  }
  const table = closureArtifact.execution.table || closureArtifact.table;
  if (!isObject(table)) {
    throw new Error('table-interpolation closure missing execution.table');
  }
  const {
    axisName,
    outputName,
    derivativeName,
    samples
  } = normalizeClosureTableSamples(table);
  if (samples.length < 2) {
    throw new Error('table-interpolation closure requires at least two samples');
  }
  const min = samples[0].axis;
  const max = samples[samples.length - 1].axis;
  return {
    closureId: closureArtifact.closureId,
    closureKind: closureArtifact.closureKind,
    mode,
    axisName,
    outputName,
    derivativeName,
    validity: closureArtifact.validity || {},
    sample(coords = {}) {
      const x = finiteNumber(coords[axisName] ?? coords.r, axisName);
      if (x < min || x > max) {
        throw new RangeError(`Closure sample ${axisName}=${x} outside table domain [${min}, ${max}]`);
      }
      let left = samples[0];
      let right = samples[samples.length - 1];
      for (let index = 0; index < samples.length - 1; index += 1) {
        if (x >= samples[index].axis && x <= samples[index + 1].axis) {
          left = samples[index];
          right = samples[index + 1];
          break;
        }
      }
      const value = interpolate(left, right, x);
      const derivative = interpolateDerivative(left, right, x);
      return {
        status: 'sampled',
        coords: { [axisName]: x },
        value,
        outputs: { [outputName]: value },
        derivatives: {
          [derivativeName]: derivative,
          dEdr: derivative
        }
      };
    }
  };
}
