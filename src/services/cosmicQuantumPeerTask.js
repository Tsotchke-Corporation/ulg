/**
 * Deterministic PeerCompute responder derivation task for the Cosmic <-> Quantum
 * distributed mesh (`startLiveClientDerivationPeerMesh`).
 *
 * Executed inside responder browser contexts via PeerCompute `ComputeManager`
 * over WebSocket/WebRTC relays and validated by 2-of-2 quorum hashing.
 */

import { deriveElementProperties } from '../runtime/material/elementClosures.js';
import { evaluateCherenkovClosure } from '../runtime/material/nuclearCherenkovClosure.js';

export const COSMIC_QUANTUM_PEER_TASK_SCHEMA = 'peercompute.ulg.cosmic-quantum-peer-task.v1';

export async function run(data = {}) {
  const kind = String(data?.kind || 'material.resolve-element');
  const payload = data?.payload || data || {};

  if (kind === 'nuclear.cherenkov') {
    const kineticEnergyMeV = Number(payload.kineticEnergyMeV ?? 0);
    // Fail closed to vacuum (n = 1.0) when refractiveIndex is omitted (never silently assume H2O 1.333)
    const refractiveIndex = Number.isFinite(Number(payload.refractiveIndex)) && Number(payload.refractiveIndex) >= 1.0
      ? Number(payload.refractiveIndex)
      : 1.0;
    const ch = evaluateCherenkovClosure({ kineticEnergyMeV, refractiveIndex });
    const value = {
      schema: COSMIC_QUANTUM_PEER_TASK_SCHEMA,
      kind,
      active: ch.active,
      beta: Number(ch.beta.toFixed(6)),
      cherenkovAngleDeg: Number(ch.cherenkovAngleDeg.toFixed(4)),
      photonsPerMeter: Math.round(ch.photonsPerMeter),
      scientificValidation: false
    };
    return {
      value,
      commitDelta: {
        taskId: `cq-peer:${kind}:${kineticEnergyMeV}:${refractiveIndex}`,
        scope: 'cosmic-quantum-peer-mesh',
        payload: value
      }
    };
  }

  const rawZ = Number(payload.atomicNumberZ);
  if (!Number.isInteger(rawZ) || rawZ < 1 || rawZ > 118) {
    throw new RangeError(`cosmicQuantumPeerTask requires an explicit integer atomicNumberZ in [1, 118], got ${payload.atomicNumberZ}`);
  }
  const atomicNumberZ = rawZ;
  const functional = String(payload.functional || 'pbe').toLowerCase();
  const props = deriveElementProperties(atomicNumberZ, {
    functional,
    scalarRelativistic: true,
    spinOrbit: true,
    includeGasPhase: true,
    gridPointsN: 260
  });
  const value = {
    schema: COSMIC_QUANTUM_PEER_TASK_SCHEMA,
    kind: 'material.resolve-element',
    atomicNumberZ,
    symbol: props.symbol,
    functional,
    bondingClass: props.bondingClass,
    standardPhaseAt298K: props.standardPhaseAt298K,
    meltingPointK: Math.round(props.meltingPointK ?? props.vdwGasProperties?.meltingPointK ?? 0),
    boilingPointK: Math.round(props.boilingPointK ?? props.vdwGasProperties?.boilingPointK ?? 0),
    densityKgPerM3: Math.round(props.densityKgPerM3 ?? props.vdwGasProperties?.condensedDensityKgPerM3 ?? 0),
    bulkModulusGPa: Number((((props.bulkModulusPa ?? props.vdwGasProperties?.bulkModulusPa ?? 0) / 1e9)).toFixed(2)),
    closureBacked: true,
    scientificValidation: false
  };
  return {
    value,
    commitDelta: {
      taskId: `cq-peer:element:${atomicNumberZ}:${functional}`,
      scope: 'cosmic-quantum-peer-mesh',
      payload: value
    }
  };
}
