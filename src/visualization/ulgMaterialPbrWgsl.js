// Shared Canonical Cook-Torrance GGX + Complex (n, k) Fresnel PBR WGSL Library
// (`src/visualization/ulgMaterialPbrWgsl.js`).
//
// Strictly Apple Metal / Safari WebGPU spec-safe (ascending smoothstep edges,
// non-negative clamped pow bases, zero division-by-zero singularities).
// Consumed identically across Elements Lab, Universes, Organic Lab, and Bio Lab
// to mirror MLS-MPM Studio's nativeSurfaceMaterialWgsl.js microfacet physics.

export const ULG_MATERIAL_PBR_WGSL = /* wgsl */ `
const ULG_PI: f32 = 3.14159265359;

fn ulg_srgb_to_linear(c: vec3<f32>) -> vec3<f32> {
  return pow(max(c, vec3<f32>(0.0)), vec3<f32>(2.2));
}

fn ulg_linear_to_srgb(c: vec3<f32>) -> vec3<f32> {
  return pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.2));
}

fn ulg_aces_filmic(x: vec3<f32>) -> vec3<f32> {
  let c = max(x, vec3<f32>(0.0));
  return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn ulg_complex_f0(n_rgb: vec3<f32>, k_rgb: vec3<f32>) -> vec3<f32> {
  let num = (n_rgb - vec3<f32>(1.0)) * (n_rgb - vec3<f32>(1.0)) + k_rgb * k_rgb;
  let den = (n_rgb + vec3<f32>(1.0)) * (n_rgb + vec3<f32>(1.0)) + k_rgb * k_rgb;
  return clamp(num / max(den, vec3<f32>(1e-5)), vec3<f32>(0.02), vec3<f32>(0.995));
}

fn ulg_dielectric_f0(ior: f32) -> f32 {
  let n = max(1.0, ior);
  let r = (n - 1.0) / (n + 1.0);
  return clamp(r * r, 0.015, 0.35);
}

fn ulg_fresnel_schlick(cos_theta: f32, f0: vec3<f32>) -> vec3<f32> {
  let x = clamp(1.0 - max(0.0, cos_theta), 0.0, 1.0);
  let x2 = x * x;
  return f0 + (vec3<f32>(1.0) - f0) * (x2 * x2 * x);
}

fn ulg_fresnel_schlick_rough(cos_theta: f32, f0: vec3<f32>, roughness: f32) -> vec3<f32> {
  let x = clamp(1.0 - max(0.0, cos_theta), 0.0, 1.0);
  let x2 = x * x;
  let max_f = max(vec3<f32>(1.0 - clamp(roughness, 0.04, 1.0)), f0);
  return f0 + (max_f - f0) * (x2 * x2 * x);
}

fn ulg_d_ggx(ndh: f32, roughness: f32) -> f32 {
  let r = clamp(roughness, 0.04, 1.0);
  let a = r * r;
  let a2 = a * a;
  let d = ndh * ndh * (a2 - 1.0) + 1.0;
  return a2 / max(ULG_PI * d * d, 1e-5);
}

fn ulg_v_smith_ggx(ndv: f32, ndl: f32, roughness: f32) -> f32 {
  let r = clamp(roughness, 0.04, 1.0);
  let a = r * r;
  let a2 = a * a;
  let ggx_v = ndl * sqrt(max(1e-6, ndv * ndv * (1.0 - a2) + a2));
  let ggx_l = ndv * sqrt(max(1e-6, ndl * ndl * (1.0 - a2) + a2));
  return 0.5 / max(ggx_v + ggx_l, 1e-5);
}

// Energy-conserving direct Cook-Torrance GGX + Lambert BRDF in linear light space
fn ulg_pbr_direct(
  n: vec3<f32>,
  v: vec3<f32>,
  l: vec3<f32>,
  albedo_lin: vec3<f32>,
  f0_rgb: vec3<f32>,
  metallic: f32,
  roughness: f32,
  radiance: vec3<f32>
) -> vec3<f32> {
  let ndl = max(0.0, dot(n, l));
  if (ndl <= 0.0) { return vec3<f32>(0.0); }
  let ndv = max(1e-4, dot(n, v));
  let h = normalize(l + v);
  let ndh = max(0.0, dot(n, h));
  let vdh = max(0.0, dot(v, h));

  let F = ulg_fresnel_schlick(vdh, f0_rgb);
  let D = ulg_d_ggx(ndh, roughness);
  let V = ulg_v_smith_ggx(ndv, ndl, roughness);
  let spec = D * V * F;
  let k_d = (vec3<f32>(1.0) - F) * (1.0 - clamp(metallic, 0.0, 1.0));
  let diff = k_d * albedo_lin / ULG_PI;
  return (diff + spec) * radiance * ndl;
}

// Analytic split-sum studio/sky hemisphere IBL (gives true colored conductor reflections & dielectric glazing)
fn ulg_pbr_env_hemi(
  n: vec3<f32>,
  v: vec3<f32>,
  albedo_lin: vec3<f32>,
  f0_rgb: vec3<f32>,
  metallic: f32,
  roughness: f32,
  sky_zen_lin: vec3<f32>,
  sky_hor_lin: vec3<f32>,
  ground_lin: vec3<f32>
) -> vec3<f32> {
  let ndv = max(1e-4, dot(n, v));
  let r_dir = reflect(-v, n);
  let r_up = clamp(r_dir.y, -1.0, 1.0);
  let n_up = clamp(n.y, -1.0, 1.0);

  let env_sharp = select(
    mix(sky_hor_lin, ground_lin, clamp(-r_up * 1.4, 0.0, 1.0)),
    mix(sky_hor_lin, sky_zen_lin, pow(clamp(r_up, 0.0, 1.0), 0.65)),
    r_up >= 0.0
  );
  let env_blur = mix(ground_lin, mix(sky_hor_lin, sky_zen_lin, 0.55), n_up * 0.5 + 0.5);
  let env_spec = mix(env_sharp, env_blur, clamp(roughness * roughness, 0.0, 1.0));

  let F_env = ulg_fresnel_schlick_rough(ndv, f0_rgb, roughness);
  let k_d = (vec3<f32>(1.0) - F_env) * (1.0 - clamp(metallic, 0.0, 1.0));
  let spec_atten = 1.0 - clamp(roughness, 0.04, 1.0) * 0.42;
  return k_d * albedo_lin * env_blur + F_env * env_spec * spec_atten;
}
`;
