import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const peercomputeRoot = fileURLToPath(new URL('../peercompute/peercompute', import.meta.url));

export default defineConfig({
  server: {
    fs: {
      allow: [
        repoRoot,
        peercomputeRoot
      ]
    }
  }
});
