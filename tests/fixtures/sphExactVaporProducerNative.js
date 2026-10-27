import { acquireSphSpatialVaporAerosolProducerRead, resolveSphSpatialVaporAerosolProducerRead,
  forkSphSpatialVaporAerosolProducerRead, releaseSphSpatialVaporAerosolProducerRead,
  releaseSphSpatialVaporAerosolExchangeCandidate } from '../../src/runtime/sph/sphSpatialGasLedgerEosGpu.js';
import { createSphExactMassInventoryFromVaporExchangeWebGpu, acquireSphExactMassRead,
  releaseSphExactMassRead, releaseSphExactMassInventory } from '../../src/runtime/sph/sphExactMassInventoryGpu.js';
import { publishResidentProductVaporHistoryWebGpu, resolveResidentProductVaporHistoryPublication }
  from '../../src/runtime/sph/sphMlsMpmGpuStep.js';
import { resolveResidentProductEventCountAuthority } from '../../src/runtime/sph/sphResidentProductHistoryGpu.js';
import { runMlsMpmMechanicsRefreshWebGpu, resolveMlsMpmMechanicsRefreshSourceCapture }
  from '../../src/runtime/sph/sphMechanicsRefreshGpuKernel.js';
import { releaseSphPostMechanicsGasStateAfterQueue } from '../../src/runtime/sph/sphPostMechanicsGasStateGpu.js';
import { prepareSphAerosolVaporTransition, validateSphAerosolCondensateTransition,
  discardSphAerosolCondensateTransition, acquireSphAerosolParcelRead }
  from '../../src/runtime/sph/sphAerosolParcelGpu.js';

// Exercise original owners on actual GPU-produced outputs. None of these
// diagnostic readbacks is supplied back to a producer or publication path.
export async function inspectExactVaporProducerNative({ device, closure, current, candidate, observed, read }) {
  const checks = {};
  let held, mass, massRead, history, refresh, refreshSeal, candidateRetirement, historyCleanup, transition;
  const equal = (a, b) => a.length === b.length && a.every((word, i) => word === b[i]);
  try {
    for (const [name, args] of [['copiedCandidateRejected', { candidate: { ...candidate }, closure }],
      ['wrongClosureRejected', { candidate, closure: { ...closure } }]]) {
      try { acquireSphSpatialVaporAerosolProducerRead(args.candidate, { device, closure: args.closure }); checks[name] = false; }
      catch { checks[name] = true; }
    }
    held = acquireSphSpatialVaporAerosolProducerRead(candidate, { device, closure });
    try { resolveSphSpatialVaporAerosolProducerRead({ ...held }, { device }); checks.copiedProducerRejected = false; }
    catch { checks.copiedProducerRejected = true; }
    try { acquireSphSpatialVaporAerosolProducerRead(candidate, { device, closure }); checks.producerReplayRejected = false; }
    catch { checks.producerReplayRejected = true; }
    let settled = false;
    candidateRetirement = releaseSphSpatialVaporAerosolExchangeCandidate(candidate).then(value => { settled = true; return value; });
    await device.queue.onSubmittedWorkDone(); await Promise.resolve();
    checks.candidateWaitsForProducer = !settled;
    const fork = forkSphSpatialVaporAerosolProducerRead(held, { device });
    const closed = held; releaseSphSpatialVaporAerosolProducerRead(held); held = fork;
    try { resolveSphSpatialVaporAerosolProducerRead(closed, { device }); checks.closedProducerRejected = false; }
    catch { checks.closedProducerRejected = true; }
    const source = resolveSphSpatialVaporAerosolProducerRead(held, { device });
    const packet = source.sourcePacket, layout = source.endpoints.particleLayout;
    checks.forkAfterLogicalClose = equal(await read(source.endpoints.particleBuffer), observed.exactParticleWords);
    transition = await prepareSphAerosolVaporTransition({ device, producerRead: held });
    const transitionContext = { device, transaction: packet.sourceTransaction, generation: packet.sourceGeneration,
      sourceFamily: packet.aerosolFamily, nextFamily: transition.aerosolFamily };
    checks.originalAerosolTransition = validateSphAerosolCondensateTransition(transition, transitionContext)
      && transition.aerosolFamily.exactMassFormat === source.format;
    checks.copiedTransitionRejected = !validateSphAerosolCondensateTransition({ ...transition }, transitionContext);
    try { acquireSphAerosolParcelRead({ device, family: transition.aerosolFamily,
      expectedGeneration: transition.aerosolFamily.generation }); checks.pendingAerosolUnreadable = false; }
    catch { checks.pendingAerosolUnreadable = true; }
    try { await prepareSphAerosolVaporTransition({ device, producerRead: held }); checks.aerosolReservationReplayRejected = false; }
    catch (error) { await error.exactVaporTransitionCleanupCompletion; checks.aerosolReservationReplayRejected = true; }
    mass = await createSphExactMassInventoryFromVaporExchangeWebGpu({ device, producerRead: held });
    massRead = acquireSphExactMassRead({ device, family: mass });
    const expected = new Uint32Array(source.particleCount * source.format.wordCount);
    for (let row = 0; row < source.particleCount; row++) expected.set(observed.exactParticleWords.slice(
      row * layout.recordWords + 16, row * layout.recordWords + 16 + source.format.wordCount), row * source.format.wordCount);
    checks.originalMassOwnerExactLimbs = equal(await read(massRead.buffer), expected)
      && mass.generation === source.sourceInventoryGeneration + 1 && mass.physicalPublicationAdmitted === false;
    history = await publishResidentProductVaporHistoryWebGpu({ device, producerRead: held,
      inputResidentProductMass: source.sourceHistory });
    const origin = resolveResidentProductVaporHistoryPublication(history, { device, producerRead: held,
      inputResidentProductMass: source.sourceHistory });
    historyCleanup = origin.cleanupCompletion;
    const originalCount = resolveResidentProductEventCountAuthority(source.sourceHistory, device);
    const nextCount = resolveResidentProductEventCountAuthority(history, device);
    const countBefore = (await read(originalCount.controlBuffer)).slice(originalCount.controlOffsetBytes / 4);
    const countAfter = (await read(nextCount.controlBuffer)).slice(nextCount.controlOffsetBytes / 4);
    const words = await read(history.productEventBuffer), liveWords = countBefore[3] * origin.layout.rowWords;
    checks.originalArenaIssuesFreshCount = nextCount !== originalCount && nextCount.controlBuffer !== originalCount.controlBuffer
      && countAfter[0] === 0x50484731 && countAfter[1] === 1 && countAfter[2] === 1
      && countAfter[3] === countBefore[3] && countAfter[5] === origin.layout.rowWords / 4 && countAfter[11] === 0;
    checks.updatedHistoryPreserved = equal(words.slice(0, liveWords), observed.exactHistoryWords.slice(0, liveWords))
      && words.slice(liveWords).every(word => word === 0);
    const token = {};
    refresh = await runMlsMpmMechanicsRefreshWebGpu({ device, exactVaporProducerRead: held,
      sphParticleState: packet.sphParticleState, mlsMpmParticleState: packet.mlsMpmParticleState,
      sphParticleUpload: packet.originalSphParticleUpload, mlsMpmParticleUpload: packet.originalMlsMpmParticleUpload,
      mechanicsMaterialTable: packet.mechanicsMaterialTable,
      sourceStateBuffer: source.stateBuffer, sourceThermoBuffer: source.thermoBuffer,
      sourceMechanicsBuffer: source.mechanicsBuffer, postMechanicsSourceCapture: token,
      retainOutputParticleBuffers: true, readbackMode: 'no-full-readback' });
    refreshSeal = resolveMlsMpmMechanicsRefreshSourceCapture(refresh, token);
    checks.originalRefreshAccepted = (await read(refresh.authorityValidationBuffer))[0] === 0
      && refreshSeal.exactMechanics.source === source;
    const refreshed = await read(refreshSeal.exactMechanics.quantityBuffer);
    // Reference volume may be recomputed by the constitutive law. All other
    // exact quantities must survive this consumer bit for bit.
    const restStart = layout.scalarOffsetWords + 4 * layout.scalar.recordWords;
    const restEnd = restStart + layout.scalar.recordWords;
    checks.refreshPreservesOtherQuantities = refreshed.length === observed.exactParticleWords.length
      && refreshed.every((word, i) => (i % layout.recordWords >= restStart && i % layout.recordWords < restEnd)
        || word === observed.exactParticleWords[i]);
    checks.currentRetiresWithOutputConsumers = await releaseSphPostMechanicsGasStateAfterQueue(current, { device }) === true;
    checks.producerSurvivesCurrentRetirement = resolveSphSpatialVaporAerosolProducerRead(held, { device }) === source
      && equal(await read(source.endpoints.historyBuffer), observed.exactHistoryWords);
    checks.transitionSurvivesCurrentRetirement = validateSphAerosolCondensateTransition(transition, transitionContext);
    checks.unpublishedTransitionDiscarded = discardSphAerosolCondensateTransition(transition) === true;
    await transition.cleanupCompletion;
    refreshSeal.release();
    await refreshSeal.sourceCleanupCompletion();
    releaseSphSpatialVaporAerosolProducerRead(held); held = null;
    checks.candidateRetiredAfterConsumers = await candidateRetirement === true;
    checks.independentOwnersSurviveCandidate = equal(await read(massRead.buffer), expected)
      && equal(await read(history.productEventBuffer), words)
      && equal(await read(refreshSeal.exactMechanics.quantityBuffer), refreshed);
  } finally {
    await device.queue.onSubmittedWorkDone();
    if (transition) { discardSphAerosolCondensateTransition(transition); await transition.cleanupCompletion; }
    refreshSeal?.release();
    if (refreshSeal) await refreshSeal.sourceCleanupCompletion();
    refresh?.destroyOutputParticleBuffers();
    if (historyCleanup) await historyCleanup;
    if (history) await history.destroyResidentProductMassBuffers();
    if (massRead) await releaseSphExactMassRead(massRead);
    if (mass) releaseSphExactMassInventory(mass);
    if (held) releaseSphSpatialVaporAerosolProducerRead(held);
    if (candidateRetirement) await candidateRetirement;
  }
  const result = { checks, pass: Object.values(checks).every(Boolean) };
  if (!result.pass) throw new Error(`Exact vapor producer verification failed: ${JSON.stringify(result)}`);
  return result;
}
