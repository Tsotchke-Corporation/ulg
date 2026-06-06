export function formatHandoffAckStatus(ack = {}) {
  const status = String(ack.status || 'sent').replace(/[-_]+/g, ' ');
  const label = status.startsWith('handoff ') ? status : `handoff ${status}`;
  const blockerCount = ack.blockerCount ?? '?';
  const parts = [`${label} / blockers ${blockerCount}`];
  const scenarioId = formatAckValue(ack.scenarioId);
  if (scenarioId) {
    parts.push(`scenario ${scenarioId}`);
  }
  const simulationStatus = formatAckValue(ack.simulationStatus);
  if (simulationStatus) {
    parts.push(simulationStatus);
  }
  if (Number.isFinite(ack.artifactCount)) {
    parts.push(`${ack.artifactCount} artifacts`);
  }
  return parts.join(' / ');
}

function formatAckValue(value) {
  const text = String(value || '').trim().replace(/[-_]+/g, ' ');
  return text || null;
}
