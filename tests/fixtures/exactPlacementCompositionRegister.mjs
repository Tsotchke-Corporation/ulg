import { register } from 'node:module';

// Imported before any dynamic runtime/fixture import in these isolated Node
// test files. ESM caches this registration once per test-file process.
register(new URL('./exactPlacementCompositionLoader.mjs', import.meta.url), import.meta.url);
