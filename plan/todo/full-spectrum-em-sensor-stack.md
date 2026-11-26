# Full-Spectrum Dual-Caret EM Sensor Stack (`10⁻¹³ m` Gamma → `10¹ m` Radio)

> **Status:** Planned Priority #4 (`plan/todo/`).
> **Origin:** Requested by `big dog` (`step 19124`): an interactive EM sensor slider with **two movable carets** (`[λ_min ◀━━━▶ λ_max]`) spanning the entire electromagnetic spectrum, mapping relative physical emissions between the two carets smoothly onto the human visible color spectrum (`violet → blue → cyan → green → yellow → red`).

---

## 1. User Interaction & Visual Design

- **Dual-Caret Logarithmic Spectrum Control:**
  - Spans `log10(λ / m) ∈ [-13.0, +1.0]` (`100 fm` Gamma Ray → `10 m` Radio) with labeled band ticks (`γ`, `X`, `UV`, `VIS`, `NIR`, `MIR`, `FIR`, `μW`, `RF`).
  - **Left Caret (`λ_min`, high energy / short wavelength)** maps to **Violet (`400 nm`)** in the false-color eye output.
  - **Right Caret (`λ_max`, low energy / long wavelength)** maps to **Deep Red (`700 nm`)** in the false-color eye output.
  - Dragging either caret independently widens/narrows the passband; dragging the middle span glides the whole window continuously up and down the EM spectrum!
  - **1-Click Presets:** `👁 Human Visible (380–750 nm)`, `🔥 Thermal IR (3–15 μm)`, `📡 21 cm Radio / Synchrotron`, `🌌 CMB Microwave (0.5–5 mm)`, `⚡ EUV / Solar Corona`, `☢️ X-Ray / Gamma`.

---

## 2. Physical Emission Channels Across All 40 Orders of Magnitude

Rather than tinting RGB screenshots with a fake color filter, each WebGPU renderer computes (or encodes in HDR channels) true physical spectral radiance `I(λ)` integrated across `[λ_min, λ_max]` and projected onto 3 perceptual sub-bands `[Blue-edge, Green-mid, Red-edge]` inside the active caret window:

| Band (`λ`) | What lights up physically across ULG (`L0 → L7` & Surface) |
|---|---|
| **Gamma (`< 10⁻¹¹ m`)** | Antimatter `511 keV` annihilation craters & beams, pulsar/magnetar giant flares, blazar relativistic jets, nuclear `γ`-decay lines |
| **X-Ray (`10⁻¹¹ .. 10⁻⁸ m`)** | Accretion disks around SMBHs & X-ray binaries, galaxy-cluster Bremsstrahlung ICM (`T ~ 10⁷–10⁸ K`), stellar coronae, high-power Coulomb laser plasma |
| **Ultraviolet (`10 nm .. 380 nm`)** | Hot O/B/Pop-III stars, star-forming spiral arms, planetary polar aurorae, UV photoionization nebulae |
| **Visible (`380 .. 750 nm`)** | Default true-color photometric reflectance, Rayleigh atmospheres, oceans, photosynthetic/alien flora, Balmer `Hα`/`[O III]` emission |
| **Near / Mid / Far Infrared (`0.75 μm .. 1 mm`)** | True Planck blackbody `B(λ, T)` — molten lava & laser-melted craters blaze bright; cool M-dwarfs & brown dwarfs pop; warm nebular dust lanes glow; planets radiate night-side thermal heat; warm lifeforms / cities stand out! |
| **Microwave (`1 mm .. 30 cm`)** | `2.725 K` CMB acoustic anisotropies, cold molecular cloud cores, polar `H₂O` absorption bands |
| **Radio (`> 30 cm`)** | `21 cm` neutral hydrogen (`HI`) galactic spiral arms, pulsar radio beams, planetary Jovian synchrotron belts, and emergent alien civilization narrowband technosignatures! |

---

## 3. GPU-Native Implementation Plan

1. Add `em_window: vec4<f32>` (`log10LambdaMin, log10LambdaMax, enabled, gain`) to `CameraUniforms` / `PostUniforms` (`ulgUniversesRenderer.js`).
2. Add a shared WGSL spectral-response helper `eval_em_sensor_rgb(temp_k, albedo_rgb, radio_em, xray_em, uv_em, em_win)` using exact Planck `B(λ, T)` sampling at 3 wavelengths (`λ_lo`, `λ_mid`, `λ_hi`) inside `[λ_min, λ_max]` — zero LUT hacks, 100% continuous as the two carets slide!
3. Verify with unit + Vulkan tests that sliding carets to `Thermal IR` reveals hot lava/craters on the night side while cold rock dims, sliding to `Visible` matches canonical true-color rendering bit-for-bit, and sliding to `X-Ray` lights up hot accretion disks / cluster ICM / antimatter strikes!
