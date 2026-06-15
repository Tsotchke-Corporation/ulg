export function runUlgRemoteResidentPlacementTask(data = {}) {
  const retainedBufferRefs = [
    ...(data.gpuFenceRequirement?.retainedBufferRefs || []),
    'remote-placement-output-buffer'
  ];
  const gpuFence = {
    schema: 'peercompute.compute.gpu-fence-report.v0',
    status: 'queue-work-completed',
    method: 'queue.onSubmittedWorkDone',
    fenceSatisfied: true,
    required: true,
    laneId: data.gpuFenceRequirement?.laneId || null,
    stateKey: data.gpuFenceRequirement?.stateKey || null,
    queueFencePolicy: data.gpuFenceRequirement?.queueFencePolicy || null,
    queueCompletionStatus: 'queue-work-completed',
    queueCompletionMethod: 'queue.onSubmittedWorkDone',
    retainedBufferRefs,
    source: 'ulg-remote-resident-placement-fixture'
  };
  const completedStepCount = Math.max(1, Math.round(Number(data.stepCount) || 1));
  return {
    schema: 'peercompute.ulg.mls-mpm-gpu-resident-steps-execution.v0',
    value: {
      schema: 'peercompute.ulg.remote-resident-placement-result.v0',
      status: 'remote-resident-placement-executed',
      completedStepCount,
      stateKey: data.commitDeltaStateKey || null,
      lawGraphNodeId: data.lawGraphNode?.nodeId || null
    },
    lawGraphNode: data.lawGraphNode || null,
    gpuFence,
    commitDelta: {
      schema: 'peercompute.ulg.mls-mpm-resident-steps-commit-delta.v0',
      taskId: data.computeTaskId || 'ulg:test:remote-resident-placement',
      scope: data.commitDeltaScope || 'ulg-sph-resident-pass-dag',
      version: completedStepCount,
      timestamp: 123456,
      payload: {
        schema: 'peercompute.ulg.mls-mpm-resident-steps-state-delta.v0',
        status: 'resident-steps-delta-ready',
        stateKey: data.commitDeltaStateKey || null,
        backend: 'remote-webgpu-fixture',
        readbackMode: data.readbackMode || 'no-full-readback',
        requestedReadbackMode: data.readbackMode || 'no-full-readback',
        completedStepCount,
        continuationAvailable: true,
        continuedFromResidentState: true,
        residentSourceMode: 'remote-gpu-resident-fixture',
        lawGraphNode: data.lawGraphNode || null,
        outputFamilies: [...(data.expectedOutputFamilies || [])],
        gpuFence,
        retainedBufferRefs,
        gpuResidentLaneRequirement: data.gpuResidentLane || null,
        finalStep: {
          schema: 'peercompute.ulg.mls-mpm-resident-step-sequence-summary.v0',
          stepIndex: completedStepCount - 1,
          backend: 'remote-webgpu-fixture',
          status: 'resident-step-remote-placement-executed',
          readbackMode: data.readbackMode || 'no-full-readback',
          normalHotLoopReadbackFree: true,
          gpuAuthoritativeState: true,
          renderStateReadbackAvailable: false,
          diagnostics: {
            particleCount: data.sphParticleState?.particleCount ?? null,
            gpuResidentLaneFenceSatisfied: false
          }
        },
        stepSummaries: [],
        normalHotLoopReadbackFree: true,
        gpuAuthoritativeState: true,
        scientificValidation: false,
        sphValidation: false,
        phaseChangeValidation: false,
        fullPhysicsValidation: false
      }
    }
  };
}
