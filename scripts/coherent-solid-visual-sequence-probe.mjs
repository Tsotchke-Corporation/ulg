process.env.ULG_SOLID_PRODUCTION_INJECTION = '1';
process.env.ULG_SOLID_PRODUCTION_BASE_URL =
  process.env.ULG_SOLID_VISUAL_BASE_URL || process.env.ULG_SOLID_PRODUCTION_BASE_URL || '';
process.env.ULG_SOLID_PRODUCTION_OUTPUT =
  process.env.ULG_SOLID_VISUAL_OUTPUT || '/tmp/ulg-coherent-solid-visual-sequence.json';
process.env.ULG_SOLID_PRODUCTION_FRAME_DIR =
  process.env.ULG_SOLID_VISUAL_FRAME_DIR || '/tmp/ulg-coherent-solid-visual-sequence';

await import('./coherent-solid-production-bridge-probe.mjs');
