// Exact copy of buildGgxPrefilteredLatlongMips in sphPhaseScene.js.
// Kept as a dependency-free leaf so the worker can reuse the page's existing
// GGX prefilter without importing the scene. The page definition deliberately
// remains unchanged in this slice; the equality regression must stay green
// until a separately scoped cleanup can replace that duplicate with an import.
// Inputs are display-encoded RGBA8; filtering is linear-light (gamma 2.2),
// with the existing Karis N=V=R split-sum convention and 64-sample default.
export function buildGgxPrefilteredLatlongMips({
  pixels,
  width,
  height,
  mipLevelCount,
  sampleCount = 64
} = {}) {
  const baseW = Math.max(1, Math.round(Number(width) || 0));
  const baseH = Math.max(1, Math.round(Number(height) || 0));
  const mips = Math.max(1, Math.round(Number(mipLevelCount) || 1));
  const samples = Math.max(1, Math.round(Number(sampleCount) || 1));
  // Linear-light base for bilinear taps.
  const linear = new Float32Array(baseW * baseH * 3);
  for (let i = 0; i < baseW * baseH; i += 1) {
    linear[i * 3 + 0] = Math.pow((pixels[i * 4 + 0] || 0) / 255, 2.2);
    linear[i * 3 + 1] = Math.pow((pixels[i * 4 + 1] || 0) / 255, 2.2);
    linear[i * 3 + 2] = Math.pow((pixels[i * 4 + 2] || 0) / 255, 2.2);
  }
  const sampleBase = (u, v, out) => {
    // Bilinear, wrap in u (azimuth), clamp in v (polar).
    const x = u * baseW - 0.5;
    const y = Math.min(Math.max(v * baseH - 0.5, 0), baseH - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const xa = ((x0 % baseW) + baseW) % baseW;
    const xb = (xa + 1) % baseW;
    const ya = Math.min(Math.max(y0, 0), baseH - 1);
    const yb = Math.min(ya + 1, baseH - 1);
    for (let c = 0; c < 3; c += 1) {
      const a = linear[(ya * baseW + xa) * 3 + c] * (1 - fx) + linear[(ya * baseW + xb) * 3 + c] * fx;
      const b = linear[(yb * baseW + xa) * 3 + c] * (1 - fx) + linear[(yb * baseW + xb) * 3 + c] * fx;
      out[c] = a * (1 - fy) + b * fy;
    }
  };
  const levels = [];
  let levelW = baseW;
  let levelH = baseH;
  const tap = [0, 0, 0];
  for (let level = 0; level < mips; level += 1) {
    const out = new Uint8ClampedArray(levelW * levelH * 4);
    if (level === 0) {
      // Roughness 0: the base image unchanged.
      for (let i = 0; i < levelW * levelH; i += 1) {
        out[i * 4 + 0] = pixels[i * 4 + 0];
        out[i * 4 + 1] = pixels[i * 4 + 1];
        out[i * 4 + 2] = pixels[i * 4 + 2];
        out[i * 4 + 3] = 255;
      }
    } else {
      const roughness = level / Math.max(1, mips - 1);
      const alpha = roughness * roughness;
      // Tangent-space GGX half-vectors from the Hammersley set — identical for
      // every texel at this roughness, so precompute once per level.
      const dirs = new Float32Array(samples * 3);
      for (let i = 0; i < samples; i += 1) {
        const e1 = (i + 0.5) / samples;
        // Radical inverse base 2.
        let bits = i;
        bits = ((bits << 16) | (bits >>> 16)) >>> 0;
        bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
        bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
        bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
        bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
        const e2 = bits * 2.3283064365386963e-10;
        const phi = 2 * Math.PI * e1;
        const cosTheta = Math.sqrt((1 - e2) / (1 + (alpha * alpha - 1) * e2));
        const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
        dirs[i * 3 + 0] = Math.cos(phi) * sinTheta;
        dirs[i * 3 + 1] = Math.sin(phi) * sinTheta;
        dirs[i * 3 + 2] = cosTheta;
      }
      for (let ty = 0; ty < levelH; ty += 1) {
        const vPolar = ((ty + 0.5) / levelH) * Math.PI;
        const ny = Math.cos(vPolar);
        const rh = Math.sin(vPolar);
        for (let tx = 0; tx < levelW; tx += 1) {
          const azim = (((tx + 0.5) / levelW) - 0.5) * 2 * Math.PI;
          // N = V = R for the split-sum prefilter.
          const nx = Math.cos(azim) * rh;
          const nz = Math.sin(azim) * rh;
          // Orthonormal basis around N.
          const upIsY = Math.abs(ny) < 0.999;
          let t0x = upIsY ? 0 : 1;
          let t0y = upIsY ? 1 : 0;
          const t0z = 0;
          let tx0 = t0y * nz - t0z * ny;
          let tx1 = t0z * nx - t0x * nz;
          let tx2 = t0x * ny - t0y * nx;
          const tlen = Math.hypot(tx0, tx1, tx2) || 1;
          tx0 /= tlen; tx1 /= tlen; tx2 /= tlen;
          const bx = ny * tx2 - nz * tx1;
          const by = nz * tx0 - nx * tx2;
          const bz = nx * tx1 - ny * tx0;
          let accR = 0;
          let accG = 0;
          let accB = 0;
          let accW = 0;
          for (let i = 0; i < samples; i += 1) {
            const hx = dirs[i * 3 + 0] * tx0 + dirs[i * 3 + 1] * bx + dirs[i * 3 + 2] * nx;
            const hy = dirs[i * 3 + 0] * tx1 + dirs[i * 3 + 1] * by + dirs[i * 3 + 2] * ny;
            const hz = dirs[i * 3 + 0] * tx2 + dirs[i * 3 + 1] * bz + dirs[i * 3 + 2] * nz;
            const ndoth = nx * hx + ny * hy + nz * hz;
            const lx = 2 * ndoth * hx - nx;
            const ly = 2 * ndoth * hy - ny;
            const lz = 2 * ndoth * hz - nz;
            const ndotl = nx * lx + ny * ly + nz * lz;
            if (ndotl <= 0) continue;
            const u = Math.atan2(lz, lx) * 0.15915494 + 0.5;
            const v = Math.acos(Math.min(Math.max(ly, -1), 1)) * 0.31830989;
            sampleBase(u, v, tap);
            accR += tap[0] * ndotl;
            accG += tap[1] * ndotl;
            accB += tap[2] * ndotl;
            accW += ndotl;
          }
          const w = accW > 0 ? 1 / accW : 0;
          const o = (ty * levelW + tx) * 4;
          out[o + 0] = Math.round(Math.pow(Math.min(Math.max(accR * w, 0), 1), 1 / 2.2) * 255);
          out[o + 1] = Math.round(Math.pow(Math.min(Math.max(accG * w, 0), 1), 1 / 2.2) * 255);
          out[o + 2] = Math.round(Math.pow(Math.min(Math.max(accB * w, 0), 1), 1 / 2.2) * 255);
          out[o + 3] = 255;
        }
      }
    }
    levels.push({ width: levelW, height: levelH, pixels: out });
    levelW = Math.max(1, levelW >> 1);
    levelH = Math.max(1, levelH >> 1);
  }
  return levels;
}
