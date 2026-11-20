// A6 (seven-goal-campaign.md): requester-side admission of remotely derived,
// provenance-bound artifacts. A request key binds the task kind, parameters
// and the service module identity. A miss calls `derive` once (single
// flight); the result waits as pending and is adopted only at the next
// schedule boundary, so a consumer never sees an artifact change mid-schedule.
// Hits never leave the requester. A source change (service package version or
// module identity) invalidates the entries derived from the old source.
import { schroederAuthorityTextFingerprint } from '../sph/schroederAuthorityFingerprint.js';

export const REMOTE_DERIVATION_ARTIFACT_SCHEMA = 'peercompute.ulg.remote-derivation-artifact.v1';

export function createRemoteDerivationArtifactCache({ derive, sourceIdentity } = {}) {
  if (typeof derive !== 'function') throw new TypeError('derive(request) is required');
  const live = new Map(), pending = new Map(), inflight = new Map();
  const log = [];
  let scheduleOrdinal = 0;
  let source = String(sourceIdentity ?? '');
  const counters = { hits: 0, misses: 0, derives: 0, failures: 0, adoptions: 0, invalidations: 0 };
  const keyOf = (request) => schroederAuthorityTextFingerprint(JSON.stringify({ source, kind: request.kind,
    params: request.params ?? {} }), 'remote-derivation-key');
  const record = (event, extra = {}) => log.push(Object.freeze({ event, scheduleOrdinal, ...extra }));
  return {
    log, counters,
    get scheduleOrdinal() { return scheduleOrdinal; },
    /** The adopted artifact, or null (a pending or missing one is not visible). */
    get(request) { return live.get(keyOf(request)) ?? null; },
    /** Derive on a miss (single flight); the result is pending until the boundary. */
    async request(request) {
      const key = keyOf(request);
      if (live.has(key)) { counters.hits += 1; record('hit', { key }); return { source: 'cache', artifact: live.get(key) }; }
      if (pending.has(key)) return { source: 'pending', artifact: null };
      counters.misses += 1;
      if (!inflight.has(key)) {
        inflight.set(key, (async () => {
          try {
            const derived = await derive(request);
            counters.derives += 1;
            const artifact = Object.freeze({ schema: REMOTE_DERIVATION_ARTIFACT_SCHEMA, key, source, request,
              value: derived.value, provenance: derived.provenance ?? null, derivedAtOrdinal: scheduleOrdinal });
            pending.set(key, artifact);
            record('derived', { key, peerId: derived.provenance?.peerId ?? null, role: derived.provenance?.role ?? null });
            return artifact;
          } catch (error) {
            counters.failures += 1;
            record('derive-failed', { key, reason: String(error?.message ?? error).slice(0, 200) });
            throw error;
          } finally { inflight.delete(key); }
        })());
      }
      await inflight.get(key);
      return { source: 'pending', artifact: null };
    },
    scheduleBoundary() {
      scheduleOrdinal += 1;
      for (const [key, artifact] of pending) {
        if (artifact.source !== source) { record('adoption-rejected-stale-source', { key }); continue; }
        live.set(key, artifact); counters.adoptions += 1; record('adopted', { key });
      }
      pending.clear();
      return scheduleOrdinal;
    },
    sourceChanged(nextSourceIdentity) {
      source = String(nextSourceIdentity ?? '');
      let dropped = 0;
      for (const [key, artifact] of live) if (artifact.source !== source) { live.delete(key); dropped += 1; }
      counters.invalidations += dropped;
      record('source-changed', { dropped });
      return dropped;
    }
  };
}
