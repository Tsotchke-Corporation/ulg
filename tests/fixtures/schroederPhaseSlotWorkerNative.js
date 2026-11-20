import * as worker from '../../src/services/ulgMechanicsResidentStage.worker.js';
import * as h from '../../src/runtime/sph/schroederHierarchyGpu.js';
import * as control from '../../src/runtime/sph/schroederWorkerLaneControlPlane.js';
import * as abi from '../../ulg-gpu-abi/src/index.js';
import { schroederPhaseVolumeMigrationWgsl } from '../../ulg-gpu-abi/src/wgsl.js';
import { tagWebGpuBufferDevice } from '../../src/runtime/sph/sphGpuDeviceIdentity.js';
import { ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA } from '../../src/runtime/sph/sphMechanicsMaterialTable.js';

// Manufactured cold gas; all split/proposal and mechanics/closure kernels and
// the two-step worker scheduler are production implementations. Admission
// descriptors are fixture inputs, not evidence of a scene StateManager commit.
self.onmessage = async ({ data }) => {
  if (data?.type !== 'phase-slot-native') return;
  const scenario = data.scenario ?? 'interface';
  const bulkCases = ['coarsen', 'oversize', 'overfull', 'material'];
  const bulkCase = bulkCases.includes(scenario);
  const bulkCount = scenario === 'overfull' ? 9 : scenario === 'material' ? 2 : 8;
  const hasCondensed = scenario !== 'bulk' && !bulkCase;
  const cycle = scenario === 'cycle';
  const gasMass = scenario === 'oversize' ? 128 : bulkCase ? 32 : cycle ? 32 : scenario === 'resolved' ? 8 : 64;
  const gasPosition = cycle || bulkCase ? [5.5,5.5,5.5] : [5,5,5];
  const condensedPosition = cycle ? [6.5,5.5,5.5] : scenario === 'far' ? [9,9,9]
    : scenario === 'volume-interface' ? [8,5,5] : [6,5,5];
  let device;
  const errors = [], owned = [];
  const lane = { laneId: 'native-phase-slot-worker', stateKey: 'native-phase-slot-worker-state' };
  let result;
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('Worker WebGPU adapter unavailable');
    device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: 12 } });
    device.addEventListener('uncapturederror', e => errors.push(e.error.message));
    device.pushErrorScope('validation');
    const make = values => {
      const b = tagWebGpuBufferDevice(device.createBuffer({ size: values.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST }), device);
      device.queue.writeBuffer(b, 0, values); owned.push(b); return b;
    };
    const capacity = scenario === 'capacity' ? 8 : 9, count = capacity * 4;
    const plan = { schema: 'peercompute.ulg.sph-phase-carrier-plan.v2', status: 'phase-lane-capacity-ready',
      lineageCapacity: capacity, primaryCapacity: capacity, phaseLaneStride: capacity, phaseLaneCount: 4,
      companionStart: capacity, companionCapacity: capacity * 3, particleCapacity: count,
      stableLaneAddress: 'phaseLane*phaseLaneStride+lineageIndex', phaseCompanionLanesRequired: true,
      splitSpareReserve: { schema: 'peercompute.ulg.schroeder-split-spare-reserve.v1',
        firstLineageIndex: 2, count: capacity - 2, firstContinuityDomainId: 102 } };
    const state = new Float32Array(count * 8), thermo = new Float32Array(count * 12), mechanics = new Float32Array(count * 32);
    for (let i = 0; i < count; i++) {
      const condensed = i === 1 && hasCondensed;
      const mass = bulkCase ? (i < bulkCount ? gasMass/bulkCount : 0) : i === 0 ? gasMass : condensed ? 1 : 0;
      const material = condensed ? 8 : scenario === 'material' && i === 1 ? 9 : 7;
      const rho = condensed ? 8 : 1;
      const position = condensed ? condensedPosition : gasPosition;
      state.set([...position,mass,0,0,0,2000], i*8);
      thermo.set([material,condensed ? 2 : 3,200,rho,0,condensed ? 1 : 0,condensed ? 0 : 1,0,.2,mass,mass > 0 ? 1 : 254,.1], i*12);
      mechanics[i*32] = 1; mechanics[i*32+4] = 1; mechanics[i*32+8] = 1;
      mechanics.set([1,mass/rho,0,1,100,0,0,10,2,1,101325,0,0,mass],i*32+18);
    }
    const epoch = { storageGeneration: 1, topologyEpoch: 7, positionEpoch: 0,
      physicsTick: 0, physicsSubstep: 0, chartEpoch: 0, levelEpoch: 0, supportEpoch: 0 };
    const sphParticleState = { schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count,
      state, thermo, stateStrideBytes: 32, thermoStrideBytes: 48, stateStrideFloats: 8, thermoStrideFloats: 12,
      phaseCarrierPlan: plan, smoothingLengthM: 1, step: 0, time: 0, ...epoch };
    const mlsMpmParticleState = { schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SCHEMA, particleCount: count,
      mechanics, mechanicsStrideBytes: 128, mechanicsStrideFloats: 32, phaseCarrierPlan: plan,
      mechanicsDtS: .001, gridCflFactor: .4, gravityMPerS2: [0,0,0], ...epoch };
    const sphParticleUpload = { schema: abi.ULG_SPH_GPU_PARTICLE_BUFFER_SET_SCHEMA, status: 'webgpu-uploaded',
      particleCount: count, phaseCarrierPlan: plan, ...epoch,
      identityBuffer: make(Uint32Array.from({ length: count }, (_,i) => 100+i%capacity)),
      identityRevision: 'native-phase-slot-worker-identity', identityStrideBytes: 4,
      identityBufferByteLength: count*4, ownsIdentityBuffer: true,
      stateBuffer: make(state), thermoBuffer: make(thermo), stateStrideBytes: 32, thermoStrideBytes: 48 };
    const mlsMpmParticleUpload = { schema: abi.ULG_MLS_MPM_GPU_PARTICLE_BUFFER_SET_SCHEMA, status: 'webgpu-uploaded',
      particleCount: count, phaseCarrierPlan: plan, ...epoch, mechanicsBuffer: make(mechanics), mechanicsStrideBytes: 128 };
    const fields = [...h.SCHROEDER_PARTICLE_STORAGE_TARGET_FAMILIES];
    const admissions = {
      phaseVolumeSplitMergeAdmission: { committed: true, phaseVolumeSplitMergeApproved: true,
        outputFamilies: ['schroeder-phase-volume-split-merge-apply'], schroederPhaseVolumeSplitMergeProposalRowCount: count },
      particleStorageAllocatorAdmission: { committed: true, particleStorageAllocationApproved: true,
        particleCapacityApproved: true, outputFamilies: ['schroeder-particle-storage-allocation'],
        targetStateFamilies: fields, schroederParticleStorageAllocationRowCount: count,
        currentParticleCapacity: count, requiredParticleCapacity: count },
      particleStorageSlotAssignmentAdmission: { committed: true, particleStorageSlotAssignmentApproved: true,
        freeListDescriptorApproved: true, outputFamilies: ['schroeder-particle-storage-slot-assignment'],
        targetStateFamilies: fields, schroederParticleStorageSlotAssignmentRowCount: count },
      particleStorageMaterializationAdmission: { committed: true, particleStorageMaterializationApproved: true,
        particleIdentityMutationApproved: true, slotAssignmentDescriptorApproved: true,
        outputFamilies: ['schroeder-particle-storage-materialization'], targetStateFamilies: fields,
        schroederParticleStorageMaterializationRowCount: count }
    };
    const hierarchyConfig = control.createSchroederWorkerHierarchyConfig({ selectedLevel: 0, minLevel: 0,
      maxLevel: 0, baseGridSpacingM: 1, enablePhaseVolumeMigration: true, enablePhaseSlotRefinement: true,
      phaseSlotRefinementAdmissions: admissions });
    const initialAssignment = await h.runSchroederLevelAssignmentWebGpu({ device, sphParticleState,
      mlsMpmParticleState, sphParticleUpload, mlsMpmParticleUpload, baseGridSpacingM: 1,
      minLevel: 0, maxLevel: 0, readbackMode: 'no-full-readback' });
    const thermalMaterialTable = { schema: abi.ULG_SPH_GPU_THERMAL_MATERIAL_TABLE_SCHEMA,
      materialCount: 3, segmentCount: 4, recordStrideFloats: 8, segmentStrideFloats: 12,
      segments: new Float32Array([
        7,5,3,3,100,10000,10,1000,1,1,1,0,
        8,3,2,2,100,10000,10,1000,8,8,1,0,
        8,3,3,3,10000,20000,1000,2000,1,1,1,0,
        9,5,3,3,100,10000,10,1000,1,1,1,0]),
      records: new Float32Array([7,0,1,1,0,0,101325,0, 8,1,2,1,0,0,101325,0, 9,3,1,1,0,0,101325,0]) };
    const mechanicsMaterialTable = { schema: ULG_MLS_MPM_MECHANICS_MATERIAL_TABLE_SCHEMA,
      phaseRecordCount: 3, records: new Float32Array([7,3,1,900,0,0,30,2,0,1,0,0, 8,2,8,900,0,0,30,2,0,1,0,0, 9,3,1,900,0,0,30,2,0,1,0,0]) };
    const common = { deviceResult: { device }, sphParticleState, mlsMpmParticleState,
      sphParticleUpload, mlsMpmParticleUpload, boxDimsM: [10,10,10], dt: .001, gravityMPerS2: [0,0,0],
      gridSpacingM: 1, readbackMode: 'no-full-readback' };
    const payload = {
      lease: { ...lane, queueFencePolicy: 'queue.onSubmittedWorkDone-before-admission' },
      schedule: { stepCount: 2, scheduleId: 'native-phase-slot-schedule' },
      context: { ulgMechanicsResidentStageWorker: {
        schema: 'peercompute.ulg.mechanics-resident-stage-worker-context.v0',
        taskIdPrefix: 'native-phase-slot', preferWebGpu: true, readbackMode: 'no-full-readback', common,
        stageOptions: {
          schroederSpatialEpoch: { levelAssignment: initialAssignment, particleIdentityBuffer: sphParticleUpload.identityBuffer,
            particleIdentityStrideWords: 1, selectedLevel: 0, minLevel: 0, maxLevel: 0, baseGridSpacingM: 1 },
          schroederSameLevelMechanics: { ...hierarchyConfig, hierarchyConfig,
            enablePressureInterfaceOwnerScope: false,
            residentStepOptions: { thermalMaterialTable, mechanicsMaterialTable, contactSolverEnabled: true,
              gasPressureMechanicsBoundaryEnabled: false, internalPressureScale: 0, summaryRunner: null,
              thermalStepOptions: { conductionRate: 0, wallRate: 0, ambientTemperatureK: 200,
                wallModel: 'adiabatic', smoothingLengthM: .2 } }
          }
        }
      } }
    };
    const stages = [];
    const stageNames = cycle ? ['split', 'away-merge', 'bulk-hold', 'returned-resplit'] : [scenario];
    for (const stageName of stageNames) {
      const execution = await worker.runUlgMechanicsResidentStageWorkerSchedulePayload(payload);
      const retained = worker.resolveUlgMechanicsResidentStageWorkerRetainedParticleState({ ...lane,
        sourceStageId: 'schroederSameLevelMechanics' });
      if (!retained.sourceStateBuffer) throw new Error('Worker omitted its actual retained state');
      const away = stageName === 'away-merge' || stageName === 'bulk-hold';
      const currentCondensedPosition = away ? [9,9,9] : condensedPosition;
      const receipt = make(new Uint32Array(8));
      const pipeline = device.createComputePipeline({ layout: 'auto', compute: { entryPoint: 'main',
        module: device.createShaderModule({ code: `
          @group(0) @binding(0) var<storage, read> state: array<vec4<f32>>;
          @group(0) @binding(1) var<storage, read> thermo: array<vec4<f32>>;
          @group(0) @binding(2) var<storage, read_write> receipt: array<u32>;
          @group(0) @binding(3) var<storage, read> mechanics: array<vec4<f32>>;
          @group(0) @binding(4) var<storage, read> identity: array<u32>;
          @compute @workgroup_size(1) fn main() {
            var mass = 0.0; var energy = 0.0; var volume = 0.0; var entities = 0.0;
            var momentum = vec3<f32>(0.0); var moment = vec3<f32>(0.0);
            for (var i = 0u; i < arrayLength(&state)/2u; i++) {
              let m = state[2u*i].w; let u = state[2u*i+1u].w;
              mass += m; energy += m*(u + 0.5*dot(state[2u*i+1u].xyz,state[2u*i+1u].xyz));
              momentum += m * state[2u*i+1u].xyz; moment += m * state[2u*i].xyz;
              volume += mechanics[8u*i+4u].z * mechanics[8u*i+4u].w;
              entities += thermo[3u*i+2u].y;
              if (m > 0.0) { receipt[1]++; if (thermo[3u*i].y == 3.0 && thermo[3u*i].x == 7.0) { receipt[4]++; } }
              if (identity[i] != 100u + i % ${capacity}u) { receipt[0]++; }
              if (!(m >= 0.0) || !(abs(u) < 1e20)) { receipt[0]++; }
            }
            if (!(abs(mass-${(gasMass + Number(hasCondensed)).toFixed(1)}) < 0.001)) { receipt[0]++; }
            if (!(abs(energy-${((gasMass + Number(hasCondensed))*2000).toFixed(1)}) < 1.0)) { receipt[0]++; }
            if (!(abs(volume-${(gasMass + (hasCondensed ? .125 : 0)).toFixed(3)}) < 0.001)) { receipt[0]++; receipt[6]++; }
            if (!(abs(entities-${(gasMass + Number(hasCondensed)).toFixed(1)}) < 0.001)) { receipt[0]++; }
            if (!(length(momentum) < 0.0001)) { receipt[0]++; }
            if (!(length(moment-vec3<f32>(${currentCondensedPosition.map((x,i) => (gasMass*gasPosition[i] + (hasCondensed ? x : 0)).toFixed(1)).join(',')})) < 0.002)) { receipt[0]++; receipt[7]++; }
            receipt[2] = bitcast<u32>(mass); receipt[3] = bitcast<u32>(energy); receipt[5] = 1u;
          }
        ` }) } });
      const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries:
        [retained.sourceStateBuffer, retained.sourceThermoBuffer, receipt, retained.sourceMechanicsBuffer, retained.sphParticleUpload.identityBuffer]
          .map((buffer,binding) => ({ binding, resource: { buffer } })) });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0,group);
      pass.dispatchWorkgroups(1); pass.end();
      const read = device.createBuffer({ size: 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      owned.push(read); encoder.copyBufferToBuffer(receipt,0,read,0,32); device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ); const words = [...new Uint32Array(read.getMappedRange())]; read.unmap();
      result = { scenario, stageName, identityPreserved: retained.sphParticleUpload.identityBuffer === sphParticleUpload.identityBuffer, status: execution.status, sourceStage: retained.sphParticleUpload?.sourceStage, completedStepCount: execution.completedStepCount,
        words, topologyEpoch: retained.sphParticleUpload?.topologyEpoch,
        retainedStatus: retained.status, retainedWithinWorker: retained.retainedWithinWorker,
        sameWorkerPrivateReferences: retained.sameWorkerPrivateReferences,
        summary: execution.perStepSummaries?.lastStep ?? null };
      const { summary: ignoredSummary, ...stageReceipt } = result;
      stages.push(stageReceipt);
      // Manufactured external neighbor translation on the GPU. Allow two real
      // steps: the first rebuilds the canonical successor from the perturbed
      // source; the second consumes that current spatial dictionary. Only the
      // neighbor position changes. No proposal, assignment, gas state, phase or
      // identity is injected; account for its changed first moment below.
      if (cycle && (stageName === 'split' || stageName === 'bulk-hold')) {
        const pulse = device.createComputePipeline({ layout: 'auto', compute: { entryPoint: 'main',
          module: device.createShaderModule({ code: `
            @group(0) @binding(0) var<storage, read_write> state: array<vec4<f32>>;
            @group(0) @binding(1) var<storage, read> thermo: array<vec4<f32>>;
            @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
              let i=id.x; if (i >= arrayLength(&state)/2u) { return; }
              if (thermo[3u*i].x == 8.0 && state[2u*i].w > 0.0) {
                state[2u*i] = vec4<f32>(vec3<f32>(${(stageName === 'split' ? [9,9,9] : condensedPosition).map(x => x.toFixed(1)).join(',')}), state[2u*i].w);
              }
            }` }) } });
        const group = device.createBindGroup({ layout: pulse.getBindGroupLayout(0), entries: [
          { binding: 0, resource: { buffer: retained.sourceStateBuffer } },
          { binding: 1, resource: { buffer: retained.sourceThermoBuffer } }
        ] });
        const enc = device.createCommandEncoder(), pass = enc.beginComputePass();
        pass.setPipeline(pulse); pass.setBindGroup(0,group); pass.dispatchWorkgroups(Math.ceil(count/64)); pass.end();
        device.queue.submit([enc.finish()]);
    }
      payload.schedule.scheduleId += '-next';
      const epochOptions = payload.context.ulgMechanicsResidentStageWorker.stageOptions.schroederSpatialEpoch;
      delete epochOptions.levelAssignment; delete epochOptions.particleIdentityBuffer;
      epochOptions.useWorkerRetainedParticleBuffers = true;
    }
    if (cycle) result = { ...result, stages };
    if (scenario === 'coarsen') {
      // Isolate invalid GPU dictionary states with the actual migration shader.
      // All inputs are manufactured; only the coarsen-decision scalar is read.
      const assignment = new Float32Array([0,1,1.5,4,4,4,4,1,3,7,0,.15,5.5,5.5,5.5,0]);
      const aggregate = new Float32Array(32);
      aggregate.set([7,0,0,1,5,5,5,1,8,8]); aggregate[15]=2; aggregate[30]=1;
      const fields = new Uint32Array(128);
      fields[0]=abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_MAGIC;
      fields[1]=abi.SCHROEDER_SPATIAL_MECHANICS_FIELD_VIEW_VERSION;
      fields[2]=3; fields[16]=1; fields[24]=64; fields[25]=32;
      fields[26]=96; fields[27]=4; fields[34]=1;
      fields[64]=3; fields[67]=1; fields[96]=1; fields[97]=3;
      const params = new ArrayBuffer(64), v = new DataView(params);
      [1,1,16,32,32,0,0,1].forEach((x,i)=>v.setUint32(i*4,x,true));
      [1,1.5,1,64,1,3,0,1e-6].forEach((x,i)=>v.setFloat32(32+i*4,x,true));
      const uniform = device.createBuffer({ size:64, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST });
      owned.push(uniform); device.queue.writeBuffer(uniform,0,params);
      const output=make(new Float32Array(32)), fieldBuffer=make(fields);
      const migration=device.createComputePipeline({ layout:'auto', compute:{ entryPoint:'main',
        module:device.createShaderModule({ code:schroederPhaseVolumeMigrationWgsl }) } });
      const group=device.createBindGroup({layout:migration.getBindGroupLayout(0), entries:
        [make(assignment),make(aggregate),output,uniform,make(new Uint32Array([100])),fieldBuffer]
        .map((buffer,binding)=>({binding,resource:{buffer}}))});
      const read=device.createBuffer({size:12,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
      owned.push(read);
      for (let mode=0;mode<3;mode++) {
        fields[2]=mode===1 ? 2 : 3; fields[67]=mode===2 ? 0 : 1;
        device.queue.writeBuffer(fieldBuffer,0,fields);
        const enc=device.createCommandEncoder(),pass=enc.beginComputePass();
        pass.setPipeline(migration);pass.setBindGroup(0,group);pass.dispatchWorkgroups(1);pass.end();
        enc.copyBufferToBuffer(output,22*4,read,mode*4,4);device.queue.submit([enc.finish()]);
      }
      await read.mapAsync(GPUMapMode.READ);
      result.dictionaryCoarsenDecisions=[...new Float32Array(read.getMappedRange())];read.unmap();
    }
    const validation = await device.popErrorScope(); if (validation) errors.push(validation.message);
  } catch (error) {
    result = { fatal: error.stack || error.message, scheduleError: error.residentScheduleError ?? null };
  } finally {
    worker.releaseUlgMechanicsResidentStageWorkerLane(lane);
    if (device) {
      await device.queue.onSubmittedWorkDone().catch(() => {});
      for (const b of owned) b.destroy();
      device.destroy();
    }
  }
  self.postMessage({ ...result, errors, scope: 'Native worker scheduler with real proposal/allocation/mechanics/closure; manufactured cold gas and admission inputs; scene admission and G2 acceptance unproven' });
};
