// MLS-MPM (Moving Least Squares Material Point Method) mechanical carrier — an alternative to the
// SPH carrier for the phase demo. Grid-based hybrid (Hu et al. 2018, APIC transfers): particles
// carry mass/momentum/affine-velocity/deformation, a background grid resolves the momentum update,
// and the result is interpolated back. It is far more stable than SPH for large deformation,
// multi-material contact, and free-surface expansion (the steam), and is the method the reference
// webgpuphys demo uses (GPU-friendly P2G/G2P).
//
// The first-principles layers are reused unchanged: pressure comes from the SAME phase-aware
// multi-material EOS (pressure from the current density vs the phase's rest density), and the
// thermal energy↔phase map / closures / optical colour all stay on the particles. Only the
// mechanical integrator differs. Weakly-compressible fluid constitutive model (stress = −p I),
// volume tracked by J. Evidence-only: sphValidation/phaseChangeValidation stay false.

// --- 3x3 matrix helpers (row-major length-9) for the solid elastic constitutive model ----------
function mat3mul(A, B) {
  const C = new Float64Array(9);
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
    let s = 0;
    for (let k = 0; k < 3; k += 1) s += A[i * 3 + k] * B[k * 3 + j];
    C[i * 3 + j] = s;
  }
  return C;
}
function mat3T(A) { return new Float64Array([A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]]); }
function mat3det(A) {
  return A[0] * (A[4] * A[8] - A[5] * A[7]) - A[1] * (A[3] * A[8] - A[5] * A[6]) + A[2] * (A[3] * A[7] - A[4] * A[6]);
}
function mat3inv(A) {
  const d = mat3det(A);
  const id = 1 / d;
  return new Float64Array([
    (A[4] * A[8] - A[5] * A[7]) * id, (A[2] * A[7] - A[1] * A[8]) * id, (A[1] * A[5] - A[2] * A[4]) * id,
    (A[5] * A[6] - A[3] * A[8]) * id, (A[0] * A[8] - A[2] * A[6]) * id, (A[2] * A[3] - A[0] * A[5]) * id,
    (A[3] * A[7] - A[4] * A[6]) * id, (A[1] * A[6] - A[0] * A[7]) * id, (A[0] * A[4] - A[1] * A[3]) * id
  ]);
}
// Fixed-corotated elastic Cauchy stress (Stomakhin et al.): P = 2μ(F−R) + λ(J−1)J F^{-T},
// σ = (1/J) P Fᵀ, with R the polar-decomposition rotation (Newton iteration R ← ½(R + R^{-T})).
// Fully inlined scalar 3×3 algebra — no per-iteration array allocation (this is a hot path called
// once per solid particle per substep). Gives a solid that resists shear and springs back.
function corotatedCauchyStress(F, mu, lambda) {
  const f0 = F[0]; const f1 = F[1]; const f2 = F[2];
  const f3 = F[3]; const f4 = F[4]; const f5 = F[5];
  const f6 = F[6]; const f7 = F[7]; const f8 = F[8];
  // Polar rotation R (start R = F).
  let r0 = f0; let r1 = f1; let r2 = f2; let r3 = f3; let r4 = f4; let r5 = f5; let r6 = f6; let r7 = f7; let r8 = f8;
  for (let it = 0; it < 12; it += 1) {
    const det = r0 * (r4 * r8 - r5 * r7) - r1 * (r3 * r8 - r5 * r6) + r2 * (r3 * r7 - r4 * r6);
    const id = 1 / det;
    // R^{-T} = transpose of R^{-1}.
    const t0 = (r4 * r8 - r5 * r7) * id; const t3 = (r2 * r7 - r1 * r8) * id; const t6 = (r1 * r5 - r2 * r4) * id;
    const t1 = (r5 * r6 - r3 * r8) * id; const t4 = (r0 * r8 - r2 * r6) * id; const t7 = (r2 * r3 - r0 * r5) * id;
    const t2 = (r3 * r7 - r4 * r6) * id; const t5 = (r1 * r6 - r0 * r7) * id; const t8 = (r0 * r4 - r1 * r3) * id;
    const n0 = 0.5 * (r0 + t0); const n1 = 0.5 * (r1 + t1); const n2 = 0.5 * (r2 + t2);
    const n3 = 0.5 * (r3 + t3); const n4 = 0.5 * (r4 + t4); const n5 = 0.5 * (r5 + t5);
    const n6 = 0.5 * (r6 + t6); const n7 = 0.5 * (r7 + t7); const n8 = 0.5 * (r8 + t8);
    const diff = Math.abs(n0 - r0) + Math.abs(n4 - r4) + Math.abs(n8 - r8);
    r0 = n0; r1 = n1; r2 = n2; r3 = n3; r4 = n4; r5 = n5; r6 = n6; r7 = n7; r8 = n8;
    if (diff < 1e-10) break;
  }
  const J = f0 * (f4 * f8 - f5 * f7) - f1 * (f3 * f8 - f5 * f6) + f2 * (f3 * f7 - f4 * f6);
  const jid = 1 / J;
  // F^{-T}.
  const ft0 = (f4 * f8 - f5 * f7) * jid; const ft3 = (f2 * f7 - f1 * f8) * jid; const ft6 = (f1 * f5 - f2 * f4) * jid;
  const ft1 = (f5 * f6 - f3 * f8) * jid; const ft4 = (f0 * f8 - f2 * f6) * jid; const ft7 = (f2 * f3 - f0 * f5) * jid;
  const ft2 = (f3 * f7 - f4 * f6) * jid; const ft5 = (f1 * f6 - f0 * f7) * jid; const ft8 = (f0 * f4 - f1 * f3) * jid;
  const c = lambda * (J - 1) * J;
  const p0 = 2 * mu * (f0 - r0) + c * ft0; const p1 = 2 * mu * (f1 - r1) + c * ft1; const p2 = 2 * mu * (f2 - r2) + c * ft2;
  const p3 = 2 * mu * (f3 - r3) + c * ft3; const p4 = 2 * mu * (f4 - r4) + c * ft4; const p5 = 2 * mu * (f5 - r5) + c * ft5;
  const p6 = 2 * mu * (f6 - r6) + c * ft6; const p7 = 2 * mu * (f7 - r7) + c * ft7; const p8 = 2 * mu * (f8 - r8) + c * ft8;
  // σ = (1/J) P Fᵀ, with (P Fᵀ)[i][j] = Σ_k P[i][k] F[j][k].
  return new Float64Array([
    (p0 * f0 + p1 * f1 + p2 * f2) * jid, (p0 * f3 + p1 * f4 + p2 * f5) * jid, (p0 * f6 + p1 * f7 + p2 * f8) * jid,
    (p3 * f0 + p4 * f1 + p5 * f2) * jid, (p3 * f3 + p4 * f4 + p5 * f5) * jid, (p3 * f6 + p4 * f7 + p5 * f8) * jid,
    (p6 * f0 + p7 * f1 + p8 * f2) * jid, (p6 * f3 + p7 * f4 + p8 * f5) * jid, (p6 * f6 + p7 * f7 + p8 * f8) * jid
  ]);
}
const IDENTITY3 = () => new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const CONDENSED_MIN_VOLUME_RATIO_J = 0.95;
const CONDENSED_MAX_VOLUME_RATIO_J = 1.049;
const CONDENSED_MAX_VOLUME_RATIO_CHANGE_PER_STEP = 1.5;

// Quadratic B-spline weights (3 nodes/axis) and their offset positions, given fx = x/dx − base.
function quadraticWeights(fx) {
  const a = 1.5 - fx;
  const b = fx - 1.0;
  const c = fx - 0.5;
  return [0.5 * a * a, 0.75 - b * b, 0.5 * c * c];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isotropicFForJ(volumeRatioJ) {
  const s = Math.cbrt(Math.max(Number(volumeRatioJ) || 1, 1e-12));
  return new Float64Array([s, 0, 0, 0, s, 0, 0, 0, s]);
}

function condensedTargetVolumeRatioJ(rawNextJ, previousJ) {
  const previousBounded = clamp(
    Number.isFinite(previousJ) ? previousJ : 1,
    CONDENSED_MIN_VOLUME_RATIO_J,
    CONDENSED_MAX_VOLUME_RATIO_J
  );
  const lower = Math.max(
    CONDENSED_MIN_VOLUME_RATIO_J,
    previousBounded / CONDENSED_MAX_VOLUME_RATIO_CHANGE_PER_STEP
  );
  const upper = Math.min(
    CONDENSED_MAX_VOLUME_RATIO_J,
    previousBounded * CONDENSED_MAX_VOLUME_RATIO_CHANGE_PER_STEP
  );
  return clamp(
    Number.isFinite(rawNextJ) ? rawNextJ : previousBounded,
    lower,
    upper
  );
}

function addNewtonianViscousStress(sigma, C, dynamicViscosityPaS) {
  const mu = Math.max(Number(dynamicViscosityPaS) || 0, 0);
  if (!(mu > 0)) return sigma;
  const divThird = (C[0] + C[4] + C[8]) / 3;
  sigma[0] += 2 * mu * (C[0] - divThird);
  sigma[4] += 2 * mu * (C[4] - divThird);
  sigma[8] += 2 * mu * (C[8] - divThird);
  const s01 = mu * (C[1] + C[3]);
  const s02 = mu * (C[2] + C[6]);
  const s12 = mu * (C[5] + C[7]);
  sigma[1] += s01; sigma[3] += s01;
  sigma[2] += s02; sigma[6] += s02;
  sigma[5] += s12; sigma[7] += s12;
  return sigma;
}

/**
 * Create an MLS-MPM carrier. `eos(density, u, particle)` returns { pressurePa }. State particles
 * need x, v, massKg, specificInternalEnergyJPerKg, material; the carrier adds/maintains the affine
 * matrix C (3×3, row-major 9) and volume ratio J on each particle (initialized on first step).
 */
export function createMlsMpmCarrier({
  gridSpacingM,
  boxEdgeM,
  boxDimsM, // [Lx, Ly, Lz] (rectangular cuboid); falls back to a cube of boxEdgeM
  dt = 4e-4,
  gravity = [0, -9.80665, 0],
  eos,
  restDensityOf, // (particle) -> rest density (kg/m^3) at its initial phase, for V0
  // (particle) -> { solid, shearModulusPa, lambdaPa }. When solid, a corotated elastic stress is
  // used (the material holds its shape / resists shear); otherwise the weakly-compressible fluid
  // pressure is used. Default: everything is a fluid (backwards-compatible).
  constitutiveOf = () => ({ solid: false }),
  trackFluidVolume = true,
  liquidVelocityDiffusionAlpha = 0,
  liquidVelocityDiffusionRadiusM = null,
  liquidVelocityDiffusionStartS = 0,
  liquidWallDampingAlpha = 0,
  liquidWallDampingDistanceM = null,
  cflFactor = 0.6 // max grid-node displacement per step, as a fraction of a cell (stability guard)
} = {}) {
  const dims = boxDimsM ?? [boxEdgeM, boxEdgeM, boxEdgeM];
  const vMax = (cflFactor * gridSpacingM) / dt;
  const vMax2 = vMax * vMax;
  const dx = gridSpacingM;
  const invDx = 1 / dx;
  // Per-axis node counts (with padding); flat index over gnx·gny·gnz, shifted by +1 for base=-1.
  const shift = 1;
  const gnx = Math.round(dims[0] / dx) + 5;
  const gny = Math.round(dims[1] / dx) + 5;
  const gnz = Math.round(dims[2] / dx) + 5;
  const ng = gnx * gny * gnz;
  const liquidDiffusionAlpha = clamp(Number(liquidVelocityDiffusionAlpha) || 0, 0, 1);
  const liquidDiffusionRadius = Math.max(
    Number(liquidVelocityDiffusionRadiusM) || (2 * dx),
    1e-9
  );
  const liquidDiffusionRadius2 = liquidDiffusionRadius * liquidDiffusionRadius;
  const liquidDiffusionStartS = Math.max(Number(liquidVelocityDiffusionStartS) || 0, 0);
  const wallDampingAlpha = clamp(Number(liquidWallDampingAlpha) || 0, 0, 1);
  const wallDampingDistance = Math.max(Number(liquidWallDampingDistanceM) || (1.5 * dx), 1e-9);
  const gridMass = new Float64Array(ng);
  const gridMom = new Float64Array(ng * 3); // momentum, then velocity in place
  const activeNodeEpochs = new Uint32Array(ng);
  const activeNodes = [];
  let activeEpoch = 1;
  const nodeIndex = (i, j, k) => ((i + shift) * gny + (j + shift)) * gnz + (k + shift);
  const inRangeX = (i) => i + shift >= 0 && i + shift < gnx;
  const inRangeY = (j) => j + shift >= 0 && j + shift < gny;
  const inRangeZ = (k) => k + shift >= 0 && k + shift < gnz;
  const markActiveNode = (idx) => {
    if (activeNodeEpochs[idx] === activeEpoch) return;
    activeNodeEpochs[idx] = activeEpoch;
    activeNodes.push(idx);
  };
  const advanceActiveEpoch = () => {
    if (activeEpoch >= 0xffffffff) {
      activeNodeEpochs.fill(0);
      activeEpoch = 1;
      return;
    }
    activeEpoch += 1;
  };

  function ensureParticleState(p) {
    if (p.mpmF === undefined) {
      p.mpmF = IDENTITY3(); // deformation gradient (carries elastic shape memory for solids)
      p.mpmJ = 1;
      p.mpmC = new Float64Array(9);
      const rho0 = restDensityOf(p);
      p.mpmVolume0 = p.massKg / rho0;
    }
  }

  function particleWallClearanceM(p) {
    const volume = Number(p.mpmVolume0);
    if (!(volume > 0)) return 0;
    const minDim = Math.min(...dims.filter((value) => value > 0));
    const clearance = 0.5 * Math.cbrt(volume);
    return Number.isFinite(minDim) && minDim > 0
      ? Math.min(clearance, 0.49 * minDim)
      : clearance;
  }

  function applyLiquidVelocityDiffusion(particles, timeS) {
    if (!(liquidDiffusionAlpha > 0) || particles.length < 2) return;
    if ((Number(timeS) || 0) < liquidDiffusionStartS) return;
    const dv = Array.from({ length: particles.length }, () => [0, 0, 0]);
    for (let i = 0; i < particles.length - 1; i += 1) {
      const a = particles[i];
      if (a.mpmSolid || a.mpmCondensed === false) continue;
      const ma = Number(a.massKg);
      if (!(ma > 0)) continue;
      for (let j = i + 1; j < particles.length; j += 1) {
        const b = particles[j];
        if (b.mpmSolid || b.mpmCondensed === false || a.material !== b.material) continue;
        const mb = Number(b.massKg);
        if (!(mb > 0)) continue;
        const dxp = b.x[0] - a.x[0];
        const dyp = b.x[1] - a.x[1];
        const dzp = b.x[2] - a.x[2];
        const r2 = dxp * dxp + dyp * dyp + dzp * dzp;
        if (!(r2 > 0) || r2 > liquidDiffusionRadius2) continue;
        const r = Math.sqrt(r2);
        const q = 1 - (r / liquidDiffusionRadius);
        const mix = liquidDiffusionAlpha * q * q;
        const invMass = 1 / (ma + mb);
        const wa = mb * invMass;
        const wb = ma * invMass;
        const relx = b.v[0] - a.v[0];
        const rely = b.v[1] - a.v[1];
        const relz = b.v[2] - a.v[2];
        dv[i][0] += mix * wa * relx;
        dv[i][1] += mix * wa * rely;
        dv[i][2] += mix * wa * relz;
        dv[j][0] -= mix * wb * relx;
        dv[j][1] -= mix * wb * rely;
        dv[j][2] -= mix * wb * relz;
      }
    }
    for (let i = 0; i < particles.length; i += 1) {
      particles[i].v[0] += dv[i][0];
      particles[i].v[1] += dv[i][1];
      particles[i].v[2] += dv[i][2];
    }
  }

  function applyLiquidWallDamping(particles) {
    if (!(wallDampingAlpha > 0)) return;
    for (const p of particles) {
      if (p.mpmSolid || p.mpmCondensed === false) continue;
      const clearance = particleWallClearanceM(p);
      const floorDistance = Math.max(0, p.x[1] - clearance);
      if (floorDistance >= wallDampingDistance) continue;
      const q = 1 - (floorDistance / wallDampingDistance);
      const keep = clamp(1 - wallDampingAlpha * q * q, 0, 1);
      p.v[0] *= keep;
      p.v[1] *= keep;
      p.v[2] *= keep;
    }
  }

  function step(state) {
    const particles = state.particles;
    const n = particles.length;
    activeNodes.length = 0;

    // --- P2G: scatter mass, momentum (APIC) + internal stress to the grid ---
    for (let pi = 0; pi < n; pi += 1) {
      const p = particles[pi];
      ensureParticleState(p);
      const J = mat3det(p.mpmF);
      const volume = p.mpmVolume0 * J;
      const density = p.massKg / volume; // = rho0 / J
      const con = constitutiveOf(p);
      p.mpmSolid = con.solid; // cache the phase decision for G2P (avoids a 2nd phase lookup)
      p.mpmCondensed = con.condensed !== false;
      // Cauchy stress σ: corotated elastic for a solid (resists shear → holds shape), otherwise the
      // weakly-compressible fluid pressure σ = −p I.
      const C = p.mpmC;
      let sigma;
      if (con.solid) {
        sigma = corotatedCauchyStress(p.mpmF, con.shearModulusPa, con.lambdaPa);
      } else {
        const pressure = eos({ density, specificInternalEnergyJPerKg: p.specificInternalEnergyJPerKg, particle: p }).pressurePa
          + Math.max(Number(con.hydrostaticPressurePa ?? p.hydrostaticPressurePa) || 0, 0);
        sigma = new Float64Array([-pressure, 0, 0, 0, -pressure, 0, 0, 0, -pressure]);
        addNewtonianViscousStress(sigma, C, con.dynamicViscosityPaS);
      }
      // Affine matrix: APIC (m C) + MLS internal-force term  −dt·V·(4/dx²)·σ  (∇w = (4/dx²)(x_i−x_p) w).
      const sScale = -dt * volume * 4 * invDx * invDx;
      const aff = new Float64Array(9);
      for (let a = 0; a < 9; a += 1) aff[a] = p.massKg * C[a] + sScale * sigma[a];

      const baseX = Math.floor(p.x[0] * invDx - 0.5);
      const baseY = Math.floor(p.x[1] * invDx - 0.5);
      const baseZ = Math.floor(p.x[2] * invDx - 0.5);
      const fx = p.x[0] * invDx - baseX;
      const fy = p.x[1] * invDx - baseY;
      const fz = p.x[2] * invDx - baseZ;
      const wx = quadraticWeights(fx);
      const wy = quadraticWeights(fy);
      const wz = quadraticWeights(fz);
      for (let a = 0; a < 3; a += 1) {
        if (!inRangeX(baseX + a)) continue;
        for (let b = 0; b < 3; b += 1) {
          if (!inRangeY(baseY + b)) continue;
          for (let c = 0; c < 3; c += 1) {
            if (!inRangeZ(baseZ + c)) continue;
            const w = wx[a] * wy[b] * wz[c];
            // dpos = node - particle  (Bohr→ m; node at (base+offset)*dx)
            const dposx = (baseX + a - p.x[0] * invDx) * dx;
            const dposy = (baseY + b - p.x[1] * invDx) * dx;
            const dposz = (baseZ + c - p.x[2] * invDx) * dx;
            const idx = nodeIndex(baseX + a, baseY + b, baseZ + c);
            markActiveNode(idx);
            gridMass[idx] += w * p.massKg;
            // momentum += w (m v + aff · dpos)
            gridMom[idx * 3] += w * (p.massKg * p.v[0] + aff[0] * dposx + aff[1] * dposy + aff[2] * dposz);
            gridMom[idx * 3 + 1] += w * (p.massKg * p.v[1] + aff[3] * dposx + aff[4] * dposy + aff[5] * dposz);
            gridMom[idx * 3 + 2] += w * (p.massKg * p.v[2] + aff[6] * dposx + aff[7] * dposy + aff[8] * dposz);
          }
        }
      }
    }

    // --- grid update: momentum -> velocity, gravity, wall boundary conditions ---
    const plane = gny * gnz;
    for (let ni = 0; ni < activeNodes.length; ni += 1) {
      const idx = activeNodes[ni];
      const m = gridMass[idx];
      if (m <= 0) continue;
      let vx = gridMom[idx * 3] / m + dt * gravity[0];
      let vy = gridMom[idx * 3 + 1] / m + dt * gravity[1];
      let vz = gridMom[idx * 3 + 2] / m + dt * gravity[2];
      // CFL velocity clamp: no node may move a particle more than ~cflFactor of a cell per step.
      // This is the key stability guard for energetic flows (impacts, steam expansion) — without
      // it a spike in velocity jumps particles across grid cells and the sim blows up.
      const sp2 = vx * vx + vy * vy + vz * vz;
      if (sp2 > vMax2) { const s = vMax / Math.sqrt(sp2); vx *= s; vy *= s; vz *= s; }
      // No-slip floor BC: the support wall is stationary, which removes the wall-contact kinetic
      // energy that a slip-only floor leaves as long-lived liquid slosh. Other sealed walls retain the
      // normal-only clamp so free-falling material near the top/side boundary is not damped early.
      const i = Math.floor(idx / plane);
      const rem = idx - i * plane;
      const j = Math.floor(rem / gnz);
      const k = rem - j * gnz;
      const wx = (i - shift) * dx;
      const wy = (j - shift) * dx;
      const wz = (k - shift) * dx;
      if (wy < dx) {
        vx = 0; vy = 0; vz = 0;
      }
      if ((wx < dx && vx < 0) || (wx > dims[0] - dx && vx > 0)) vx = 0;
      if (wy > dims[1] - dx && vy > 0) vy = 0;
      if ((wz < dx && vz < 0) || (wz > dims[2] - dx && vz > 0)) vz = 0;
      gridMom[idx * 3] = vx;
      gridMom[idx * 3 + 1] = vy;
      gridMom[idx * 3 + 2] = vz;
    }

    // --- G2P: gather velocity + reconstruct affine C, advect, update volume J ---
    for (let pi = 0; pi < n; pi += 1) {
      const p = particles[pi];
      const baseX = Math.floor(p.x[0] * invDx - 0.5);
      const baseY = Math.floor(p.x[1] * invDx - 0.5);
      const baseZ = Math.floor(p.x[2] * invDx - 0.5);
      const fx = p.x[0] * invDx - baseX;
      const fy = p.x[1] * invDx - baseY;
      const fz = p.x[2] * invDx - baseZ;
      const wx = quadraticWeights(fx);
      const wy = quadraticWeights(fy);
      const wz = quadraticWeights(fz);
      let nvx = 0; let nvy = 0; let nvz = 0;
      const C = new Float64Array(9);
      let sampledWeight = 0;
      for (let a = 0; a < 3; a += 1) {
        if (!inRangeX(baseX + a)) continue;
        for (let b = 0; b < 3; b += 1) {
          if (!inRangeY(baseY + b)) continue;
          for (let c = 0; c < 3; c += 1) {
            if (!inRangeZ(baseZ + c)) continue;
            const w = wx[a] * wy[b] * wz[c];
            const idx = nodeIndex(baseX + a, baseY + b, baseZ + c);
            if (!(gridMass[idx] > 0)) continue;
            sampledWeight += w;
            const gvx = gridMom[idx * 3];
            const gvy = gridMom[idx * 3 + 1];
            const gvz = gridMom[idx * 3 + 2];
            nvx += w * gvx; nvy += w * gvy; nvz += w * gvz;
            const dposx = (baseX + a - p.x[0] * invDx) * dx;
            const dposy = (baseY + b - p.x[1] * invDx) * dx;
            const dposz = (baseZ + c - p.x[2] * invDx) * dx;
            const s = 4 * invDx * invDx * w; // (4/dx^2) w
            C[0] += s * gvx * dposx; C[1] += s * gvx * dposy; C[2] += s * gvx * dposz;
            C[3] += s * gvy * dposx; C[4] += s * gvy * dposy; C[5] += s * gvy * dposz;
            C[6] += s * gvz * dposx; C[7] += s * gvz * dposy; C[8] += s * gvz * dposz;
          }
        }
      }
      if (sampledWeight > 1e-8 && sampledWeight < 1 - 1e-6) {
        const normalization = 1 / sampledWeight;
        nvx *= normalization;
        nvy *= normalization;
        nvz *= normalization;
        for (let a = 0; a < 9; a += 1) C[a] *= normalization;
      }
      p.v[0] = nvx; p.v[1] = nvy; p.v[2] = nvz;
      p.x[0] += dt * nvx; p.x[1] += dt * nvy; p.x[2] += dt * nvz;
      // Deformation-gradient update: F <- (I + dt C) F.
      const solid = p.mpmSolid;
      const condensed = p.mpmCondensed !== false;
      if (!solid && !trackFluidVolume) {
        C.fill(0);
      } else {
        const gradX = mat3mul(new Float64Array([1 + dt * C[0], dt * C[1], dt * C[2], dt * C[3], 1 + dt * C[4], dt * C[5], dt * C[6], dt * C[7], 1 + dt * C[8]]), p.mpmF);
        let J = mat3det(gradX);
        if (solid) {
          if (condensed) {
            const targetJ = condensedTargetVolumeRatioJ(J, p.mpmJ);
            if (J > 1e-12) {
              const scale = Math.cbrt(targetJ / J);
              for (let a = 0; a < 9; a += 1) gradX[a] *= scale;
              p.mpmF = gradX;
            } else {
              p.mpmF = isotropicFForJ(targetJ);
            }
          } else {
            p.mpmF = gradX;
          }
        } else {
          // Fluids/gas keep no shear memory: collapse F to the volume-only part F = J^{1/3} I, so a
          // melted solid flows (and a re-frozen one starts fresh). Also lets steam expand (J grows).
          if (condensed) J = condensedTargetVolumeRatioJ(J, p.mpmJ);
          if (J < 0.05) J = 0.05;
          p.mpmF = isotropicFForJ(J);
        }
      }
      p.mpmC = C;
      p.mpmJ = mat3det(p.mpmF);
      if (p.mpmJ < 0.1) { const s = Math.cbrt(0.1); p.mpmF = new Float64Array([s, 0, 0, 0, s, 0, 0, 0, s]); p.mpmJ = 0.1; }
      // Keep particles inside the box, and kill the into-wall velocity component when clamping so a
      // particle pinned at a wall can't keep accumulating inward momentum (an instability source).
      const clearance = particleWallClearanceM(p);
      for (let d = 0; d < 3; d += 1) {
        const upper = Math.max(clearance, dims[d] - clearance);
        if (p.x[d] < clearance) { p.x[d] = clearance; if (p.v[d] < 0) p.v[d] = 0; }
        else if (p.x[d] > upper) { p.x[d] = upper; if (p.v[d] > 0) p.v[d] = 0; }
      }
    }
    applyLiquidWallDamping(particles);
    applyLiquidVelocityDiffusion(particles, state.time);
    for (const p of particles) {
      const clearance = particleWallClearanceM(p);
      for (let d = 0; d < 3; d += 1) {
        const upper = Math.max(clearance, dims[d] - clearance);
        if (p.x[d] <= clearance && p.v[d] < 0) p.v[d] = 0;
        else if (p.x[d] >= upper && p.v[d] > 0) p.v[d] = 0;
      }
    }
    state.step = (state.step ?? 0) + 1;
    state.time = (state.time ?? 0) + dt;
    const activeGridNodes = activeNodes.length;
    for (let ni = 0; ni < activeNodes.length; ni += 1) {
      const idx = activeNodes[ni];
      gridMass[idx] = 0;
      gridMom[idx * 3] = 0;
      gridMom[idx * 3 + 1] = 0;
      gridMom[idx * 3 + 2] = 0;
    }
    activeNodes.length = 0;
    advanceActiveEpoch();
    return { state, activeGridNodes };
  }

  return {
    backend: 'mls-mpm',
    integrator: 'apic',
    dt,
    gridNodesPerAxis: [gnx, gny, gnz],
    liquidVelocityDiffusionAlpha: liquidDiffusionAlpha,
    liquidVelocityDiffusionRadiusM: liquidDiffusionRadius,
    liquidVelocityDiffusionStartS: liquidDiffusionStartS,
    liquidWallDampingAlpha: wallDampingAlpha,
    liquidWallDampingDistanceM: wallDampingDistance,
    step
  };
}
