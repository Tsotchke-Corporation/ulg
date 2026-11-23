import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NUCLEAR_DECAY_CHANNELS,
  ULG_CHERENKOV_CLOSURE_SCHEMA,
  ULG_ISOTOPE_INVENTORY_SCHEMA,
  ULG_NUCLEAR_CHANNEL_ABI_SCHEMA,
  evaluateCherenkovClosure,
  packNuclearChannelRows,
  relativisticBetaFromKineticEnergyMeV,
  stepIsotopeInventoryLedger
} from '../src/runtime/material/nuclearCherenkovClosure.js';
import {
  buildPeerComputeIceConfig,
  createLocalPeerRelayServer
} from '../src/services/localPeerRelayServer.js';
import {
  createRelaySignalingTransport,
  startClientDerivationRequester,
  startClientDerivationResponder
} from '../src/services/clientDerivationPeers.js';

// Deterministic task entrypoint loaded by PeerCompute ComputeManager on responders.
export function run(data) {
  const x = Number(data?.x) || 0;
  return {
    value: x * 2 + 1,
    service: data?.service || 'phase11-closure',
    commitDelta: { op: 'derive', x, result: x * 2 + 1 }
  };
}

// ---- Phase 8: Nuclear Decay, Deposition & Frank-Tamm Cherenkov Proofs ----

test('Phase 8: nuclear decay channels conserve exact nucleons & charge, emit thermal deposition, and stay honestly unvalidated', () => {
  const packed = packNuclearChannelRows();
  assert.equal(packed.schema, ULG_NUCLEAR_CHANNEL_ABI_SCHEMA);
  assert.equal(packed.rowCount, Object.keys(NUCLEAR_DECAY_CHANNELS).length);
  assert.equal(packed.data.length, packed.rowCount * packed.strideFloats);
  assert.equal(packed.validation.scientificValidation, false);

  const step = stepIsotopeInventoryLedger([
    { isotope: 'Co-60', atomCount: 1e18 },
    { isotope: 'U-238', atomCount: 1e20 }
  ], 3600);
  assert.equal(step.schema, ULG_ISOTOPE_INVENTORY_SCHEMA);
  assert.ok(step.nucleonConservationRelError < 1e-12, `nucleon conservation error ${step.nucleonConservationRelError}`);
  assert.ok(step.totalDecays > 0);
  assert.ok(step.depositedThermalEnergyJ > 0 && step.depositedThermalEnergyJ < step.totalReleasedEnergyJ);
  assert.ok(step.thermalPowerW > 0);
  assert.equal(step.validation.scientificValidation, false);

  const daughters = new Map(step.nextInventory.map((x) => [x.isotope, x.atomCount]));
  assert.ok((daughters.get('Ni-60') || 0) > 0, 'Co-60 beta-minus must produce Ni-60');
  assert.ok((daughters.get('Th-234') || 0) > 0 && (daughters.get('He-4') || 0) > 0, 'U-238 alpha must produce Th-234 + He-4');
});

test('Phase 8: Frank-Tamm Cherenkov closure fails closed below beta=1/n and produces CIE blue above threshold', () => {
  const sub = evaluateCherenkovClosure({ kineticEnergyMeV: 0.15, refractiveIndex: 1.333 });
  assert.equal(sub.schema, ULG_CHERENKOV_CLOSURE_SCHEMA);
  assert.equal(sub.active, false);
  assert.equal(sub.photonsPerMeter, 0);
  assert.deepEqual(sub.srgb, [0, 0, 0]);
  assert.equal(sub.validation.scientificValidation, false);

  const beta1 = relativisticBetaFromKineticEnergyMeV(1.0);
  assert.ok(beta1 > 0.93 && beta1 < 0.95);
  const sup = evaluateCherenkovClosure({ kineticEnergyMeV: 1.0, refractiveIndex: 1.333 });
  assert.equal(sup.active, true);
  assert.ok(sup.photonsPerMeter > 1e4, `expected realistic ~1.5e4-2.5e4 visible photons/m, got ${sup.photonsPerMeter}`);
  assert.ok(sup.cherenkovAngleDeg > 35 && sup.cherenkovAngleDeg < 39, `expected ~37.2 deg cone, got ${sup.cherenkovAngleDeg}`);
  assert.ok(sup.srgb[2] > sup.srgb[1] && sup.srgb[1] > sup.srgb[0], `Cherenkov glow must be CIE blue (b>g>r), got ${sup.srgb}`);
  assert.equal(sup.validation.scientificValidation, false);
});

// ---- Phase 11: Real Local WebSocket PeerCompute Relay + Quorum & Failure Modes ----

test('Phase 11: local WebSocket relay connects requester, responders, and observer with 2-of-2 quorum, failover on disconnect, disagreement rejection, and TURN ICE config', async () => {
  const ice = buildPeerComputeIceConfig({
    stunUrls: ['stun:stun.l.google.com:19302'],
    turnUrls: ['turn:turn.local:3478?transport=tcp'],
    turnUsername: 'ulg-test',
    turnCredential: 'scoped-local-token',
    iceTransportPolicy: 'relay'
  });
  assert.equal(ice.turnConfigured, true);
  assert.equal(ice.iceTransportPolicy, 'relay');
  assert.equal(ice.iceServers.length, 2);

  const relay = await createLocalPeerRelayServer({ host: '127.0.0.1', port: 0, iceConfig: ice });
  const room = 'phase11-quorum-room';
  const observerMessages = [];
  let observerTransport = null;
  let respB = null;
  let respC = null;
  let respD = null;
  let requester = null;
  const transports = [];

  try {
    const health = await fetch(relay.healthUrl).then((r) => r.json());
    assert.equal(health.ok, true);

    const makeTransport = (peerId) => {
      const t = createRelaySignalingTransport({
        relayUrl: relay.url,
        roomId: room,
        peerId,
        enableWebRtc: false
      });
      transports.push(t);
      return t;
    };

    observerTransport = makeTransport('observer-O');
    observerTransport.onMessage((env) => observerMessages.push(env));

    respB = startClientDerivationResponder({
      peerId: 'resp-B',
      nodeId: 'node-B',
      transport: makeTransport('resp-B'),
      announceIntervalMs: 60
    });
    respC = startClientDerivationResponder({
      peerId: 'resp-C',
      nodeId: 'node-C',
      transport: makeTransport('resp-C'),
      announceIntervalMs: 60
    });
    respD = startClientDerivationResponder({
      peerId: 'resp-D',
      nodeId: 'node-D',
      transport: makeTransport('resp-D'),
      announceIntervalMs: 60
    });

    requester = startClientDerivationRequester({
      peerId: 'req-A',
      primaryPeerId: 'resp-B',
      replicaPeerIds: ['resp-C', 'resp-D'],
      transport: makeTransport('req-A'),
      taskModuleUrl: import.meta.url,
      staleMs: 800,
      timeoutMs: 4000
    });

    // Wait until requester sees all 3 responders alive over real TCP WebSocket relay
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const alive = ['resp-B', 'resp-C', 'resp-D'].filter((id) => requester.presence.get(id)?.alive);
      if (alive.length === 3) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    assert.equal(
      ['resp-B', 'resp-C', 'resp-D'].filter((id) => requester.presence.get(id)?.alive).length,
      3,
      'requester must discover all 3 responders via local WebSocket relay'
    );

    // 1. Normal 2-of-2 quorum execution over real WebSocket relay + Observer witnessing traffic
    const r1 = await requester.submitWithProvenance('p11-quorum-1', { service: 'phase11', x: 20 });
    assert.equal(r1.value, 41);
    assert.ok(observerMessages.length > 0, 'observer must witness real relay room traffic');

    // 2. Failure mode: Primary responder B drops mid-session -> replica promotion to C & D!
    respB.stop();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(requester.presence.get('resp-B')?.alive, false);
    const r2 = await requester.submitWithProvenance('p11-failover-2', { service: 'phase11', x: 30 });
    assert.equal(r2.value, 61);
    assert.equal(r2.provenance?.role, 'promoted-replica');

    // 3. Failure mode: Corrupt responder D disagrees with honest responder C -> 2-of-2 quorum rejects fail-closed!
    respD.kernel._handleComputeTask = async (fromPeer, taskPayload) => {
      await respD.kernel.networkManager.sendToPeer(fromPeer, {
        type: 'compute-result',
        data: {
          taskId: taskPayload.taskId,
          requestId: taskPayload.requestId,
          status: 'completed',
          result: { value: 999999, service: 'tampered', commitDelta: { op: 'tampered' } }
        }
      });
    };
    await assert.rejects(
      () => requester.submitWithProvenance('p11-disagree-3', { service: 'phase11', x: 10 }),
      /quorum|mismatch|disagree|validation|failed/i
    );
  } finally {
    requester?.stop?.();
    respB?.stop?.();
    respC?.stop?.();
    respD?.stop?.();
    for (const t of transports) t.close();
    await relay.close();
  }
});
