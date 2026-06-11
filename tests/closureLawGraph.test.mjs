import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPayload } from '../ulg-gpu-abi/src/index.js';
import {
  ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA,
  ULG_CLOSURE_LAW_GRAPH_SCHEMA,
  closureLawGraphEvalWgsl,
  compileClosureLawGraphFromTableClosure,
  evaluateClosureLawGraphCpu,
  runClosureLawGraphWithOptionalWebGpu
} from '../src/runtime/closureLawGraph.js';

function createOscillatorClosure(samples = null) {
  const inputHash = hashPayload({ closureKind: 'toy-two-particle-oscillator', runtime: 'flat-graph-test' });
  const methodHash = hashPayload({ mode: 'table-interpolation', potential: 'harmonic' });
  const defaultSamples = [
    { r: 0.5, energy: 0.125, dEdr: -0.5 },
    { r: 1, energy: 0, dEdr: 0 },
    { r: 1.5, energy: 0.125, dEdr: 0.5 }
  ];
  return {
    closureId: 'toy-oscillator-flat-graph-test-closure',
    closureKind: 'toy-two-particle-oscillator',
    inputHash,
    methodHash,
    execution: {
      mode: 'table-interpolation',
      table: {
        axisName: 'r',
        outputName: 'energy',
        derivativeName: 'dEdr',
        samples: samples || defaultSamples
      }
    },
    validity: { r: [0.5, 1.5] },
    validation: { status: 'pass', scientificValidation: false, fullPhysicsValidation: false },
    provenance: { inputHash, methodHash }
  };
}

test('closure-law graph WGSL exposes flat graph buffers and status outputs', () => {
  assert.match(closureLawGraphEvalWgsl, /struct ClosureLawGraphNode/);
  assert.match(closureLawGraphEvalWgsl, /var<storage, read> graph_nodes/);
  assert.match(closureLawGraphEvalWgsl, /var<storage, read> graph_edges/);
  assert.match(closureLawGraphEvalWgsl, /var<storage, read> graph_samples/);
  assert.match(closureLawGraphEvalWgsl, /var<storage, read_write> graph_slots/);
  assert.match(closureLawGraphEvalWgsl, /var<storage, read_write> graph_status/);
  assert.match(closureLawGraphEvalWgsl, /fn sample_table_linear/);
  assert.match(closureLawGraphEvalWgsl, /fn sample_table_step/);
});

test('CPU compiler packs a table closure into a flat closure-law graph', () => {
  const graph = compileClosureLawGraphFromTableClosure(createOscillatorClosure(), {
    initialInputs: { 0: 1.25 }
  });
  assert.equal(graph.schema, ULG_CLOSURE_LAW_GRAPH_SCHEMA);
  assert.equal(graph.compilerStatus, 'cpu-validated-flat-closure-law-graph');
  assert.equal(graph.nodeCount, 1);
  assert.equal(graph.edgeCount, 0);
  assert.equal(graph.sampleCount, 3);
  assert.equal(graph.slotCount, 3);
  assert.equal(graph.sourceClosureId, 'toy-oscillator-flat-graph-test-closure');
  assert.equal(graph.axisName, 'r');
  assert.equal(graph.outputName, 'energy');
  assert.equal(graph.derivativeName, 'dEdr');
  assert.equal(graph.slotRows[0], 1.25);
  assert.equal(graph.fullPhysicsValidation, false);
});

test('CPU compiler rejects unsorted table axes instead of silently clamping/sorting', () => {
  const closure = createOscillatorClosure([
    { r: 1, energy: 0, dEdr: 0 },
    { r: 0.5, energy: 0.125, dEdr: -0.5 },
    { r: 1.5, energy: 0.125, dEdr: 0.5 }
  ]);
  assert.throws(
    () => compileClosureLawGraphFromTableClosure(closure),
    /strictly increasing table axes/
  );
});

test('CPU evaluator samples table-linear nodes through flat slots', () => {
  const graph = compileClosureLawGraphFromTableClosure(createOscillatorClosure());
  const execution = evaluateClosureLawGraphCpu(graph, { inputs: { 0: 1.25 } });
  assert.equal(execution.schema, ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.status, 'closure-law-graph-evaluated');
  assert.equal(execution.closureRefreshRecommended, false);
  assert.equal(execution.slots[0].value, 1.25);
  assert.equal(execution.slots[1].value, 0.0625);
  assert.equal(execution.slots[1].derivative, 0.25);
  assert.equal(execution.slots[2].value, 0.25);
  assert.equal(execution.statusRows[1], 1);
});

test('CPU evaluator reports closure refresh on domain exit', () => {
  const graph = compileClosureLawGraphFromTableClosure(createOscillatorClosure());
  const execution = evaluateClosureLawGraphCpu(graph, { inputs: { 0: 2 } });
  assert.equal(execution.status, 'closure-law-graph-domain-exit');
  assert.equal(execution.closureRefreshRecommended, true);
  assert.equal(execution.statusRows[1], 3);
  assert.equal(execution.statusRows[2], 2);
  assert.equal(execution.statusRows[3], 1.5);
});

test('CPU evaluator samples table-step nodes for selector/categorical outputs', () => {
  const graph = compileClosureLawGraphFromTableClosure(createOscillatorClosure(), {
    initialInputs: { 0: 1.25 }
  });
  const stepGraph = {
    ...graph,
    graphId: 'toy-step-selector-graph',
    nodeRows: new Float32Array(graph.nodeRows),
    sampleRows: new Float32Array([
      0.5, 1, 0, 0,
      1.0, 2, 0, 0,
      1.5, 3, 0, 0
    ])
  };
  stepGraph.nodeRows[0] = 2;
  stepGraph.nodeRows[5] = 3;
  const execution = evaluateClosureLawGraphCpu(stepGraph, { inputs: { 0: 1.25 } });

  assert.equal(execution.status, 'closure-law-graph-evaluated');
  assert.equal(execution.slots[1].value, 2);
  assert.equal(execution.slots[1].derivative, 0);
  assert.equal(execution.slots[2].value, 0);
  assert.equal(execution.statusRows[1], 1);
});

test('optional WebGPU closure-law graph path accepts a parity-passing injected runner', async () => {
  const graph = compileClosureLawGraphFromTableClosure(createOscillatorClosure());
  const execution = await runClosureLawGraphWithOptionalWebGpu({
    graph,
    inputs: { 0: 1.25 },
    preferWebGpu: true,
    device: {},
    webGpuRunner({ graph: runnerGraph, inputs }) {
      return {
        ...evaluateClosureLawGraphCpu(runnerGraph, { inputs }),
        backend: 'webgpu'
      };
    }
  });
  assert.equal(execution.schema, ULG_CLOSURE_LAW_GRAPH_EXECUTION_SCHEMA);
  assert.equal(execution.backend, 'webgpu');
  assert.equal(execution.status, 'webgpu-accepted');
  assert.equal(execution.webgpuStatus.status, 'webgpu-executed');
  assert.equal(execution.webgpuParity.status, 'pass');
  assert.equal(execution.result.status, 'closure-law-graph-evaluated');
});

test('optional WebGPU closure-law graph path rejects parity drift', async () => {
  const graph = compileClosureLawGraphFromTableClosure(createOscillatorClosure());
  const execution = await runClosureLawGraphWithOptionalWebGpu({
    graph,
    inputs: { 0: 1.25 },
    preferWebGpu: true,
    device: {},
    webGpuRunner({ graph: runnerGraph, inputs }) {
      const result = evaluateClosureLawGraphCpu(runnerGraph, { inputs });
      result.backend = 'webgpu';
      result.slotRows[4] += 1;
      return result;
    }
  });
  assert.equal(execution.backend, 'cpu-reference');
  assert.equal(execution.status, 'webgpu-parity-failed-cpu-reference');
  assert.equal(execution.webgpuStatus.status, 'webgpu-parity-failed');
  assert.equal(execution.webgpuParity.status, 'fail');
});
