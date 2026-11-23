/**
 * True WebGPU 3D Volumetric Orbital Raymarcher (`three/tsl` + `Data3DTexture`).
 *
 * Samples live Kohn-Sham radial electron density `rho(r)` modulated by exact
 * real spherical harmonics `Y_lm(theta, phi)` into a 3D volume texture and
 * raymarches it front-to-back in local object space via `three/tsl`
 * (`texture3D` + `Loop` + `modelWorldMatrixInverse`), preserving honest
 * provenance labels (`radial-atomic-density-reconstruction` for total density;
 * `spherical-harmonic-basis-projection` for individual (l, m) lobes).
 */

export const VOLUMETRIC_ORBITAL_MODES = Object.freeze([
  { id: 'total-density', label: 'Total ρ(r)', l: -1, m: 0, provenance: 'radial-atomic-density-reconstruction' },
  { id: 's', label: 's (l=0)', l: 0, m: 0, provenance: 'spherical-harmonic-basis-projection' },
  { id: 'p_z', label: 'p_z (l=1)', l: 1, m: 0, provenance: 'spherical-harmonic-basis-projection' },
  { id: 'd_z2', label: 'd_z² (l=2)', l: 2, m: 0, provenance: 'spherical-harmonic-basis-projection' },
  { id: 'd_xy', label: 'd_xy (l=2)', l: 2, m: -2, provenance: 'spherical-harmonic-basis-projection' },
  { id: 'f_xyz', label: 'f_xyz (l=3)', l: 3, m: -2, provenance: 'spherical-harmonic-basis-projection' }
]);

export function evaluateRealSphericalHarmonic(modeId, ux, uy, uz) {
  switch (modeId) {
    case 's':
      return 0.56418958;
    case 'p_z':
      return uy; // cos(theta) along Y axis
    case 'd_z2':
      return 0.5 * (3 * uy * uy - 1);
    case 'd_xy':
      return 2.0 * ux * uz;
    case 'f_xyz':
      return 3.8729833 * ux * uy * uz;
    case 'total-density':
    default:
      return 1.0;
  }
}

/**
 * Sample a 3D RGBA8 orbital/density volume (`dim × dim × dim`) from a live
 * Kohn-Sham radial profile (`artifact.radialProfile.samples`) and spherical
 * harmonic mode.
 *   R = positive-phase amplitude |psi_+|
 *   G = negative-phase amplitude |psi_-|
 *   B = normalized radial shell coordinate (core=0 -> valence=1)
 *   A = volumetric optical density
 */
export function buildOrbitalVolumeData({
  radialSamples = [],
  rMaxBohr = 6.0,
  r95Bohr = 3.0,
  modeId = 'total-density',
  dim = 40
} = {}) {
  const n = Math.max(16, Math.min(64, Math.floor(dim)));
  const data = new Uint8Array(n * n * n * 4);
  if (!Array.isArray(radialSamples) || radialSamples.length < 2) {
    return { data, dim: n, peak: 0 };
  }

  const rLimit = Math.max(1.5, Math.min(rMaxBohr, r95Bohr * 1.45));
  const rawPos = new Float32Array(n * n * n);
  const rawNeg = new Float32Array(n * n * n);
  const rawRad = new Float32Array(n * n * n);

  // Build quick lookup helper on sorted radial samples
  const sampleCount = radialSamples.length;
  function sampleRadialProb(rBohr) {
    if (rBohr <= radialSamples[0].rBohr) return Math.max(0, radialSamples[0].radialProbabilityPerBohr);
    if (rBohr >= radialSamples[sampleCount - 1].rBohr) return 0;
    let lo = 0;
    let hi = sampleCount - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (radialSamples[mid].rBohr <= rBohr) lo = mid;
      else hi = mid;
    }
    const s0 = radialSamples[lo];
    const s1 = radialSamples[hi];
    const span = Math.max(1e-9, s1.rBohr - s0.rBohr);
    const t = (rBohr - s0.rBohr) / span;
    return Math.max(0, s0.radialProbabilityPerBohr + t * (s1.radialProbabilityPerBohr - s0.radialProbabilityPerBohr));
  }

  let peakPos = 0;
  let peakNeg = 0;
  let idx = 0;
  const isTotal = modeId === 'total-density';
  const lQuantum = modeId === 'f_xyz' ? 3 : (modeId === 'd_z2' || modeId === 'd_xy') ? 2 : modeId === 'p_z' ? 1 : 0;
  const rValence = Math.max(0.6, r95Bohr * 0.42);
  for (let iz = 0; iz < n; iz += 1) {
    const fz = ((iz + 0.5) / n) * 2 - 1;
    for (let iy = 0; iy < n; iy += 1) {
      const fy = ((iy + 0.5) / n) * 2 - 1;
      for (let ix = 0; ix < n; ix += 1) {
        const fx = ((ix + 0.5) / n) * 2 - 1;
        const rnorm = Math.hypot(fx, fy, fz);
        if (rnorm > 0.98 || rnorm < 1e-6) {
          idx += 1;
          continue;
        }
        const rBohr = rnorm * rLimit;
        const edgeFade = Math.max(0, 1 - Math.pow(rnorm, 6));
        let val = 0;
        if (isTotal) {
          const pRad = sampleRadialProb(rBohr);
          val = Math.pow(Math.max(0, pRad), 0.72) * edgeFade;
        } else {
          // Valence (l, m) radial shell envelope anchored to Kohn-Sham r95Bohr × exact real Y_lm(theta, phi)
          const rhoScale = rBohr / rValence;
          const radialOrb = Math.pow(rhoScale, lQuantum) * Math.exp(-rhoScale * (lQuantum === 0 ? 1.15 : 0.95));
          const ylm = evaluateRealSphericalHarmonic(modeId, fx / rnorm, fy / rnorm, fz / rnorm);
          val = radialOrb * ylm * edgeFade;
        }
        const mag = Math.abs(val);
        if (val >= 0) {
          rawPos[idx] = mag;
          if (mag > peakPos) peakPos = mag;
        } else {
          rawNeg[idx] = mag;
          if (mag > peakNeg) peakNeg = mag;
        }
        rawRad[idx] = Math.min(1, rBohr / Math.max(0.5, r95Bohr));
        idx += 1;
      }
    }
  }

  const peak = Math.max(peakPos, peakNeg);
  const invPos = peakPos > 1e-12 ? 1 / peakPos : 0;
  const invNeg = peakNeg > 1e-12 ? 1 / peakNeg : 0;
  const gamma = isTotal ? 0.92 : 0.95;
  for (let i = 0; i < n * n * n; i += 1) {
    const p = Math.min(1, Math.pow(rawPos[i] * invPos, gamma));
    const ng = Math.min(1, Math.pow(rawNeg[i] * invNeg, gamma));
    const dens = Math.max(p, ng);
    const o = i * 4;
    data[o + 0] = Math.round(p * 255);
    data[o + 1] = Math.round(ng * 255);
    data[o + 2] = Math.round(rawRad[i] * 255);
    data[o + 3] = Math.round(dens * 255);
  }

  return { data, dim: n, peak };
}

/**
 * Create a live WebGPU TSL volumetric raymarched orbital mesh (or graceful
 * slice-billboard fallback on WebGL2).
 */
export function createVolumetricOrbitalRaymarcher({
  THREE,
  TSL = null,
  renderer = null,
  radialSamples = [],
  rMaxBohr = 6.0,
  r95Bohr = 3.0,
  modeId = 'total-density',
  boxHalfExtent = 5.1,
  dim = 40
} = {}) {
  const { data, dim: volDim } = buildOrbitalVolumeData({
    radialSamples,
    rMaxBohr,
    r95Bohr,
    modeId,
    dim
  });

  const canWebGpuRaymarch = Boolean(
    renderer?.isWebGPURenderer
    && TSL
    && typeof THREE?.Data3DTexture === 'function'
    && typeof THREE?.MeshBasicNodeMaterial === 'function'
    && typeof TSL.texture3D === 'function'
    && typeof TSL.Loop === 'function'
    && typeof TSL.Fn === 'function'
  );

  const isTotalMode = modeId === 'total-density';
  const modeMeta = VOLUMETRIC_ORBITAL_MODES.find((m) => m.id === modeId) || VOLUMETRIC_ORBITAL_MODES[0];

  if (canWebGpuRaymarch) {
    const tex = new THREE.Data3DTexture(data, volDim, volDim, volDim);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;

    const {
      Fn,
      Loop,
      If,
      Break,
      texture3D,
      positionLocal,
      cameraPosition,
      modelWorldMatrixInverse,
      vec3,
      vec4,
      float,
      max,
      min,
      clamp,
      normalize,
      mix
    } = TSL;

    const half = float(boxHalfExtent);
    const invSize = float(1.0 / (2.0 * boxHalfExtent));
    const totalFlag = float(isTotalMode ? 1.0 : 0.0);

    const raymarchOrbital = Fn(() => {
      // Transform camera into object-local cube coordinates so rotations & zoom scale stay exact
      const ro = modelWorldMatrixInverse.mul(vec4(cameraPosition, float(1.0))).xyz;
      const rd = normalize(positionLocal.sub(ro));
      const safeRd = vec3(
        rd.x.abs().lessThan(float(1e-5)).select(float(1e-5), rd.x),
        rd.y.abs().lessThan(float(1e-5)).select(float(1e-5), rd.y),
        rd.z.abs().lessThan(float(1e-5)).select(float(1e-5), rd.z)
      );
      const t0 = vec3(half.negate(), half.negate(), half.negate()).sub(ro).div(safeRd);
      const t1 = vec3(half, half, half).sub(ro).div(safeRd);
      const tMinV = min(t0, t1);
      const tMaxV = max(t0, t1);
      const tNear = max(max(max(tMinV.x, tMinV.y), tMinV.z), float(0.0));
      const tFar = min(min(tMaxV.x, tMaxV.y), tMaxV.z);

      const accumRgb = vec3(0.0, 0.0, 0.0).toVar();
      const accumAlpha = float(0.0).toVar();
      const span = max(tFar.sub(tNear), float(0.0));
      const steps = float(44.0);
      const dt = span.div(steps);

      If(span.greaterThan(float(0.001)), () => {
        Loop(44, ({ i }) => {
          const t = tNear.add(dt.mul(float(i).add(float(0.5))));
          const p = ro.add(rd.mul(t));
          const uvw = clamp(p.add(vec3(half, half, half)).mul(invSize), vec3(0.001, 0.001, 0.001), vec3(0.999, 0.999, 0.999));
          const sample = texture3D(tex, uvw).level(float(0.0));
          const posAmp = sample.x;
          const negAmp = sample.y;
          const radFrac = sample.z;
          const dens = sample.w;

          If(dens.greaterThan(float(0.02)), () => {
            // Core-to-valence gold->cyan->azure palette for total density; cyan(+)/magenta(-) for signed Y_lm lobes
            const coreCol = vec3(1.0, 0.84, 0.36);
            const midCol = vec3(0.18, 0.92, 0.84);
            const outerCol = vec3(0.22, 0.56, 1.0);
            const totalCol = mix(coreCol, mix(midCol, outerCol, clamp(radFrac, float(0.0), float(1.0))), clamp(radFrac.mul(float(1.4)), float(0.0), float(1.0)));

            const posCol = vec3(0.12, 0.92, 1.0);
            const negCol = vec3(1.0, 0.24, 0.54);
            const lobeCol = posCol.mul(posAmp).add(negCol.mul(negAmp)).div(max(posAmp.add(negAmp), float(1e-4)));
            const voxelCol = mix(lobeCol, totalCol, totalFlag);

            const stepAlpha = clamp(dens.mul(float(0.085)), float(0.0), float(0.28));
            const weight = float(1.0).sub(accumAlpha).mul(stepAlpha);
            accumRgb.addAssign(voxelCol.mul(weight).mul(float(2.35)));
            accumAlpha.addAssign(weight);
          });

          If(accumAlpha.greaterThan(float(0.96)), () => {
            Break();
          });
        });
      });

      return vec4(accumRgb, clamp(accumAlpha, float(0.0), float(1.0)));
    });

    const geo = new THREE.BoxGeometry(boxHalfExtent * 2, boxHalfExtent * 2, boxHalfExtent * 2);
    const mat = new THREE.MeshBasicNodeMaterial();
    const outNode = raymarchOrbital();
    mat.colorNode = outNode.xyz;
    mat.opacityNode = outNode.w;
    mat.transparent = true;
    mat.depthWrite = false;
    mat.side = THREE.BackSide;
    mat.blending = THREE.AdditiveBlending;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;

    return {
      mode: 'webgpu-3d-volumetric-raymarcher',
      orbitalModeId: modeMeta.id,
      provenance: modeMeta.provenance,
      volumeDim: volDim,
      mesh,
      dispose() {
        geo.dispose();
        mat.dispose();
        tex.dispose();
      }
    };
  }

  // Fallback instanced volumetric point cloud when WebGL2 is active
  const geo = new THREE.IcosahedronGeometry(0.12, 0);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const pts = [];
  for (let iz = 0; iz < volDim; iz += 2) {
    for (let iy = 0; iy < volDim; iy += 2) {
      for (let ix = 0; ix < volDim; ix += 2) {
        const o = ((iz * volDim + iy) * volDim + ix) * 4;
        if (data[o + 3] > 28) {
          pts.push([
            (((ix + 0.5) / volDim) * 2 - 1) * boxHalfExtent,
            (((iy + 0.5) / volDim) * 2 - 1) * boxHalfExtent,
            (((iz + 0.5) / volDim) * 2 - 1) * boxHalfExtent,
            data[o + 0] / 255,
            data[o + 1] / 255,
            data[o + 2] / 255,
            data[o + 3] / 255
          ]);
        }
      }
    }
  }
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, pts.length));
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < pts.length; i += 1) {
    const [x, y, z, p, ng, rf, d] = pts[i];
    dummy.position.set(x, y, z);
    dummy.scale.setScalar(0.6 + 1.2 * d);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (isTotalMode) color.setRGB(0.2 + 0.8 * (1 - rf), 0.82, 0.45 + 0.55 * rf);
    else if (p >= ng) color.setRGB(0.16, 0.9, 1.0);
    else color.setRGB(1.0, 0.3, 0.56);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  return {
    mode: 'webgl-instanced-fallback',
    orbitalModeId: modeMeta.id,
    provenance: modeMeta.provenance,
    volumeDim: volDim,
    mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
    }
  };
}

/**
 * Raymarch an arbitrary precomputed 3D electron charge density grid
 * (`Float32Array` of shape `[nx, ny, nz]` from `buildMolecularChargeDensityArtifact`)
 * directly on WebGPU via `Data3DTexture` + `three/tsl` — zero scripted primitives.
 */
export function createVolumetricDensityGridRaymarcher({
  THREE,
  TSL = null,
  renderer = null,
  densityGrid,
  dimensions = [16, 16, 16],
  boxHalfExtent = 4.8,
  provenance = 'molecular-rhf-charge-density-volume'
} = {}) {
  const [nx, ny, nz] = dimensions;
  const total = nx * ny * nz;
  const data = new Uint8Array(total * 4);
  let peak = 0;
  for (let i = 0; i < total; i += 1) {
    const v = Math.max(0, Number(densityGrid?.[i]) || 0);
    if (v > peak) peak = v;
  }
  const invPeak = peak > 1e-12 ? 1 / peak : 0;
  for (let iz = 0; iz < nz; iz += 1) {
    const fz = ((iz + 0.5) / nz) * 2 - 1;
    for (let iy = 0; iy < ny; iy += 1) {
      const fy = ((iy + 0.5) / ny) * 2 - 1;
      for (let ix = 0; ix < nx; ix += 1) {
        const fx = ((ix + 0.5) / nx) * 2 - 1;
        const idx = (iz * ny + iy) * nx + ix;
        const norm = Math.min(1, Math.pow(Math.max(0, (Number(densityGrid?.[idx]) || 0) * invPeak), 0.52));
        const rFrac = Math.min(1, Math.hypot(fx, fy, fz));
        const o = idx * 4;
        data[o + 0] = Math.round(norm * 255);
        data[o + 1] = 0;
        data[o + 2] = Math.round(rFrac * 255);
        data[o + 3] = Math.round(norm * 255);
      }
    }
  }

  const canWebGpuRaymarch = Boolean(
    renderer?.isWebGPURenderer
    && TSL
    && typeof THREE?.Data3DTexture === 'function'
    && typeof THREE?.MeshBasicNodeMaterial === 'function'
    && typeof TSL.texture3D === 'function'
    && typeof TSL.Loop === 'function'
    && typeof TSL.Fn === 'function'
  );

  if (canWebGpuRaymarch) {
    const tex = new THREE.Data3DTexture(data, nx, ny, nz);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;

    const {
      Fn, Loop, If, Break, texture3D, positionLocal, cameraPosition,
      modelWorldMatrixInverse, vec3, vec4, float, max, min, clamp, normalize, mix
    } = TSL;

    const half = float(boxHalfExtent);
    const invSize = float(1.0 / (2.0 * boxHalfExtent));
    const raymarchMol = Fn(() => {
      const ro = modelWorldMatrixInverse.mul(vec4(cameraPosition, float(1.0))).xyz;
      const rd = normalize(positionLocal.sub(ro));
      const safeRd = vec3(
        rd.x.abs().lessThan(float(1e-5)).select(float(1e-5), rd.x),
        rd.y.abs().lessThan(float(1e-5)).select(float(1e-5), rd.y),
        rd.z.abs().lessThan(float(1e-5)).select(float(1e-5), rd.z)
      );
      const t0 = vec3(half.negate(), half.negate(), half.negate()).sub(ro).div(safeRd);
      const t1 = vec3(half, half, half).sub(ro).div(safeRd);
      const tMinV = min(t0, t1);
      const tMaxV = max(t0, t1);
      const tNear = max(max(max(tMinV.x, tMinV.y), tMinV.z), float(0.0));
      const tFar = min(min(tMaxV.x, tMaxV.y), tMaxV.z);

      const accumRgb = vec3(0.0, 0.0, 0.0).toVar();
      const accumAlpha = float(0.0).toVar();
      const span = max(tFar.sub(tNear), float(0.0));
      const dt = span.div(float(44.0));
      If(span.greaterThan(float(0.001)), () => {
        Loop(44, ({ i }) => {
          const t = tNear.add(dt.mul(float(i).add(float(0.5))));
          const p = ro.add(rd.mul(t));
          const uvw = clamp(p.add(vec3(half, half, half)).mul(invSize), vec3(0.001, 0.001, 0.001), vec3(0.999, 0.999, 0.999));
          const sample = texture3D(tex, uvw).level(float(0.0));
          const dens = sample.w;
          const radFrac = sample.z;
          If(dens.greaterThan(float(0.02)), () => {
            const bondCol = vec3(0.36, 0.96, 0.84);
            const outerCol = vec3(0.24, 0.54, 1.0);
            const voxelCol = mix(bondCol, outerCol, clamp(radFrac, float(0.0), float(1.0)));
            const stepAlpha = clamp(dens.mul(float(0.095)), float(0.0), float(0.30));
            const weight = float(1.0).sub(accumAlpha).mul(stepAlpha);
            accumRgb.addAssign(voxelCol.mul(weight).mul(float(2.4)));
            accumAlpha.addAssign(weight);
          });
          If(accumAlpha.greaterThan(float(0.96)), () => { Break(); });
        });
      });
      return vec4(accumRgb, clamp(accumAlpha, float(0.0), float(1.0)));
    });

    const geo = new THREE.BoxGeometry(boxHalfExtent * 2, boxHalfExtent * 2, boxHalfExtent * 2);
    const mat = new THREE.MeshBasicNodeMaterial();
    const outNode = raymarchMol();
    mat.colorNode = outNode.xyz;
    mat.opacityNode = outNode.w;
    mat.transparent = true;
    mat.depthWrite = false;
    mat.side = THREE.BackSide;
    mat.blending = THREE.AdditiveBlending;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;

    return {
      mode: 'webgpu-3d-volumetric-raymarcher',
      provenance,
      dimensions,
      mesh,
      dispose() {
        geo.dispose();
        mat.dispose();
        tex.dispose();
      }
    };
  }

  const group = new THREE.Group();
  return {
    mode: 'empty-fallback',
    provenance,
    dimensions,
    mesh: group,
    dispose() {}
  };
}
