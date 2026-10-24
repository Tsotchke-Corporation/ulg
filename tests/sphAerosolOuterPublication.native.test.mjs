import assert from 'node:assert/strict';
import test from 'node:test';

// Analytic inventory of the manufactured post-thermal fixture, fixed before
// any browser or GPU observation. One 2 kg liquid carrier and two 4 kg
// 25%-liquid/75%-gas carriers give the phase split below. Only lineage zero
// is extracted, so exactly 1 kg moves from its carrier into an aerosol parcel.
const EXPECTED_BUDGET = Object.freeze({
  massKg: 10,
  carrierMassKg: 9,
  aerosolMassKg: 1,
  phaseMassKg: Object.freeze({ solid: 0, liquid: 4, gas: 6, plasma: 0 }),
  momentumKgMPerS: Object.freeze([4, -4, 0]),
  firstMomentKgM: Object.freeze([21, 17, 17]),
  internalEnergyJ: 220,
  translationalKineticEnergyJ: 12,
  internalPlusTranslationalKineticEnergyJ: 232,
  physicalMultiplicity: String((1n << 40n) + 7n)
});

// These optical expectations are independent of the producer/reference code.
// Every post-reaction fixture has 10 kg on the liquid address and a 4 kg gas-
// address donor containing 1 kg liquid. Extraction leaves 13 kg carriers plus
// 1 kg aerosol. A declared older optical subset starts at D=2 kg. The thermal
// and reaction snapshots are manufactured inputs, not reaction chemistry.
const OPTICAL_CASES = Object.freeze([
  Object.freeze({ name: 'new-donor-birth-preserves-old-subset',
    preDonorLiquidMassKg: 0, preBulkLiquidMassKg: 10,
    bulkMaterialId: 9, expectedDispersedMassKg: 2 }),
  Object.freeze({ name: 'thermal-donor-does-not-erase-other-birth',
    preDonorLiquidMassKg: 1, preBulkLiquidMassKg: 9.5,
    bulkMaterialId: 9, expectedDispersedMassKg: 2.5 }),
  Object.freeze({ name: 'shrinking-donor-does-not-cancel-other-birth',
    preDonorLiquidMassKg: 1.5, preBulkLiquidMassKg: 9.5,
    bulkMaterialId: 9, expectedDispersedMassKg: 2.5 }),
  Object.freeze({ name: 'mixed-material-capture-only-not-publishable',
    preDonorLiquidMassKg: 0, preBulkLiquidMassKg: 9.5,
    bulkMaterialId: 11, expectedDispersedMassKg: 2.5,
    unsupportedMixedMaterial: true })
]);

test('native condensate closure reaches paired SS publication and exact next-generation handover', {
  skip: process.env.ULG_RUN_NATIVE_AEROSOL_OUTER_PUBLICATION === '1'
    ? false
    : 'set ULG_RUN_NATIVE_AEROSOL_OUTER_PUBLICATION=1 for the owned desktop GPU check',
  timeout: 180_000
}, async (t) => {
  const evidencePath = process.env.ULG_AEROSOL_OUTER_PUBLICATION_EVIDENCE;
  if (!evidencePath) {
    throw new TypeError(
      'ULG_AEROSOL_OUTER_PUBLICATION_EVIDENCE must name a new absolute evidence file'
    );
  }
  const { isAbsolute } = await import('node:path');
  if (!isAbsolute(evidencePath)) {
    throw new TypeError('ULG_AEROSOL_OUTER_PUBLICATION_EVIDENCE must be absolute');
  }

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: false,
    args: [
      '--ozone-platform=wayland',
      '--use-angle=vulkan',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist'
    ]
  });
  const started = performance.now();
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: false });
    const baseUrl = process.env.ULG_AEROSOL_OUTER_PUBLICATION_BASE_URL
      || 'https://fastbox.tail5c077c.ts.net:5173/';
    await page.goto(new URL('/package.json', baseUrl).href);

    const observed = await page.evaluate(async ({ expectedBudget, opticalCases }) => {
      const dependency = async (url, file) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Cannot resolve ${url}: HTTP ${response.status}`);
        }
        const code = await response.text();
        const paths = [...code.matchAll(/from\s+["']([^"']+)["']/g)]
          .map((match) => match[1]);
        const path = paths.find((entry) => entry.split('?')[0].endsWith('/' + file));
        if (!path) throw new Error(`Missing exact dependency ${file} in ${url}`);
        return new URL(path, new URL(url, location.href)).href;
      };
      const sameDependency = async (parent, file, expected) => {
        const actual = await dependency(parent, file);
        if (actual !== expected) {
          throw new Error(`Inconsistent native module identity: ${actual} !== ${expected}`);
        }
      };

      // The running hierarchy is the authoritative transformed root. Follow
      // its exact Vite URLs so every private WeakMap has one module identity.
      const hierarchyUrl = new URL(
        '/src/runtime/sph/schroederHierarchyGpu.js',
        location.href
      ).href;
      const closureUrl = await dependency(
        hierarchyUrl,
        'sphMlsMpmPostMechanicsClosure.js'
      );
      const transactionUrl = await dependency(
        hierarchyUrl,
        'schroederSpatialEpochTransaction.js'
      );
      const spatialUrl = await dependency(
        hierarchyUrl,
        'schroederSpatialEpochGpu.js'
      );
      const successorUrl = await dependency(
        hierarchyUrl,
        'schroederSpatialSuccessorSourceFamily.js'
      );
      const ownerUrl = await dependency(closureUrl, 'sphAerosolParcelGpu.js');
      const bindingUrl = await dependency(
        closureUrl,
        'sphAerosolSpatialBinding.js'
      );
      const identityUrl = await dependency(closureUrl, 'sphGpuDeviceIdentity.js');
      const opticsUrl = await dependency(
        hierarchyUrl,
        'sphDispersedMediumOpticsProducerGpu.js'
      );
      const opticalClosureUrl = await dependency(
        opticsUrl,
        'sphDispersedMediumOpticalClosure.js'
      );
      const summaryUrl = new URL(
        '/src/runtime/sph/sphMlsMpmGpuSummary.js',
        location.href
      ).href;
      for (const [parent, file, expected] of [
        [closureUrl, 'schroederSpatialEpochTransaction.js', transactionUrl],
        [transactionUrl, 'sphAerosolSpatialBinding.js', bindingUrl],
        [successorUrl, 'schroederSpatialEpochTransaction.js', transactionUrl],
        [successorUrl, 'sphAerosolSpatialBinding.js', bindingUrl],
        [successorUrl, 'sphAerosolParcelGpu.js', ownerUrl],
        [bindingUrl, 'sphAerosolParcelGpu.js', ownerUrl],
        [bindingUrl, 'schroederSpatialSuccessorSourceFamily.js', successorUrl],
        [spatialUrl, 'sphGpuDeviceIdentity.js', identityUrl],
        [summaryUrl, 'sphMlsMpmPostMechanicsClosure.js', closureUrl],
        [summaryUrl, 'sphAerosolParcelGpu.js', ownerUrl],
        [opticsUrl, 'sphAerosolParcelGpu.js', ownerUrl],
        [opticsUrl, 'sphGpuDeviceIdentity.js', identityUrl]
      ]) {
        await sameDependency(parent, file, expected);
      }

      const [hierarchy, closureModule, transactions, spatial, successor,
        owner, binding, identity, summary, abi, optics, opticalClosure] = await Promise.all([
        import(hierarchyUrl),
        import(closureUrl),
        import(transactionUrl),
        import(spatialUrl),
        import(successorUrl),
        import(ownerUrl),
        import(bindingUrl),
        import(identityUrl),
        import(summaryUrl),
        import('/ulg-gpu-abi/src/index.js'),
        import(opticsUrl),
        import(opticalClosureUrl)
      ]);

      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance'
      });
      if (!adapter) throw new Error('native WebGPU adapter unavailable');
      const device = await adapter.requestDevice({
        requiredLimits: {
          maxStorageBuffersPerShaderStage: 8,
          maxBufferSize: adapter.limits.maxBufferSize,
          maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
        }
      });
      const uncapturedErrors = [];
      device.addEventListener('uncapturederror', (event) => {
        uncapturedErrors.push(event.error.message);
      });
      device.pushErrorScope('validation');
      device.pushErrorScope('internal');
      device.pushErrorScope('out-of-memory');

      const count = 8;
      const lineageCapacity = 2;
      const grid = Object.freeze({
        selectedLevel: 0,
        gridDims: Object.freeze([9, 9, 9]),
        gridNodeCount: 729,
        gridShift: 2,
        gridSpacingM: 1
      });
      const phaseCarrierPlan = Object.freeze({
        schema: 'peercompute.ulg.sph-phase-carrier-plan.v2',
        status: 'phase-lane-capacity-ready',
        lineageCapacity,
        primaryCapacity: lineageCapacity,
        phaseLaneCount: 4,
        phaseLaneStride: lineageCapacity,
        companionStart: lineageCapacity,
        companionCapacity: 6,
        particleCapacity: count,
        stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex',
        phaseCompanionLanesRequired: true,
        reason: 'native explicit already-activated four-lane condensate fixture'
      });
      const thermalMaterialTable = Object.freeze({
        schema: abi.ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
        status: 'closure-derived-thermal-table-ready',
        materialCount: 1,
        segmentCount: 2,
        records: new Float32Array([9, 0, 2, 1, 0, 1, 100, 0.001]),
        segments: new Float32Array([
          9, 1, 2, 2, -10, 10, 300, 400, 1000, 1000, 1, 0,
          9, 2, 2, 3, 10, 30, 400, 400, 1000, 1, 1, 0
        ])
      });
      const mechanicsMaterialTable = Object.freeze({
        schema: 'peercompute.ulg.mls-mpm-mechanics-material-table.v0',
        status: 'mechanics-material-table-ready',
        phaseRecordCount: 2,
        recordStrideFloats: 12,
        records: new Float32Array([
          9, 2, 1000, 1, 0, 0, 1, 1, 0, 1, 0, 0,
          9, 3, 1, 1, 0, 0, 1, 2, 0, 1, 0, 0
        ])
      });
      const declarations = Object.freeze([Object.freeze({
        lineageIndex: 0,
        parcelId: 100n,
        nucleusPopulationId: 200n,
        physicalMultiplicity: (1n << 40n) + 7n
      })]);
      const provenance = Object.freeze({
        kind: 'already-activated-condensate-population',
        reference: 'native manufactured declared nuclei; no nucleation or reaction-birth claim'
      });

      const opticalThermalTable = Object.freeze({
        ...thermalMaterialTable,
        materialCount: 2,
        segmentCount: 4,
        records: new Float32Array([
          ...thermalMaterialTable.records,
          11, 2, 2, 1, 0, 1, 100, 0.001
        ]),
        segments: new Float32Array([
          ...thermalMaterialTable.segments,
          11, 1, 2, 2, -10, 10, 300, 400, 1000, 1000, 1, 0,
          11, 2, 2, 3, 10, 30, 400, 400, 1000, 1, 1, 0
        ])
      });
      const opticalMechanicsTable = Object.freeze({
        ...mechanicsMaterialTable,
        phaseRecordCount: 4,
        records: new Float32Array([
          ...mechanicsMaterialTable.records,
          11, 2, 1000, 1, 0, 0, 1, 1, 0, 1, 0, 0,
          11, 3, 1, 1, 0, 0, 1, 2, 0, 1, 0, 0
        ])
      });
      const opticalClosureTable = opticalClosure
        .buildSphDispersedMediumOpticalClosureTable([9, 11].map((materialId) => ({
          dispersedMaterialId: materialId,
          vaporPhaseId: 3,
          condensedPhaseId: 2,
          opticalStateId: materialId + 100,
          morphologyModelId:
            abi.SPH_DISPERSED_MEDIUM_OPTICAL_MORPHOLOGY_MODEL.monodisperseRadius,
          condensedDensityKgPerM3: 1000,
          scatteringEfficiencyQsca: 2,
          absorptionEfficiencyQabs: 0.25,
          asymmetryFactorG: 0.5,
          effectiveRadiusM: 1e-6
        })));

      const initial = () => {
        const state = new Float32Array(count * 8);
        const thermo = new Float32Array(count * 12);
        const mechanics = new Float32Array(count * 32);
        const body = (
          index,
          mass,
          position,
          velocity,
          phaseId,
          energy,
          density,
          eos
        ) => {
          state.set([...position, mass, ...velocity, energy], index * 8);
          thermo.set([
            9, phaseId, 400, density, 0,
            phaseId === 2 ? 1 : 0,
            phaseId === 3 ? 1 : 0,
            0, 0.2, mass * 10, 1, 0.1
          ], index * 12);
          mechanics[index * 32] = 1;
          mechanics[index * 32 + 4] = 1;
          mechanics[index * 32 + 8] = 1;
          mechanics.set([
            1, mass / density, 0, 1, 1, 0, 0, 1,
            eos, 1, 100, 0, 0, mass
          ], index * 32 + 18);
        };
        body(2, 2, [0.5, 0.5, 0.5], [0, 0, 0], 2, 10, 1000, 1);
        body(4, 4, [2, 2, 2], [2, -1, 0], 3, 30, 1, 2);
        body(5, 4, [3, 2, 2], [-1, 0, 0], 3, 30, 1, 2);
        return { state, thermo, mechanics };
      };
      const mixed = () => {
        const data = initial();
        const pressure = 100;
        const liquidFraction = 0.25;
        const temperature = 1 / (1 / 400 - 0.001 * Math.log(pressure / 100));
        const liquidU = -10 + 0.2 * (temperature - 300);
        const gasU = liquidU + 20;
        for (const index of [4, 5]) {
          data.state[index * 8 + 7] = liquidFraction * liquidU
            + (1 - liquidFraction) * gasU;
          data.thermo.set([
            9, 3, temperature, 1, 0,
            liquidFraction, 1 - liquidFraction, 0
          ], index * 12);
          data.mechanics[index * 32 + 28] = pressure;
        }
        return data;
      };
      const opticalSnapshot = ({ bulkMaterialId, bulkLiquidMassKg, donorLiquidMassKg }) => {
        const data = initial();
        // Lineage one is empty. The old two-lineage conservation fixture above
        // remains unchanged, and every optical fixture independently totals14kg.
        data.state.fill(0, 5 * 8, 6 * 8);
        data.thermo.fill(0, 5 * 12, 6 * 12);
        data.mechanics.fill(0, 5 * 32, 6 * 32);
        for (const [index, mass, liquidMass, materialId] of [
          [2, 10, bulkLiquidMassKg, bulkMaterialId],
          [4, 4, donorLiquidMassKg, 9]
        ]) {
          const liquidFraction = liquidMass / mass;
          const gasFraction = 1 - liquidFraction;
          data.state[index * 8 + 3] = mass;
          data.state[index * 8 + 7] = liquidFraction * 10 + gasFraction * 30;
          data.thermo[index * 12] = materialId;
          data.thermo.set([0, liquidFraction, gasFraction, 0], index * 12 + 4);
          data.thermo[index * 12 + 9] = mass * 10;
          data.mechanics[index * 32 + 19] = mass / (index === 2 ? 1000 : 1);
          data.mechanics[index * 32 + 28] = 100;
          data.mechanics[index * 32 + 31] = mass;
        }
        return data;
      };
      const jsonSafe = (value) => JSON.parse(JSON.stringify(
        value,
        (_key, entry) => typeof entry === 'bigint' ? entry.toString() : entry
      ));
      const errorText = (error) => error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);

      let serial = 0;
      const makeFixture = (name, opticalCase = null) => {
        const ordinal = ++serial;
        const label = `native-aerosol-outer-${name}-${ordinal}`;
        const resources = [];
        const makeBuffer = (suffix, values) => {
          const buffer = identity.tagWebGpuBufferDevice(device.createBuffer({
            label: `${label}-${suffix}`,
            size: Math.max(16, values.byteLength),
            usage: GPUBufferUsage.STORAGE
              | GPUBufferUsage.COPY_SRC
              | GPUBufferUsage.COPY_DST
          }), device);
          device.queue.writeBuffer(buffer, 0, values);
          resources.push(buffer);
          return buffer;
        };
        const epoch = {
          storageGeneration: 10 + ordinal,
          physicsTick: 20 + ordinal,
          physicsSubstep: 0,
          positionEpoch: 30 + ordinal,
          topologyEpoch: 40 + ordinal,
          chartEpoch: 1,
          levelEpoch: 50 + ordinal,
          supportEpoch: 60 + ordinal
        };
        const prior = opticalCase ? opticalSnapshot({
          bulkMaterialId: opticalCase.bulkMaterialId,
          bulkLiquidMassKg: 10,
          donorLiquidMassKg: 0
        }) : initial();
        const current = opticalCase ? opticalSnapshot({
          bulkMaterialId: opticalCase.bulkMaterialId,
          bulkLiquidMassKg: opticalCase.preBulkLiquidMassKg,
          donorLiquidMassKg: opticalCase.preDonorLiquidMassKg
        }) : mixed();
        const postReaction = opticalCase ? opticalSnapshot({
          bulkMaterialId: opticalCase.bulkMaterialId,
          bulkLiquidMassKg: 10,
          donorLiquidMassKg: 1
        }) : null;
        const priorStateBuffer = makeBuffer('prior-state', prior.state);
        const priorThermoBuffer = makeBuffer('prior-thermo', prior.thermo);
        const priorMechanicsBuffer = makeBuffer('prior-mechanics', prior.mechanics);
        const currentStateBuffer = makeBuffer('post-thermal-state', current.state);
        const currentThermoBuffer = makeBuffer('post-thermal-thermo', current.thermo);
        const currentMechanicsBuffer = makeBuffer('post-mechanics', current.mechanics);
        const postReactionStateBuffer = postReaction
          ? makeBuffer('manufactured-post-reaction-state', postReaction.state) : null;
        const postReactionThermoBuffer = postReaction
          ? makeBuffer('manufactured-post-reaction-thermo', postReaction.thermo) : null;
        const postReactionMechanicsBuffer = postReaction
          ? makeBuffer('manufactured-post-reaction-mechanics', postReaction.mechanics) : null;
        const identityValues = Uint32Array.from(
          { length: count },
          (_unused, index) => index + 1
        );
        const identityBuffer = makeBuffer('identities', identityValues);
        const assignmentValues = new Float32Array(count * 16);
        for (let index = 0; index < count; index += 1) {
          const mass = prior.state[index * 8 + 3];
          const density = prior.thermo[index * 12 + 3] || 1;
          const volume = mass / density;
          assignmentValues.set([
            0, 1, 1, volume, volume, volume, mass, density,
            prior.thermo[index * 12 + 1], opticalCase ? prior.thermo[index * 12] : 9,
            mass > 0 ? 1 : 0, 0,
            ...prior.state.slice(index * 8, index * 8 + 3), 0
          ], index * 16);
        }
        const assignmentBuffer = makeBuffer('lookup-assignment', assignmentValues);
        const sourceFamily = owner.createSphAerosolParcelFamilyWebGpu({
          device,
          capacity: 2,
          provenance: {
            kind: 'initial-conditions',
            reference: `${label}: explicit empty initial aerosol reservoir`
          }
        });
        const sphParticleUpload = {
          schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: 'webgpu-uploaded',
          particleCount: count,
          stateBuffer: priorStateBuffer,
          stateBufferByteLength: priorStateBuffer.size,
          stateStrideBytes: 32,
          thermoBuffer: priorThermoBuffer,
          thermoBufferByteLength: priorThermoBuffer.size,
          thermoStrideBytes: 48,
          identityBuffer,
          identityBufferByteLength: identityBuffer.size,
          identityStrideBytes: 4,
          identityRevision: `${label}: manufactured stable lineages`,
          phaseCarrierPlan,
          aerosolFamily: sourceFamily,
          ...epoch
        };
        const mlsMpmParticleUpload = {
          schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA,
          status: 'webgpu-uploaded',
          particleCount: count,
          mechanicsBuffer: priorMechanicsBuffer,
          mechanicsBufferByteLength: priorMechanicsBuffer.size,
          mechanicsStrideBytes: 128,
          ...epoch
        };
        const levelAssignment = {
          schema: abi.ULG_SCHROEDER_LEVEL_ASSIGNMENT_EXECUTION_SCHEMA,
          assignmentSchema: 'peercompute.ulg.schroeder-level-assignment.v0',
          status: 'schroeder-level-assignment-submitted',
          bufferFamilyGenerationStatus:
            'schroeder-particle-buffer-family-generation-ready',
          particleCount: count,
          assignmentStrideFloats: 16,
          assignmentStrideBytes: 64,
          assignmentBuffer,
          assignmentBufferByteLength: assignmentBuffer.size,
          assignments: assignmentValues,
          sourceStateBuffer: priorStateBuffer,
          sourceStateBufferBorrowed: true,
          sourceStateBufferByteLength: priorStateBuffer.size,
          sourceThermoBuffer: priorThermoBuffer,
          sourceThermoBufferBorrowed: true,
          sourceThermoBufferByteLength: priorThermoBuffer.size,
          sourceIdentityBuffer: identityBuffer,
          sourceIdentityBufferBorrowed: true,
          sourceIdentityBufferByteLength: identityBuffer.size,
          sourceMechanicsBuffer: priorMechanicsBuffer,
          sourceMechanicsBufferBorrowed: true,
          sourceMechanicsBufferByteLength: priorMechanicsBuffer.size,
          minLevel: 0,
          maxLevel: 0,
          chartId: 0,
          baseGridSpacingM: 1,
          ...epoch
        };
        const generation = spatial.runSchroederSpatialEpochGenerationWebGpu({
          device,
          levelAssignment,
          particleCount: count,
          particleIdentityBuffer: identityBuffer,
          particleIdentityStrideWords: 1,
          selectedLevel: 0,
          mechanicsGrid: grid,
          exactNearCellTreeEnabled: false
        });
        if (!generation.ready) {
          throw new Error(
            `${name}: actual source SS generation rejected: ${generation.reason || generation.status}`
          );
        }
        const transaction = transactions.createSchroederSpatialEpochTransaction({
          device,
          generation,
          sphParticleUpload,
          mlsMpmParticleUpload,
          requiredReaderIds: []
        });
        const packedSph = {
          schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount: count,
          state: current.state,
          thermo: current.thermo,
          phaseCarrierPlan
        };
        const packedMls = {
          schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA,
          particleCount: count,
          mechanics: current.mechanics
        };
        return {
          name,
          resources,
          makeBuffer,
          prior,
          current,
          opticalCase,
          postReaction,
          postReactionStateBuffer,
          postReactionThermoBuffer,
          postReactionMechanicsBuffer,
          identityValues,
          sourceFamily,
          sphParticleUpload,
          mlsMpmParticleUpload,
          levelAssignment,
          generation,
          transaction,
          packedSph,
          packedMls,
          currentStateBuffer,
          currentThermoBuffer,
          currentMechanicsBuffer,
          identityBuffer,
          closure: null,
          transition: null,
          nextParticleUploads: null,
          claim: null,
          plan: null,
          publication: null,
          successorLease: null,
          successorLeaseReleased: false,
          successorRetirement: null,
          nextGeneration: null,
          nextTransaction: null,
          nextAerosolRead: null,
          closureRetired: false,
          opticalStages: [],
          finalBuffers: []
        };
      };

      const readWords = async (buffer, bytes = buffer.size) => {
        const copy = device.createBuffer({
          size: bytes,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });
        try {
          const encoder = device.createCommandEncoder();
          encoder.copyBufferToBuffer(buffer, 0, copy, 0, bytes);
          device.queue.submit([encoder.finish()]);
          await copy.mapAsync(GPUMapMode.READ);
          const words = Array.from(new Uint32Array(copy.getMappedRange()));
          copy.unmap();
          return words;
        } finally {
          copy.destroy();
        }
      };
      const unchanged = (actual, expected) => actual.length === expected.length
        && actual.every((word, index) => word === expected[index]);
      const sourceUnchanged = async (fixture) => {
        const checks = [
          [fixture.sphParticleUpload.stateBuffer, fixture.prior.state],
          [fixture.sphParticleUpload.thermoBuffer, fixture.prior.thermo],
          [fixture.mlsMpmParticleUpload.mechanicsBuffer, fixture.prior.mechanics],
          [fixture.identityBuffer, fixture.identityValues],
          [fixture.currentStateBuffer, fixture.current.state],
          [fixture.currentThermoBuffer, fixture.current.thermo],
          [fixture.currentMechanicsBuffer, fixture.current.mechanics]
        ];
        if (fixture.postReaction) checks.push(
          [fixture.postReactionStateBuffer, fixture.postReaction.state],
          [fixture.postReactionThermoBuffer, fixture.postReaction.thermo],
          [fixture.postReactionMechanicsBuffer, fixture.postReaction.mechanics]
        );
        const results = await Promise.all(checks.map(async ([buffer, values]) => (
          unchanged(
            await readWords(buffer, values.byteLength),
            Array.from(new Uint32Array(
              values.buffer,
              values.byteOffset,
              values.byteLength / Uint32Array.BYTES_PER_ELEMENT
            ))
          )
        )));
        return results.every(Boolean);
      };

      const runClosure = async (fixture) => {
        fixture.closure = await closureModule.runMlsMpmPostMechanicsClosureWebGpu({
          device,
          sphParticleState: fixture.packedSph,
          mlsMpmParticleState: fixture.packedMls,
          sphParticleUpload: fixture.sphParticleUpload,
          mlsMpmParticleUpload: fixture.mlsMpmParticleUpload,
          postMechanicsParticleBuffers: {
            stateBuffer: fixture.currentStateBuffer,
            mechanicsBuffer: fixture.currentMechanicsBuffer
          },
          postMechanicsBackend: 'webgpu',
          thermalMaterialTable: fixture.opticalCase ? opticalThermalTable : thermalMaterialTable,
          thermalStepRunner: async () => ({
            backend: 'webgpu',
            status: 'native-manufactured-post-thermal-input',
            stateBuffer: fixture.currentStateBuffer,
            thermoBuffer: fixture.currentThermoBuffer,
            stateBufferByteLength: fixture.currentStateBuffer.size,
            thermoBufferByteLength: fixture.currentThermoBuffer.size,
            ownsStateBuffer: false,
            ownsThermoBuffer: false,
            fullParticleReadbackPerformed: false,
            fullParticleReadbackFree: true,
            mapAsyncCount: 0,
            readbackBytes: 0,
            scientificValidation: false,
            fullPhysicsValidation: false
          }),
          reactionTable: fixture.opticalCase ? { reactionCount: 1 } : null,
          // No discovery/reaction law is under test. Supply explicit candidates
          // while retaining the real extraction, transfer, refresh and commit.
          spatialReactionDiscoveryProposalRunner: null,
          reactionStepRunner: fixture.opticalCase ? async () => ({
            backend: 'webgpu',
            status: 'native-manufactured-reaction-candidate-not-chemistry-proof',
            stateBuffer: fixture.postReactionStateBuffer,
            thermoBuffer: fixture.postReactionThermoBuffer,
            mechanicsBuffer: fixture.postReactionMechanicsBuffer,
            stateBufferByteLength: fixture.postReactionStateBuffer.size,
            thermoBufferByteLength: fixture.postReactionThermoBuffer.size,
            mechanicsBufferByteLength: fixture.postReactionMechanicsBuffer.size,
            ownsStateBuffer: false,
            ownsThermoBuffer: false,
            ownsMechanicsBuffer: false,
            fullParticleReadbackPerformed: false,
            fullParticleReadbackFree: true,
            mapAsyncCount: 0,
            readbackBytes: 0,
            scientificValidation: false,
            fullPhysicsValidation: false
          }) : null,
          mechanicsMaterialTable: fixture.opticalCase ? opticalMechanicsTable : mechanicsMaterialTable,
          condensateExtraction: { declarations, provenance },
          phaseCarrierTransferOptions: { absolutePressureAuthority: true },
          boxDimsM: [4, 4, 4],
          dtSeconds: 0.001,
          preferWebGpu: true,
          readbackMode: 'full-parity-readback',
          schroederSpatialEpochGeneration: fixture.generation,
          schroederSpatialEpochTransaction: fixture.transaction
        });
        fixture.transition = fixture.closure.aerosolCondensateTransition;
        fixture.nextParticleUploads = {
          sphParticleUpload: {
            ...fixture.sphParticleUpload,
            stateBuffer: fixture.closure.continuation.stateBuffer,
            stateBufferByteLength: fixture.closure.continuation.stateBuffer.size,
            thermoBuffer: fixture.closure.continuation.thermoBuffer,
            thermoBufferByteLength: fixture.closure.continuation.thermoBuffer.size
          },
          mlsMpmParticleUpload: {
            ...fixture.mlsMpmParticleUpload,
            mechanicsBuffer: fixture.closure.continuation.mechanicsBuffer,
            mechanicsBufferByteLength: fixture.closure.continuation.mechanicsBuffer.size
          }
        };
        fixture.claim = closureModule.claimMlsMpmPostMechanicsContinuation(
          fixture.closure,
          { nextParticleUploads: fixture.nextParticleUploads }
        );
        fixture.finalBuffers = [
          fixture.closure.continuation.stateBuffer,
          fixture.closure.continuation.thermoBuffer,
          fixture.closure.continuation.mechanicsBuffer
        ];
        return fixture.closure;
      };
      const classifier = async (fixture, {
        sphParticleUpload,
        mlsMpmParticleUpload
      }) => hierarchy.runSchroederLevelAssignmentWebGpu({
        device,
        sphParticleState: fixture.packedSph,
        mlsMpmParticleState: fixture.packedMls,
        sphParticleUpload,
        mlsMpmParticleUpload,
        baseGridSpacingM: 1,
        minLevel: 0,
        maxLevel: 0,
        chartId: 0,
        retainAssignmentBuffer: true,
        readbackMode: 'no-full-readback'
      });
      const prepare = async (fixture, runner = null) => {
        fixture.plan = await successor
          .prepareSchroederSpatialSuccessorSourceFamilyPublication({
            transaction: fixture.transaction,
            generation: fixture.generation,
            lookupLevelAssignment: fixture.levelAssignment,
            nextParticleUploads: fixture.nextParticleUploads,
            successorLevelAssignmentRunner: runner
              || ((options) => classifier(fixture, options)),
            conservativeTopologyAdvance: true,
            forcePositionAdvance: true
          });
        return fixture.plan;
      };
      const commit = (fixture) => {
        transactions.sealSchroederSpatialEpochTransactionReaders(
          fixture.transaction
        );
        transactions.sealSchroederSpatialEpochTransactionProposals(
          fixture.transaction
        );
        fixture.commit = transactions.commitSchroederSpatialEpochTransaction(
          fixture.transaction,
          { nextParticleUploads: fixture.nextParticleUploads }
        );
        return fixture.commit;
      };
      const retryExtraction = async (fixture) => {
        const candidate = await owner.runSphAerosolCondensateExtractionWebGpu({
          device,
          sourceFamily: fixture.sourceFamily,
          expectedGeneration: fixture.sourceFamily.generation,
          sourceLineage: {
            transaction: fixture.transaction,
            generation: fixture.generation,
            sphParticleUpload: fixture.sphParticleUpload,
            mlsMpmParticleUpload: fixture.mlsMpmParticleUpload
          },
          sourceStateBuffer: fixture.currentStateBuffer,
          sourceThermoBuffer: fixture.currentThermoBuffer,
          sourceMechanicsBuffer: fixture.currentMechanicsBuffer,
          thermalMaterialTable,
          mechanicsMaterialTable,
          declarations,
          provenance,
          absolutePressureAuthority: true
        });
        const status = candidate.status;
        const discarded = owner.discardSphAerosolCondensateExtraction(candidate);
        await device.queue.onSubmittedWorkDone();
        return { status, discarded };
      };
      const releaseGeneration = async (generation) => {
        if (!generation) return;
        if (generation.releaseScheduled !== true) {
          spatial.releaseSchroederSpatialEpochGenerationAfterQueue(
            generation,
            device
          );
        }
        await generation.releasePromise;
      };
      const cleanupFixture = async (fixture, { published = false } = {}) => {
        const cleanupErrors = [];
        const attempt = async (operation) => {
          try {
            await operation();
          } catch (error) {
            cleanupErrors.push(errorText(error));
          }
        };
        if (fixture.opticalStages.length > 0) {
          await attempt(() => device.queue.onSubmittedWorkDone());
          for (const stage of fixture.opticalStages) {
            await attempt(() => stage.cleanupConstructionFailure());
          }
        }
        if (fixture.nextAerosolRead) {
          await attempt(() => binding.releaseSphAerosolSpatialGenerationRead(
            fixture.nextAerosolRead
          ));
          fixture.nextAerosolRead = null;
        }
        if (fixture.nextTransaction) {
          await attempt(() => transactions.abortSchroederSpatialEpochTransaction(
            fixture.nextTransaction,
            'native paired handover complete'
          ));
          fixture.nextTransaction = null;
        }
        if (fixture.nextGeneration) {
          await attempt(() => releaseGeneration(fixture.nextGeneration));
          fixture.nextGeneration = null;
        }
        if (fixture.successorLease && !fixture.successorLeaseReleased) {
          await attempt(async () => {
            await successor.releaseSchroederSpatialSuccessorSourceFamilyLeaseAfter(
              fixture.publication.sourceFamily,
              fixture.successorLease,
              { device, after: device.queue.onSubmittedWorkDone() }
            );
            fixture.successorLeaseReleased = true;
          });
        }
        if (fixture.successorRetirement) {
          await attempt(() => fixture.successorRetirement);
        } else if (fixture.publication?.published) {
          await attempt(async () => {
            fixture.successorRetirement = successor
              .retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
                fixture.publication.sourceFamily,
                {
                  device,
                  after: device.queue.onSubmittedWorkDone(),
                  reason: 'native outer-publication proof complete'
                }
              );
            await fixture.successorRetirement;
          });
        }
        if (fixture.plan) {
          await attempt(() => successor
            .abandonPreparedSchroederSpatialSuccessorSourceFamilyPublication(
              fixture.plan,
              { reason: 'native fixture cleanup' }
            ));
        }
        if (fixture.closure) {
          await attempt(() => closureModule.abandonMlsMpmPostMechanicsCondensate(
            fixture.closure
          ));
          if (!fixture.closureRetired) {
            await attempt(async () => {
              await closureModule.retireMlsMpmPostMechanicsClosureOutputsAfter(
                fixture.closure,
                {
                  after: device.queue.onSubmittedWorkDone().then(() => true),
                  abandon: !published
                }
              );
              fixture.closureRetired = true;
            });
          }
        }
        await attempt(() => transactions.abortSchroederSpatialEpochTransaction(
          fixture.transaction,
          'native source fixture complete'
        ));
        await attempt(() => releaseGeneration(fixture.generation));
        await attempt(() => owner.releaseSphAerosolParcelFamily(
          fixture.sourceFamily
        ));
        await attempt(() => device.queue.onSubmittedWorkDone());
        if (published) {
          for (const buffer of new Set(fixture.finalBuffers)) {
            await attempt(() => buffer.destroy());
          }
        }
        for (const buffer of fixture.resources) {
          await attempt(() => buffer.destroy());
        }
        return cleanupErrors;
      };

      const runPositive = async () => {
        const fixture = makeFixture('positive');
        const result = {
          name: 'positive-paired-outer-publication',
          expectedBudget,
          fixtureScope: {
            thermalInput: 'explicit manufactured post-thermal mixed-phase triple',
            reaction: 'absent-no-reaction-birth-or-chemistry-claim',
            energy: 'stored-internal-plus-translational-kinetic-only',
            validation: 'reduced-regime-conservation-not-full-physics-or-optics'
          }
        };
        try {
          await runClosure(fixture);
          const receipt = fixture.closure.phaseCarrierTransferFamilyReceipt;
          const prePublicationAcquireRejected = (() => {
            try {
              owner.acquireSphAerosolParcelRead({
                family: fixture.transition.aerosolFamily,
                device,
                expectedGeneration: fixture.transition.aerosolFamily.generation
              });
              return false;
            } catch {
              return true;
            }
          })();
          result.closure = {
            status: fixture.closure.status,
            claimStatus: fixture.claim.status,
            actualPhaseTransfer: fixture.closure.phaseCarrierTransferStep?.backend
              === 'webgpu',
            actualMechanicsRefresh: fixture.closure.mechanicsRefreshStep?.backend
              === 'webgpu',
            mechanicsRefreshSelected:
              fixture.closure.continuation.mechanicsBuffer
                === fixture.closure.mechanicsRefreshStep?.mechanicsBuffer,
            finalMechanicsDistinctFromPreTransfer:
              fixture.closure.continuation.mechanicsBuffer
                !== receipt.preTransferMechanicsBuffer,
            postReactionIsManufacturedThermal:
              receipt.postReactionStateBuffer === fixture.currentStateBuffer
              && receipt.postReactionThermoBuffer === fixture.currentThermoBuffer
              && receipt.postReactionMechanicsBuffer === fixture.currentMechanicsBuffer,
            preTransferIsPendingResidual:
              receipt.preTransferStateBuffer === fixture.transition.stateBuffer
              && receipt.preTransferThermoBuffer === fixture.transition.thermoBuffer
              && receipt.preTransferMechanicsBuffer === fixture.transition.mechanicsBuffer,
            postReactionDistinctFromPreTransfer:
              receipt.postReactionStateBuffer !== receipt.preTransferStateBuffer
              && receipt.postReactionThermoBuffer !== receipt.preTransferThermoBuffer
              && receipt.postReactionMechanicsBuffer
                !== receipt.preTransferMechanicsBuffer,
            aerosolOpticalAuthority: receipt.aerosolOpticalAuthority,
            transitionOpticalAuthority: fixture.transition.opticalAuthority,
            reactionParticleMutationApplied: receipt.reactionParticleMutationApplied
          };
          result.prospective = {
            familyAvailableBeforePrepare: owner.sphAerosolParcelFamilyMatchesDevice(
              fixture.transition.aerosolFamily,
              device
            ),
            acquireRejectedBeforePrepare: prePublicationAcquireRejected
          };

          let classifierCalls = 0;
          await prepare(fixture, async (options) => {
            classifierCalls += 1;
            return classifier(fixture, options);
          });
          commit(fixture);
          result.prospective.familyAvailableAfterCommit =
            owner.sphAerosolParcelFamilyMatchesDevice(
              fixture.transition.aerosolFamily,
              device
            );
          fixture.publication = successor
            .publishPreparedSchroederSpatialSuccessorSourceFamily(
              fixture.plan,
              { commitReceipt: fixture.commit }
            );
          result.publication = {
            planStatus: fixture.plan.status,
            commitStatus: fixture.commit.status,
            status: fixture.publication.status,
            published: fixture.publication.published,
            receiptValid: successor
              .validateSchroederSpatialSuccessorPublicationReceipt(
                fixture.publication,
                {
                  plan: fixture.plan,
                  commitReceipt: fixture.commit,
                  nextParticleUploads: fixture.nextParticleUploads
                }
              ),
            classifierCalls,
            familyAvailableAfterPublication:
              owner.sphAerosolParcelFamilyMatchesDevice(
                fixture.transition.aerosolFamily,
                device
              )
          };

          const gridBuffer = fixture.makeBuffer(
            'summary-grid',
            new Float32Array(8)
          );
          const budget = await summary.runMlsMpmResidentSummaryWebGpu({
            device,
            sphParticleState: fixture.packedSph,
            mlsMpmParticleState: fixture.packedMls,
            sphParticleUpload: {
              ...fixture.sphParticleUpload,
              stateBuffer: fixture.currentStateBuffer,
              stateBufferByteLength: fixture.currentStateBuffer.size,
              thermoBuffer: fixture.currentThermoBuffer,
              thermoBufferByteLength: fixture.currentThermoBuffer.size
            },
            mlsMpmParticleUpload: {
              ...fixture.mlsMpmParticleUpload,
              mechanicsBuffer: fixture.currentMechanicsBuffer,
              mechanicsBufferByteLength: fixture.currentMechanicsBuffer.size
            },
            gridUpdate: {
              gridNodeCount: 1,
              gpuResult: { updatedGridBuffer: gridBuffer }
            },
            g2pReconstruction: {
              stateBuffer: fixture.currentStateBuffer,
              mechanicsBuffer: fixture.currentMechanicsBuffer
            },
            thermalStep: fixture.closure.thermalStep,
            reactionStep: fixture.closure.reactionStep,
            mechanicsRefreshStep: fixture.closure.mechanicsRefreshStep,
            phaseCarrierTransferStep: fixture.closure.phaseCarrierTransferStep,
            sourceAerosolFamily: fixture.sourceFamily,
            terminalAerosolFamily: fixture.transition.aerosolFamily,
            compactSummaryReadbackClassification: 'final-diagnostic'
          });
          result.budget = jsonSafe(budget.combinedInventory);

          const publishedFamily = fixture.publication.sourceFamily;
          fixture.successorLease = successor
            .acquireSchroederSpatialSuccessorSourceFamilyLease(
              publishedFamily,
              { device, consumerStage: 'native-next-spatial-generation' }
            );
          fixture.successorRetirement = successor
            .retireSchroederSpatialSuccessorSourceFamilyAfterLeases(
              publishedFamily,
              {
                device,
                after: device.queue.onSubmittedWorkDone(),
                reason: 'native next generation begins'
              }
            );
          const admitted = successor.resolveSchroederSpatialSuccessorSourceFamily(
            publishedFamily,
            {
              device,
              particleCount: count,
              sphParticleUpload: fixture.nextParticleUploads.sphParticleUpload,
              mlsMpmParticleUpload:
                fixture.nextParticleUploads.mlsMpmParticleUpload,
              consumerLease: fixture.successorLease
            }
          );
          fixture.nextGeneration = spatial.runSchroederSpatialEpochGenerationWebGpu({
            device,
            levelAssignment: admitted.levelAssignment,
            particleCount: count,
            particleIdentityBuffer: fixture.identityBuffer,
            particleIdentityStrideWords: 1,
            selectedLevel: 0,
            mechanicsGrid: grid,
            exactNearCellTreeEnabled: false
          });
          let retirementRequiresLease = false;
          try {
            transactions.createSchroederSpatialEpochTransaction({
              device,
              generation: fixture.nextGeneration,
              sphParticleUpload: fixture.nextParticleUploads.sphParticleUpload,
              mlsMpmParticleUpload:
                fixture.nextParticleUploads.mlsMpmParticleUpload,
              requiredReaderIds: []
            });
          } catch {
            retirementRequiresLease = true;
          }
          fixture.nextTransaction = transactions
            .createSchroederSpatialEpochTransaction({
              device,
              generation: fixture.nextGeneration,
              sphParticleUpload: fixture.nextParticleUploads.sphParticleUpload,
              mlsMpmParticleUpload:
                fixture.nextParticleUploads.mlsMpmParticleUpload,
              aerosolSourceFamilyConsumerLease: fixture.successorLease,
              requiredReaderIds: []
            });
          fixture.nextAerosolRead = binding.acquireSphAerosolSpatialGenerationRead({
            device,
            generation: fixture.nextGeneration
          });
          result.handover = {
            successorResolved: admitted.admitted,
            actualNextGenerationReady: fixture.nextGeneration.ready,
            exactLeaseRequiredAfterRetirementRequest: retirementRequiresLease,
            exactLeaseAccepted: fixture.nextTransaction.state === 'canonical-built',
            aerosolFamilyPreserved:
              fixture.nextAerosolRead?.family === fixture.transition.aerosolFamily,
            levelAssignmentMode:
              admitted.levelAssignment?.levelClassificationMode ?? null
          };
          result.sourceByteUnchanged = await sourceUnchanged(fixture);
          result.success = true;
        } catch (error) {
          result.success = false;
          result.reason = errorText(error);
        } finally {
          result.cleanupErrors = await cleanupFixture(fixture, {
            published: fixture.publication?.published === true
          });
          if (fixture.successorRetirement) {
            try {
              const retirement = await fixture.successorRetirement;
              result.handover ??= {};
              result.handover.retirementSettled = retirement.settled;
              result.handover.retirementStatus = retirement.status;
            } catch (error) {
              result.cleanupErrors.push(errorText(error));
            }
          }
        }
        return result;
      };

      const runClassifierRejection = async () => {
        const fixture = makeFixture('classifier-rejection');
        const result = { name: 'actual-classifier-result-rejected-before-commit' };
        try {
          await runClosure(fixture);
          let actualClassifierRan = false;
          try {
            await prepare(fixture, async (options) => {
              const output = await classifier(fixture, options);
              actualClassifierRan = true;
              return {
                ...output,
                kernelScope: 'native-intentionally-invalid-classifier-provenance',
                destroyAssignmentBuffer: () => output.destroyAssignmentBuffer?.()
              };
            });
          } catch (error) {
            result.rejectionReason = errorText(error);
          }
          result.actualClassifierRan = actualClassifierRan;
          result.transactionState = fixture.transaction.state;
          result.transitionDiscarded =
            closureModule.abandonMlsMpmPostMechanicsCondensate(fixture.closure);
          await device.queue.onSubmittedWorkDone();
          result.prospectiveFamilyAvailable =
            owner.sphAerosolParcelFamilyMatchesDevice(
              fixture.transition.aerosolFamily,
              device
            );
          result.retry = await retryExtraction(fixture);
          result.sourceByteUnchanged = await sourceUnchanged(fixture);
          result.success = Boolean(
            result.rejectionReason
            && actualClassifierRan
            && result.transitionDiscarded
            && result.retry.discarded
          );
        } catch (error) {
          result.success = false;
          result.reason = errorText(error);
        } finally {
          result.cleanupErrors = await cleanupFixture(fixture);
        }
        return result;
      };

      const runPublicationRejection = async () => {
        const fixture = makeFixture('publication-rejection');
        const result = { name: 'post-commit-terminal-envelope-tamper-rejected' };
        try {
          await runClosure(fixture);
          await prepare(fixture);
          commit(fixture);
          const foreign = fixture.makeBuffer(
            'foreign-final-state',
            fixture.current.state
          );
          fixture.nextParticleUploads.sphParticleUpload.stateBuffer = foreign;
          fixture.nextParticleUploads.sphParticleUpload.stateBufferByteLength =
            foreign.size;
          const publication = successor
            .publishPreparedSchroederSpatialSuccessorSourceFamily(
              fixture.plan,
              { commitReceipt: fixture.commit }
            );
          result.publication = {
            status: publication.status,
            published: publication.published,
            reason: publication.reason
          };
          await device.queue.onSubmittedWorkDone();
          result.prospectiveFamilyAvailable =
            owner.sphAerosolParcelFamilyMatchesDevice(
              fixture.transition.aerosolFamily,
              device
            );
          result.retry = await retryExtraction(fixture);
          result.sourceByteUnchanged = await sourceUnchanged(fixture);
          result.success = publication.published === false
            && result.retry.discarded === true;
        } catch (error) {
          result.success = false;
          result.reason = errorText(error);
        } finally {
          result.cleanupErrors = await cleanupFixture(fixture);
        }
        return result;
      };

      const runOpticalExclusion = async (opticalCase) => {
        const fixture = makeFixture(opticalCase.name, opticalCase);
        const result = {
          name: `optical-${opticalCase.name}`,
          expected: opticalCase,
          fixtureScope: {
            thermalInput: 'manufactured-intermediate-snapshot',
            reaction: 'manufactured-candidate-not-reaction-chemistry-proof',
            priorOptics: 'manufactured-2kg-older-subset-with-independent-moments',
            energy: 'post-reaction-extraction-internal-plus-translational-only',
            validation: opticalCase.unsupportedMixedMaterial
              ? 'capture-route-selection-only-mixed-material-transfer-remains-rejected'
              : 'actual-extraction-phase-transfer-optical-producer-paired-publication'
          }
        };
        try {
          await runClosure(fixture);
          const receipt = fixture.closure.phaseCarrierTransferFamilyReceipt;
          const seedRows = optics.buildSphDispersedMediumOpticsProducerSeedRows({
            phaseCarrierPlan,
            lineageMaterialIds: new Float32Array([opticalCase.bulkMaterialId, 0]),
            opticalClosureTable
          }).rows;
          // rho=1000, r=1um, Qsca=2, Qabs=.25, g=.5 gives these extensive
          // moments for the explicit D=2kg subset. No producer observation or
          // CPU reference determines the expected mass or moments.
          seedRows.set([2, 3000, 375, 1500], 2 * 8 + 4);
          const seedBefore = Array.from(seedRows);
          const options = {
            device,
            phaseCarrierPlan: receipt.phaseCarrierPlan,
            particleLineage: receipt.particleLineage,
            preReactionStateBuffer: receipt.preReactionStateBuffer,
            preReactionThermoBuffer: receipt.preReactionThermoBuffer,
            postReactionStateBuffer: receipt.postReactionStateBuffer,
            postReactionThermoBuffer: receipt.postReactionThermoBuffer,
            aerosolCondensateTransition: receipt.aerosolCondensateTransition,
            preTransferStateBuffer: receipt.preTransferStateBuffer,
            preTransferThermoBuffer: receipt.preTransferThermoBuffer,
            postTransferStateBuffer: receipt.postTransferStateBuffer,
            postTransferThermoBuffer: receipt.postTransferThermoBuffer,
            seedOpticsRows: seedRows,
            opticalClosureTable,
            label: `native-donor-optical-exclusion-${opticalCase.name}`
          };
          const opticalInputBuffers = [receipt.preReactionStateBuffer,
            receipt.preReactionThermoBuffer, receipt.postReactionStateBuffer,
            receipt.postReactionThermoBuffer, receipt.preTransferStateBuffer,
            receipt.preTransferThermoBuffer, receipt.postTransferStateBuffer,
            receipt.postTransferThermoBuffer];
          const opticalInputWordsBefore = await Promise.all(opticalInputBuffers.map(
            (buffer) => readWords(buffer)
          ));
          const stage = optics.createSphDispersedMediumOpticsProducerWebGpuEncoderStage(options);
          fixture.opticalStages.push(stage);
          const rejection = (overrides) => {
            let unexpectedStage = null;
            try {
              unexpectedStage = optics
                .createSphDispersedMediumOpticsProducerWebGpuEncoderStage({
                  ...options, ...overrides
                });
              return null;
            } catch (error) {
              return errorText(error);
            } finally {
              unexpectedStage?.cleanupConstructionFailure();
            }
          };
          const foreignState = fixture.makeBuffer('equal-bytes-foreign-state', fixture.postReaction.state);
          const foreignThermo = fixture.makeBuffer('equal-bytes-foreign-thermo', fixture.postReaction.thermo);
          const foreignIdentity = fixture.makeBuffer('equal-bytes-foreign-identity', fixture.identityValues);
          result.admissionRejections = {
            omittedTransition: rejection({ aerosolCondensateTransition: null }),
            copiedTransition: rejection({ aerosolCondensateTransition: { ...fixture.transition } }),
            sameBytesDifferentSourceState: rejection({ postReactionStateBuffer: foreignState }),
            sameBytesDifferentSourceThermo: rejection({ postReactionThermoBuffer: foreignThermo }),
            sameBytesDifferentParticleIdentity: rejection({
              particleLineage: { ...receipt.particleLineage, identityBuffer: foreignIdentity }
            })
          };
          const pendingBefore = owner.sphAerosolParcelFamilyMatchesDevice(
            fixture.transition.aerosolFamily, device
          );
          const encoder = device.createCommandEncoder();
          stage.encode(encoder);
          stage.validateInputAuthorities();
          device.queue.submit([encoder.finish()]);
          stage.markSubmittedWork({ commandSubmissionCount: 1 });
          const opticsWords = await readWords(stage.outputBuffer, stage.outputBufferByteLength);
          const evidenceWords = await readWords(stage.evidenceBuffer, stage.evidenceBufferByteLength);
          const opticalInputWordsAfter = await Promise.all(opticalInputBuffers.map(
            (buffer) => readWords(buffer)
          ));
          const rows = Array.from(new Float32Array(Uint32Array.from(opticsWords).buffer));
          const phaseTransfer = fixture.closure.phaseCarrierTransferStep;
          const residualWords = await readWords(receipt.preTransferStateBuffer);
          const residualState = new Float32Array(Uint32Array.from(residualWords).buffer);
          result.closure = {
            status: fixture.closure.status,
            reactionParticleMutationApplied: receipt.reactionParticleMutationApplied,
            reactionStateMutationApplied: receipt.reactionStateMutationApplied,
            reactionThermoMutationApplied: receipt.reactionThermoMutationApplied,
            exactPreReactionPair: receipt.preReactionStateBuffer === fixture.currentStateBuffer
              && receipt.preReactionThermoBuffer === fixture.currentThermoBuffer,
            exactPostReactionPair: receipt.postReactionStateBuffer === fixture.postReactionStateBuffer
              && receipt.postReactionThermoBuffer === fixture.postReactionThermoBuffer,
            exactResidualPair: receipt.preTransferStateBuffer === fixture.transition.stateBuffer
              && receipt.preTransferThermoBuffer === fixture.transition.thermoBuffer,
            exactPendingTransition: receipt.aerosolCondensateTransition === fixture.transition,
            prospectiveFamilyAvailable: pendingBefore,
            actualPhaseTransfer: phaseTransfer.backend === 'webgpu',
            phaseTransferStatus: phaseTransfer.status,
            phaseTransferInvalidLineages: phaseTransfer.invalidLineageCount,
            phaseTransferEvidence: Array.from(phaseTransfer.evidence),
            actualMechanicsRefresh: fixture.closure.mechanicsRefreshStep?.backend === 'webgpu'
          };
          result.producer = {
            status: stage.result.status,
            backend: stage.result.backend,
            encodedDispatchCount: stage.result.encodedDispatchCount,
            extractedCondensateDonorCount: stage.result.extractedCondensateDonorCount,
            evidenceBufferByteLength: stage.result.evidenceBufferByteLength,
            evidenceScratchBufferByteLength: stage.result.evidenceScratchBufferByteLength,
            mapAsyncCount: stage.result.mapAsyncCount,
            readbackBytes: stage.result.readbackBytes,
            evidenceWords,
            rows,
            retainedOpticalRow: rows.slice(2 * 8, 3 * 8),
            seedByteUnchanged: unchanged(Array.from(seedRows), seedBefore),
            exactEightInputBuffersByteUnchanged: opticalInputWordsAfter.every(
              (words, index) => unchanged(words, opticalInputWordsBefore[index])
            )
          };
          result.carriers = {
            preTransferMassKg: Array.from({ length: count },
              (_value, index) => residualState[index * 8 + 3])
              .reduce((total, mass) => total + mass, 0),
            postTransferMassKg: Array.from({ length: count },
              (_value, index) => phaseTransfer.state[index * 8 + 3])
              .reduce((total, mass) => total + mass, 0),
            retainedLiquidAddressMassKg: phaseTransfer.state[2 * 8 + 3],
            residualDonorMassKg: residualState[4 * 8 + 3]
          };

          // A stage constructed while pending must not encode once the exact
          // token is discarded or consumed by outer publication.
          const staleStage = optics.createSphDispersedMediumOpticsProducerWebGpuEncoderStage(options);
          fixture.opticalStages.push(staleStage);
          if (opticalCase.unsupportedMixedMaterial) {
            result.publication = { published: false,
              reason: 'mixed-material-lineage-deliberately-not-offered-for-publication' };
            result.transitionDiscarded = closureModule
              .abandonMlsMpmPostMechanicsCondensate(fixture.closure);
          } else {
            await prepare(fixture);
            commit(fixture);
            fixture.publication = successor
              .publishPreparedSchroederSpatialSuccessorSourceFamily(fixture.plan, {
                commitReceipt: fixture.commit
              });
            result.publication = {
              published: fixture.publication.published,
              status: fixture.publication.status,
              receiptValid: successor.validateSchroederSpatialSuccessorPublicationReceipt(
                fixture.publication, { plan: fixture.plan, commitReceipt: fixture.commit,
                  nextParticleUploads: fixture.nextParticleUploads }
              )
            };
            const budgetStage = owner.createSphAerosolCombinedBudgetStage({
              device,
              sourceFamily: fixture.sourceFamily,
              terminalFamily: fixture.transition.aerosolFamily,
              sourceStateBuffer: receipt.postReactionStateBuffer,
              sourceThermoBuffer: receipt.postReactionThermoBuffer,
              terminalStateBuffer: fixture.closure.continuation.stateBuffer,
              terminalThermoBuffer: fixture.closure.continuation.thermoBuffer,
              particleCount: count
            });
            try {
              const budgetBuffer = fixture.makeBuffer('combined-optical-budget',
                new Float32Array(budgetStage.byteLength / 4));
              const budgetEncoder = device.createCommandEncoder();
              budgetStage.encode(budgetEncoder, { copyTargetBuffer: budgetBuffer });
              budgetStage.markSubmissionStarted();
              device.queue.submit([budgetEncoder.finish()]);
              const budgetWords = await readWords(budgetBuffer);
              result.budget = jsonSafe(budgetStage.decode(
                new Float32Array(Uint32Array.from(budgetWords).buffer)
              ));
            } finally {
              budgetStage.dispose();
            }
          }
          result.admissionRejections.staleTransition = rejection({});
          try {
            staleStage.encode(device.createCommandEncoder());
            result.admissionRejections.preconstructedStageAfterConsumption = null;
          } catch (error) {
            result.admissionRejections.preconstructedStageAfterConsumption = errorText(error);
          }
          result.staleStageEncodedDispatchCount = staleStage.result.encodedDispatchCount;
          result.sourceByteUnchanged = await sourceUnchanged(fixture);
          result.success = true;
        } catch (error) {
          result.success = false;
          result.reason = errorText(error);
        } finally {
          result.cleanupErrors = await cleanupFixture(fixture, {
            published: fixture.publication?.published === true
          });
        }
        return result;
      };

      try {
        const cases = [
          await runPositive(),
          await runClassifierRejection(),
          await runPublicationRejection()
        ];
        for (const opticalCase of opticalCases) cases.push(await runOpticalExclusion(opticalCase));
        const errorScopes = [
          await device.popErrorScope(),
          await device.popErrorScope(),
          await device.popErrorScope()
        ].filter(Boolean).map((error) => error.message);
        return {
          adapter: {
            vendor: adapter.info?.vendor ?? null,
            architecture: adapter.info?.architecture ?? null,
            description: adapter.info?.description ?? null,
            fallback:
              adapter.info?.isFallbackAdapter
              ?? adapter.isFallbackAdapter
              ?? false
          },
          moduleIdentityConverged: true,
          cases,
          uncapturedErrors,
          errorScopes
        };
      } finally {
        try {
          await device.queue.onSubmittedWorkDone();
        } finally {
          device.destroy();
        }
      }
    }, { expectedBudget: EXPECTED_BUDGET, opticalCases: OPTICAL_CASES });

    // Durable evidence is written with create-new semantics before any Node
    // assertion can stop the test and hide the observed failure record.
    const { writeFile } = await import('node:fs/promises');
    const evidence = {
      schema: 'peercompute.ulg.native-aerosol-outer-publication-evidence.v0',
      capturedAt: new Date().toISOString(),
      elapsedMs: performance.now() - started,
      numericScope:
        'manufactured-post-thermal-reduced-regime-stored-internal-plus-translational-kinetic',
      opticalScope:
        'three-manufactured-reaction-candidate-donor-exclusions-plus-one-rejected-mixed-material-capture-only',
      exclusions: [
        'no-preset-enablement-claim',
        'no-full-thermal-or-reaction-physics-proof',
        'no-plume-transport-or-aerosol-optical-adoption-proof',
        'mixed-material-lineage-capture-check-does-not-admit-phase-transfer'
      ],
      ...observed
    };
    await writeFile(
      evidencePath,
      `${JSON.stringify(evidence, null, 2)}\n`,
      { flag: 'wx', mode: 0o600 }
    );

    t.diagnostic(JSON.stringify({
      adapter: evidence.adapter,
      cases: evidence.cases.map(({ name, success }) => ({ name, success })),
      evidencePath,
      elapsedMs: performance.now() - started
    }));

    assert.equal(evidence.adapter.fallback, false);
    assert.equal(evidence.moduleIdentityConverged, true);
    assert.deepEqual(evidence.uncapturedErrors, []);
    assert.deepEqual(evidence.errorScopes, []);
    assert.equal(evidence.cases.length, 3 + OPTICAL_CASES.length);
    for (const nativeCase of evidence.cases) {
      assert.equal(nativeCase.success, true, nativeCase.reason || nativeCase.name);
      assert.deepEqual(nativeCase.cleanupErrors, [], nativeCase.name);
      assert.equal(nativeCase.sourceByteUnchanged, true, nativeCase.name);
    }

    const positive = evidence.cases[0];
    assert.equal(positive.closure.status, 'post-mechanics-closure-complete');
    assert.equal(
      positive.closure.claimStatus,
      'post-mechanics-continuation-claimed'
    );
    assert.equal(positive.closure.actualPhaseTransfer, true);
    assert.equal(positive.closure.actualMechanicsRefresh, true);
    assert.equal(positive.closure.mechanicsRefreshSelected, true);
    assert.equal(positive.closure.finalMechanicsDistinctFromPreTransfer, true);
    assert.equal(positive.closure.postReactionIsManufacturedThermal, true);
    assert.equal(positive.closure.preTransferIsPendingResidual, true);
    assert.equal(positive.closure.postReactionDistinctFromPreTransfer, true);
    assert.equal(positive.closure.aerosolOpticalAuthority, false);
    assert.equal(positive.closure.transitionOpticalAuthority, false);
    assert.equal(positive.closure.reactionParticleMutationApplied, false);
    assert.equal(positive.prospective.familyAvailableBeforePrepare, false);
    assert.equal(positive.prospective.acquireRejectedBeforePrepare, true);
    assert.equal(positive.prospective.familyAvailableAfterCommit, false);
    assert.equal(positive.publication.published, true);
    assert.equal(positive.publication.receiptValid, true);
    assert.equal(positive.publication.classifierCalls, 1);
    assert.equal(positive.publication.familyAvailableAfterPublication, true);
    assert.equal(positive.handover.successorResolved, true);
    assert.equal(positive.handover.actualNextGenerationReady, true);
    assert.equal(positive.handover.exactLeaseRequiredAfterRetirementRequest, true);
    assert.equal(positive.handover.exactLeaseAccepted, true);
    assert.equal(positive.handover.aerosolFamilyPreserved, true);
    assert.equal(
      positive.handover.levelAssignmentMode,
      'post-closure-full-reclassification'
    );
    assert.equal(positive.handover.retirementSettled, true);

    const near = (actual, expected, label) => assert.ok(
      Math.abs(actual - expected) <= 3e-5 * Math.max(1, Math.abs(expected)),
      `${label}: ${actual} vs ${expected}`
    );
    for (const endpointName of ['source', 'terminal']) {
      const endpoint = positive.budget[endpointName];
      near(endpoint.massKg, EXPECTED_BUDGET.massKg, `${endpointName} total mass`);
      near(
        endpoint.internalEnergyJ,
        EXPECTED_BUDGET.internalEnergyJ,
        `${endpointName} internal energy`
      );
      near(
        endpoint.translationalKineticEnergyJ,
        EXPECTED_BUDGET.translationalKineticEnergyJ,
        `${endpointName} translational kinetic energy`
      );
      near(
        endpoint.internalPlusTranslationalKineticEnergyJ,
        EXPECTED_BUDGET.internalPlusTranslationalKineticEnergyJ,
        `${endpointName} U+translation-KE`
      );
      for (let axis = 0; axis < 3; axis += 1) {
        near(
          endpoint.momentumKgMPerS[axis],
          EXPECTED_BUDGET.momentumKgMPerS[axis],
          `${endpointName} momentum axis ${axis}`
        );
        near(
          endpoint.firstMomentKgM[axis],
          EXPECTED_BUDGET.firstMomentKgM[axis],
          `${endpointName} first moment axis ${axis}`
        );
      }
      for (const phase of ['solid', 'liquid', 'gas', 'plasma']) {
        near(
          endpoint.phaseMassKg[phase],
          EXPECTED_BUDGET.phaseMassKg[phase],
          `${endpointName} ${phase} mass`
        );
      }
    }
    near(positive.budget.source.aerosolMassKg, 0, 'source aerosol mass');
    near(
      positive.budget.terminal.aerosolMassKg,
      EXPECTED_BUDGET.aerosolMassKg,
      'terminal aerosol mass'
    );
    near(
      positive.budget.terminal.massKg
        - positive.budget.terminal.aerosolMassKg,
      EXPECTED_BUDGET.carrierMassKg,
      'terminal residual carrier mass'
    );
    assert.equal(
      positive.budget.terminal.physicalMultiplicity,
      EXPECTED_BUDGET.physicalMultiplicity
    );

    const classifierRejection = evidence.cases[1];
    assert.equal(classifierRejection.actualClassifierRan, true);
    assert.match(classifierRejection.rejectionReason, /classifier|provenance/i);
    assert.equal(classifierRejection.transactionState, 'canonical-built');
    assert.equal(classifierRejection.transitionDiscarded, true);
    assert.equal(classifierRejection.prospectiveFamilyAvailable, false);
    assert.equal(
      classifierRejection.retry.status,
      'condensate-candidate-ready-not-resident-adopted'
    );
    assert.equal(classifierRejection.retry.discarded, true);

    const publicationRejection = evidence.cases[2];
    assert.equal(publicationRejection.publication.published, false);
    assert.equal(
      publicationRejection.publication.status,
      'schroeder-successor-source-family-publication-rejected'
    );
    assert.equal(publicationRejection.prospectiveFamilyAvailable, false);
    assert.equal(
      publicationRejection.retry.status,
      'condensate-candidate-ready-not-resident-adopted'
    );
    assert.equal(publicationRejection.retry.discarded, true);

    for (let index = 0; index < OPTICAL_CASES.length; index += 1) {
      const expected = OPTICAL_CASES[index];
      const opticalCase = evidence.cases[index + 3];
      assert.equal(opticalCase.name, `optical-${expected.name}`);
      assert.equal(opticalCase.closure.status, 'post-mechanics-closure-complete');
      for (const property of ['reactionParticleMutationApplied', 'reactionStateMutationApplied',
        'reactionThermoMutationApplied', 'exactPreReactionPair', 'exactPostReactionPair',
        'exactResidualPair', 'exactPendingTransition', 'actualPhaseTransfer',
        'actualMechanicsRefresh']) {
        assert.equal(opticalCase.closure[property], true, `${expected.name}: ${property}`);
      }
      assert.equal(opticalCase.closure.prospectiveFamilyAvailable, false);
      assert.equal(opticalCase.producer.backend, 'webgpu');
      assert.equal(opticalCase.producer.status, 'dispersed-medium-optics-producer-submitted');
      assert.equal(opticalCase.producer.encodedDispatchCount, 3, 'existing capture/preflight/apply only');
      assert.equal(opticalCase.producer.extractedCondensateDonorCount, 1);
      assert.equal(opticalCase.producer.evidenceBufferByteLength, 64, 'unchanged diagnostic header');
      assert.equal(opticalCase.producer.evidenceScratchBufferByteLength, 72, 'two cold donor flags');
      assert.equal(opticalCase.producer.mapAsyncCount, 0, 'producer itself adds no map');
      assert.equal(opticalCase.producer.readbackBytes, 0, 'diagnostic fixture reads are external');
      assert.equal(opticalCase.producer.seedByteUnchanged, true);
      assert.equal(opticalCase.producer.exactEightInputBuffersByteUnchanged, true);
      assert.equal(opticalCase.producer.evidenceWords[11], 0, 'no false ambiguous route');
      assert.equal(opticalCase.producer.evidenceWords[12], 1, 'one captured ready route');
      assert.equal(opticalCase.producer.evidenceWords[9], expected.preBulkLiquidMassKg < 10 ? 1 : 0,
        'only surviving-component reaction birth');
      const row = opticalCase.producer.retainedOpticalRow;
      assert.deepEqual(row.slice(0, 4), [expected.bulkMaterialId, 2, expected.bulkMaterialId + 100, 1]);
      for (const [lane, factor, label] of [[4, 1, 'mass'], [5, 1500, 'scattering'],
        [6, 187.5, 'absorption'], [7, 750, 'asymmetry']]) {
        near(row[lane], expected.expectedDispersedMassKg * factor, `${expected.name}: ${label}`);
      }
      near(opticalCase.carriers.preTransferMassKg, 13, `${expected.name}: residual carrier mass`);
      near(opticalCase.carriers.postTransferMassKg, 13, `${expected.name}: final carrier mass`);
      near(opticalCase.carriers.retainedLiquidAddressMassKg, 10, `${expected.name}: retained C`);
      near(opticalCase.carriers.residualDonorMassKg, 3, `${expected.name}: residual donor`);
      for (const [name, reason] of Object.entries(opticalCase.admissionRejections)) {
        assert.equal(typeof reason, 'string', `${expected.name}: ${name} must reject`);
        assert.match(reason, /exact|pending|source|lineage/i, `${expected.name}: ${name}`);
      }
      assert.equal(opticalCase.staleStageEncodedDispatchCount, 0);
      if (expected.unsupportedMixedMaterial) {
        assert.equal(opticalCase.closure.phaseTransferStatus,
          'phase-carrier-transfer-complete-with-rejected-lineages');
        assert.equal(opticalCase.closure.phaseTransferInvalidLineages, 1);
        assert.equal(opticalCase.closure.phaseTransferEvidence[2], 4, 'retain material rejection');
        assert.equal(opticalCase.producer.evidenceWords[2], 4, 'retain transfer-input rejection');
        assert.equal(opticalCase.producer.evidenceWords[8], 1, 'one invalid transfer input');
        assert.equal(opticalCase.publication.published, false);
        assert.equal(opticalCase.transitionDiscarded, true);
        assert.equal(opticalCase.budget, undefined, 'no admitted mixed-material budget');
      } else {
        assert.equal(opticalCase.closure.phaseTransferStatus, 'phase-carrier-transfer-complete');
        assert.equal(opticalCase.closure.phaseTransferInvalidLineages, 0);
        assert.equal(opticalCase.closure.phaseTransferEvidence[2], 0);
        assert.equal(opticalCase.producer.evidenceWords[2], 0);
        assert.equal(opticalCase.producer.evidenceWords[8], 0);
        assert.equal(opticalCase.publication.published, true);
        assert.equal(opticalCase.publication.receiptValid, true);
        for (const endpointName of ['source', 'terminal']) {
          const endpoint = opticalCase.budget[endpointName];
          near(endpoint.massKg, 14, `${expected.name}: ${endpointName} mass`);
          near(endpoint.phaseMassKg.liquid, 11, `${expected.name}: ${endpointName} liquid mass`);
          near(endpoint.phaseMassKg.gas, 3, `${expected.name}: ${endpointName} gas mass`);
          near(endpoint.phaseMassKg.solid, 0, `${expected.name}: ${endpointName} solid mass`);
          near(endpoint.phaseMassKg.plasma, 0, `${expected.name}: ${endpointName} plasma mass`);
          near(endpoint.internalEnergyJ, 200, `${expected.name}: ${endpointName} internal energy`);
          near(endpoint.translationalKineticEnergyJ, 10,
            `${expected.name}: ${endpointName} translational energy`);
          near(endpoint.internalPlusTranslationalKineticEnergyJ, 210,
            `${expected.name}: ${endpointName} tracked energy`);
          for (let axis = 0; axis < 3; axis += 1) {
            near(endpoint.momentumKgMPerS[axis], [8, -4, 0][axis],
              `${expected.name}: ${endpointName} momentum ${axis}`);
            near(endpoint.firstMomentKgM[axis], 13,
              `${expected.name}: ${endpointName} first moment ${axis}`);
          }
        }
        near(opticalCase.budget.source.aerosolMassKg, 0, `${expected.name}: source aerosol`);
        near(opticalCase.budget.terminal.aerosolMassKg, 1, `${expected.name}: terminal aerosol`);
        assert.equal(opticalCase.budget.terminal.physicalMultiplicity, EXPECTED_BUDGET.physicalMultiplicity);
      }
    }
  } finally {
    await browser.close();
  }
});
