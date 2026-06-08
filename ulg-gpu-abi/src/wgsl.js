export const commonWgsl = `
struct TensorDescriptor {
  offset_words: u32,
  length_words: u32,
  dtype: u32,
  layout: u32,
};

struct ClosureTableSample {
  axis: f32,
  value: f32,
  derivative: f32,
  _pad0: f32,
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

export const carrierStepWgsl = `
${commonWgsl}

struct CarrierBody {
  x: f32,
  v: f32,
  mass: f32,
  _pad0: f32,
};

struct CarrierParams {
  dt: f32,
  sample_count: u32,
  step: u32,
  _pad0: u32,
};

@group(0) @binding(0) var<storage, read_write> bodies: array<CarrierBody>;
@group(0) @binding(1) var<storage, read> samples: array<ClosureTableSample>;
@group(0) @binding(2) var<uniform> params: CarrierParams;

fn sample_derivative(r: f32) -> f32 {
  if (params.sample_count <= 1u) {
    return 0.0;
  }
  var left_index = 0u;
  var right_index = params.sample_count - 1u;
  for (var index = 0u; index + 1u < params.sample_count; index = index + 1u) {
    let left = samples[index].axis;
    let right = samples[index + 1u].axis;
    if (r >= left && r <= right) {
      left_index = index;
      right_index = index + 1u;
      break;
    }
  }
  let left = samples[left_index];
  let right = samples[right_index];
  if (right.axis == left.axis) {
    return left.derivative;
  }
  let t = clamp((r - left.axis) / (right.axis - left.axis), 0.0, 1.0);
  return left.derivative + t * (right.derivative - left.derivative);
}

fn pair_forces(left_x: f32, right_x: f32) -> vec2<f32> {
  let dx = right_x - left_x;
  let r = abs(dx);
  var direction = 1.0;
  if (dx < 0.0) {
    direction = -1.0;
  }
  let dEdr = sample_derivative(r);
  return vec2<f32>(dEdr * direction, -dEdr * direction);
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x > 0u) {
    return;
  }
  let dt = params.dt;
  let first = pair_forces(bodies[0].x, bodies[1].x);
  var left_v = bodies[0].v + 0.5 * (first.x / bodies[0].mass) * dt;
  var right_v = bodies[1].v + 0.5 * (first.y / bodies[1].mass) * dt;
  bodies[0].x = bodies[0].x + left_v * dt;
  bodies[1].x = bodies[1].x + right_v * dt;
  let second = pair_forces(bodies[0].x, bodies[1].x);
  left_v = left_v + 0.5 * (second.x / bodies[0].mass) * dt;
  right_v = right_v + 0.5 * (second.y / bodies[1].mass) * dt;
  bodies[0].v = left_v;
  bodies[1].v = right_v;
}
`;
