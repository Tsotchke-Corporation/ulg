export const commonWgsl = `
struct TensorDescriptor {
  offset_words: u32,
  length_words: u32,
  dtype: u32,
  layout: u32,
};

fn complex64_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    a.x * b.x - a.y * b.y,
    a.x * b.y + a.y * b.x
  );
}

fn complex64_norm2(value: vec2<f32>) -> f32 {
  return dot(value, value);
}
`;
