# Full-Spectrum Dual-Caret EM Sensor Stack (`10⁻¹³ m` Gamma → `10¹ m` Radio)

> **Status:** Active Priority #4 (`plan/todo/` — hardened 2026-11-25 against live shader ABI audit).
> **Origin:** User request (`step 19124`): an interactive EM sensor slider with **two movable carets** (`[λ_min ◀━━━▶ λ_max]`) spanning the entire electromagnetic spectrum, mapping relative physical emissions between the two carets smoothly onto the human visible color spectrum (`violet → blue → cyan → green → yellow → red`).
> **Invariants:** Zero new bind groups across all 10 existing 3D shaders; bit-exact visible identity (`sensorActive < 0.5`); overflow-safe `f32` Planck $B(\lambda, T)$; Safari/Metal-safe WGSL.

---

## 1. Exact 16-Byte Aligned GPU Uniform ABI (`ulgUniversesRenderer.js`)

- Expand `CameraUniforms` (`176 B -> 208 B`, `44 -> 52 f32`) across `camBuf`, `cloudCamBufs[0..3]`, `auxCamBuf`, and `spaceMeshCamBuf`:
  - `em_sensor: vec4<f32>` (`@offset 176`): `(log10LambdaMin [-13..+1], log10LambdaMax [-13..+1], sensorActive [0|1], gain)`
  - `em_aux: vec4<f32>` (`@offset 192`): `(ambientTempK, sunElevOrFlux, skyOpticalDepth, flags)`
- Expand `PostUniforms` (`48 B -> 64 B`, `12 -> 16 f32`):
  - `em_sensor: vec4<f32>` (`@offset 48`): `(log10LambdaMin, log10LambdaMax, sensorActive, gain)`
- Because all 10 3D shaders already include `${CAMERA_WGSL}` at `@group(0) @binding(0)`, **every scale `L0..L7` + Surface receives `em_sensor` with 0 extra bind groups and 0 extra storage buffers**.

---

## 2. Shared Overflow-Safe `EM_SENSOR_WGSL` Spectral Engine

- **Bit-Exact Default Bypass:** `if (em_win.z < 0.5) { return vis_rgb; }` — zero visual shift and zero ALU overhead when the sensor is in native Human Visible mode (`380–750 nm`).
- **3-Subband Continuous False-Color Mapping:**
  - Sample `logLam_B = mix(min, max, 0.17)`, `logLam_G = mix(min, max, 0.50)`, `logLam_R = mix(min, max, 0.83)`.
  - Shortest wavelength caret (`λ_min`, highest energy) maps to **Violet/Blue**, midpoint to **Green**, longest wavelength caret (`λ_max`, lowest energy) to **Red**.
- **Overflow-Safe `f32` Planck Blackbody $B(\lambda, T)$:**
  - `log10_x = -1.842006 - log10_lam - log10(max(2.7, temp_k))`, clamped to `[-8.0, 1.9]` so `x = pow(10.0, log10_x) ∈ [1e-8, 79.4]` never overflows `exp(x)` on any GPU.
  - Use Rayleigh–Jeans asymptote `1 / x` for `x < 1e-3`, exact `1 / (exp(x) - 1)` otherwise, normalized cleanly against Wien peak across the active passband.
- **Physical Non-Thermal + Line Channels Integrated Per Shader:**
  - **Surface (`SURFACE_MESH_WGSL`):** `deform_field.y` molten crater/laser `tempK`, magma fissures (`1850 K`), Rover MMRTG (`550 K`), ambient `em_aux.x` → molten craters/lava blaze bright in Thermal IR (`3–15 μm`) on the pitch-black night side while cold rock dims!
  - **Stars & Planets (`LIT_SPHERE_WGSL`):** Star `T_eff`, Dyson `350–500 K` IR waste-heat shell, planetary surface `tempK`, polar aurora UV (`av.w`), lightning/Jovian synchrotron RF (`av.z`), indigenous civilization narrowband radio (`civTechK >= 0.5`).
  - **Particles & Disks (`PARTICLE_CLOUD_WGSL`, `DISK_WGSL`):** `L0` hot X-ray cluster WHIM vs dark DM; `L1` O/B UV arms, FIR dust, `21 cm` HI neutral hydrogen spiral arms; `L2` Kerr disk `10⁷ K` X-ray inner edge + cold `80 K` ice rings + relativistic synchrotron jets; `L3` live `log_t` stellar plasma; `L0` eras (`2.725 K` CMB microwave, Reionization `21 cm` RF, Bullet Cluster X-ray ICM); `511 keV` antimatter gamma flash.

---

## 3. Dual-Caret Interactive Slider UI (`universes.html` + `ulgUniversesDemo.js`)

- Dual-handle logarithmic range bar spanning `log10(λ / m) ∈ [-13.0, +1.0]` with labeled band ticks (`γ`, `X`, `UV`, `VIS`, `NIR`, `MIR`, `FIR`, `μW`, `RF`), reusing `evaluateEmWavelengthInfo()` (`ufoWeaponsAndPhysicsGpu.js:49-109`):
  - Drag left caret (`λ_min`) or right caret (`λ_max`) independently (with safe min width `0.15 dec`), OR drag the highlighted spectral rainbow bar between them to slide the entire window smoothly up and down the EM spectrum!
  - **1-Click Scientific Presets:** `👁 Visible (380–750 nm)`, `🔥 Thermal IR (3–15 μm)`, `📡 21 cm Radio`, `🌌 CMB Microwave (0.5–5 mm)`, `⚡ EUV / Aurora`, `☢️ X-Ray / γ`.
  - Expose `api.setEmSensorWindow({ log10LambdaMin, log10LambdaMax, active, gain })` for programmatic & hand-driven verification.

---

## 4. Verification Plan

- Host unit tests verifying `EM_SENSOR_WGSL` compilation invariants, uniform byte offsets (`208 B` / `64 B`), Wien/Planck peak ordering, and exact visible identity.
- Native Vulkan tests + hand-driven Playwright slider drag verifying: (1) Visible mode matches baseline bit-for-bit; (2) Thermal IR lights up molten laser/missile craters on night-side surface while cold rock dims; (3) Radio / X-Ray / CMB presets produce distinct physical contrasts on `L0..L4` without NaN or GPU errors.
