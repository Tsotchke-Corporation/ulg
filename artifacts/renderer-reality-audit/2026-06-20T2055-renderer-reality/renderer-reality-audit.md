# Renderer Reality Audit

Generated: 2026-06-21T05:04:29.489999Z

Method: real HTTPS page on `https://127.0.0.1:5173`, real resident step/render refreshes, no manual browser-frame validation publication, screenshots analyzed from canvas/page pixels.

Important: screenshots are page-region captures over the canvas, so DOM status badges can appear at the top. Verdicts below are based on the scene content, telemetry, and long-motion frame diffs, not just any nonblack pixels.

| Mode | Verdict | Evidence |
| --- | --- | --- |
| `native-webgpu-surface-consumer` | **blank/blocked** | Canvas screenshot is visually black except DOM overlay; telemetry claims native render submit but visible consumer stays blocked with pixelValidation not-run and blocker resident-device-texture-readback-unavailable. Long diff: 10910 px (1.0676%); bridge=native-webgpu-surface-consumer; source=resident-surface-draw-native-webgpu-consumer; status=resident-surface-visible-gpu-consumer-blocked-pixel-validation; step 8 -> 264. Native console included WebGPU texture-readback destroyed-buffer warning. |
| `three-webgpu-surface-buffers` | **blocked/box-only** | Screenshot shows only the box/grid, no surface or particles. Telemetry bridge is resident-surface-buffers-no-overlay with no render bridge and visible consumer blocked-surface-extraction-required. Long diff: 3875 px (0.3784%); bridge=resident-surface-buffers-no-overlay; source=resident-render-field-buffers; status=resident-surface-visible-gpu-consumer-blocked-surface-extraction-required; step 8 -> 264. |
| `three-render-row-spheres` | **visible/moving** | Particles are visibly drawn as spheres and long-motion canvas diff changed 10574 pixels (1.0326%). Uses full-parity readback, not no-full GPU rendering. Long diff: 10574 px (1.0326%); bridge=three-render-row-spheres; source=resident-render-rows-three-instanced-spheres; status=resident-render-row-spheres-built; step 8 -> 264. |
| `three-render-row-points` | **visible/moving** | Particles are visibly drawn as points and long-motion canvas diff changed 4090 pixels (0.3994%). Uses full-parity readback, not no-full GPU rendering. Long diff: 4090 px (0.3994%); bridge=three-render-row-points; source=resident-render-rows-three-points; status=resident-render-row-points-built; step 8 -> 264. |
| `auto` | **blocked/minimal-dot-only** | Auto selects extension-resident-surface-buffers-no-overlay on WebGL; screenshot shows at most a tiny point/box, not a usable surface. Visible consumer is blocked-renderer-capability. Long diff: 66 px (0.0064%); bridge=extension-resident-surface-buffers-no-overlay; source=webgpu-marching-cubes-extension-same-device-surface; status=resident-surface-visible-gpu-consumer-blocked-renderer-capability; step 8 -> 264. |

Artifacts:
- Raw short capture: `artifacts/renderer-reality-audit/2026-06-20T2055-renderer-reality/capture-report.raw.json`
- Short analysis: `artifacts/renderer-reality-audit/2026-06-20T2055-renderer-reality/renderer-reality-analysis.json`
- Final analysis: `artifacts/renderer-reality-audit/2026-06-20T2055-renderer-reality/renderer-reality-audit-final.json`
- Contact sheet: `artifacts/renderer-reality-audit/2026-06-20T2055-renderer-reality/canvas-contact-sheet.png`
- Long-motion contact sheet: `artifacts/renderer-reality-audit/2026-06-20T2055-renderer-reality/long-motion-contact-sheet.png`
- Long-motion raw capture: `artifacts/renderer-reality-audit/2026-06-20T2055-renderer-reality-long-motion/long-motion.raw.json`
