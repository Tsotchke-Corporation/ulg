import { hashPayload } from '../../ulg-gpu-abi/src/index.js';
import { summarizeUlgArtifact } from './artifactSummary.js';

export class ArtifactCache {
  constructor() {
    this.records = new Map();
  }

  async put(artifact) {
    const artifactHash = hashPayload(artifact);
    const ref = {
      uri: `artifact://${artifactHash}`,
      artifactHash,
      sourceService: artifact.sourceService,
      createdAt: Date.now()
    };
    this.records.set(ref.uri, { ref, artifact, artifactSummary: summarizeUlgArtifact(artifact) });
    return ref;
  }

  async get(ref) {
    return this.records.get(ref.uri)?.artifact;
  }

  async getSummary(ref) {
    return this.records.get(ref.uri)?.artifactSummary;
  }

  async announce(ref) {
    return {
      ref,
      announcedAt: Date.now(),
      status: 'local-only'
    };
  }

  list() {
    return [...this.records.values()].map(({ ref, artifact, artifactSummary }) => ({
      ref,
      artifactKind: artifactSummary?.artifactKind ?? artifact.closureKind ?? artifact.taskKind ?? 'unknown',
      artifactSummary
    }));
  }
}
