export const sphGasConstitutiveWgsl = /* wgsl */ `
fn gas_constitutive_finite(x: f32) -> bool {
  return x == x && abs(x) <= 3.402823e38;
}

fn gas_constitutive_sound_speed(law: vec4<f32>, temperature_k: f32) -> f32 {
  if (!all(law == law) || !all(abs(law) <= vec4<f32>(3.402823e38))
      || !(law.x > 0.0) || any(law.yzw < vec3<f32>(0.0))
      || !(temperature_k > 0.0) || !gas_constitutive_finite(temperature_k)) {
    return -1.0;
  }
  let c2 = law.x * temperature_k;
  if (!(c2 > 0.0) || !gas_constitutive_finite(c2)) { return -1.0; }
  let real_c = sqrt(c2);
  var c = real_c * law.y;
  if (law.z > 0.0) { c = min(real_c, law.z); }
  c = max(c, law.w);
  if (!(c > 0.0) || !gas_constitutive_finite(c)) { return -1.0; }
  return c;
}
`;
