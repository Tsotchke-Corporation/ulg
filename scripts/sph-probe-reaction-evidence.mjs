function finiteEventCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

export function groupedReactionEventCount(records = []) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const byReaction = new Map();
  for (const record of records) {
    const eventCount = finiteEventCount(record?.eventCount);
    if (eventCount == null) continue;
    const reactionIndex = Number(record?.reactionIndex);
    // Missing reaction identity is deliberately one conservative group. It
    // may undercount ambiguous independent reactions, but it cannot multiply
    // one reaction merely because it emitted several product terms.
    const key = Number.isFinite(reactionIndex)
      ? `reaction:${Math.round(reactionIndex)}`
      : 'reaction:unknown';
    byReaction.set(key, Math.max(byReaction.get(key) ?? 0, eventCount));
  }
  if (byReaction.size === 0) return null;
  return [...byReaction.values()].reduce((sum, count) => sum + count, 0);
}

export function reactionLedgerEventCount(evidence = null) {
  const counts = [
    groupedReactionEventCount(evidence?.productInventory?.records),
    groupedReactionEventCount(evidence?.gasSpeciesLedger?.records)
  ].filter((count) => count != null);
  return counts.length ? Math.max(...counts) : null;
}
