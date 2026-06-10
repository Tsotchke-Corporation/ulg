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

// Quadratic B-spline weights (3 nodes/axis) and their offset positions, given fx = x/dx − base.
function quadraticWeights(fx) {
  const a = 1.5 - fx;
  const b = fx - 1.0;
  const c = fx - 0.5;
  return [0.5 * a * a, 0.75 - b * b, 0.5 * c * c];
}

/**
 * Create an MLS-MPM carrier. `eos(density, u, particle)` returns { pressurePa }. State particles
 * need x, v, massKg, specificInternalEnergyJPerKg, material; the carrier adds/maintains the affine
 * matrix C (3×3, row-major 9) and volume ratio J on each particle (initialized on first step).
 */
export function createMlsMpmCarrier({
  gridSpacingM,
  boxEdgeM,
  dt = 4e-4,
  gravity = [0, -9.80665, 0],
  eos,
  restDensityOf, // (particle) -> rest density (kg/m^3) at its initial phase, for V0
  wallRestitution = 0.3
} = {}) {
  const dx = gridSpacingM;
  const invDx = 1 / dx;
  const gn = Math.round(boxEdgeM / dx) + 5; // nodes per axis (with padding); index shift +1
  const shift = 1;
  const nodeIndex = (i, j, k) => ((i + shift) * gn + (j + shift)) * gn + (k + shift);
  const inRange = (i) => i + shift >= 0 && i + shift < gn;

  function ensureParticleState(p) {
    if (p.mpmJ === undefined) {
      p.mpmJ = 1;
      p.mpmC = new Float64Array(9);
      const rho0 = restDensityOf(p);
      p.mpmVolume0 = p.massKg / rho0;
    }
  }

  function step(state) {
    const particles = state.particles;
    const n = particles.length;
    const ng = gn * gn * gn;
    const gridMass = new Float64Array(ng);
    const gridMom = new Float64Array(ng * 3); // momentum, then velocity in place

    // --- P2G: scatter mass, momentum (APIC) + internal stress to the grid ---
    for (let pi = 0; pi < n; pi += 1) {
      const p = particles[pi];
      ensureParticleState(p);
      const volume = p.mpmVolume0 * p.mpmJ;
      const density = p.massKg / volume; // = rho0 / J
      const pressure = eos({ density, specificInternalEnergyJPerKg: p.specificInternalEnergyJPerKg, particle: p }).pressurePa;
      // Affine matrix: APIC (m C) + MLS stress term (stress = -p I; ∇w = (4/dx^2)(x_i-x_p) w).
      const stressScale = dt * volume * 4 * invDx * invDx * pressure; // adds to the diagonal (pressure pushes out)
      const C = p.mpmC;
      const aff = new Float64Array(9);
      for (let a = 0; a < 9; a += 1) aff[a] = p.massKg * C[a];
      aff[0] += stressScale; aff[4] += stressScale; aff[8] += stressScale;

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
        if (!inRange(baseX + a)) continue;
        for (let b = 0; b < 3; b += 1) {
          if (!inRange(baseY + b)) continue;
          for (let c = 0; c < 3; c += 1) {
            if (!inRange(baseZ + c)) continue;
            const w = wx[a] * wy[b] * wz[c];
            // dpos = node - particle  (Bohr→ m; node at (base+offset)*dx)
            const dposx = (baseX + a - p.x[0] * invDx) * dx;
            const dposy = (baseY + b - p.x[1] * invDx) * dx;
            const dposz = (baseZ + c - p.x[2] * invDx) * dx;
            const idx = nodeIndex(baseX + a, baseY + b, baseZ + c);
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
    for (let i = 0; i < gn; i += 1) {
      for (let j = 0; j < gn; j += 1) {
        for (let k = 0; k < gn; k += 1) {
          const idx = (i * gn + j) * gn + k;
          const m = gridMass[idx];
          if (m <= 0) continue;
          let vx = gridMom[idx * 3] / m + dt * gravity[0];
          let vy = gridMom[idx * 3 + 1] / m + dt * gravity[1];
          let vz = gridMom[idx * 3 + 2] / m + dt * gravity[2];
          // Sticky/slip walls at the box faces (node world position = (index - shift) * dx).
          const wx = (i - shift) * dx;
          const wy = (j - shift) * dx;
          const wz = (k - shift) * dx;
          if (wx < dx && vx < 0) vx = -vx * wallRestitution;
          if (wx > boxEdgeM - dx && vx > 0) vx = -vx * wallRestitution;
          if (wy < dx && vy < 0) vy = -vy * wallRestitution;
          if (wy > boxEdgeM - dx && vy > 0) vy = -vy * wallRestitution;
          if (wz < dx && vz < 0) vz = -vz * wallRestitution;
          if (wz > boxEdgeM - dx && vz > 0) vz = -vz * wallRestitution;
          gridMom[idx * 3] = vx;
          gridMom[idx * 3 + 1] = vy;
          gridMom[idx * 3 + 2] = vz;
        }
      }
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
      for (let a = 0; a < 3; a += 1) {
        if (!inRange(baseX + a)) continue;
        for (let b = 0; b < 3; b += 1) {
          if (!inRange(baseY + b)) continue;
          for (let c = 0; c < 3; c += 1) {
            if (!inRange(baseZ + c)) continue;
            const w = wx[a] * wy[b] * wz[c];
            const idx = nodeIndex(baseX + a, baseY + b, baseZ + c);
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
      p.v[0] = nvx; p.v[1] = nvy; p.v[2] = nvz;
      p.mpmC = C;
      p.x[0] += dt * nvx; p.x[1] += dt * nvy; p.x[2] += dt * nvz;
      // Volume update for the weakly-compressible fluid: J *= (1 + dt tr(C)).
      p.mpmJ *= 1 + dt * (C[0] + C[4] + C[8]);
      if (p.mpmJ < 0.1) p.mpmJ = 0.1; // guard against collapse
      // Keep particles inside the box.
      for (let d = 0; d < 3; d += 1) {
        if (p.x[d] < 0) p.x[d] = 0;
        else if (p.x[d] > boxEdgeM) p.x[d] = boxEdgeM;
      }
    }
    state.step = (state.step ?? 0) + 1;
    state.time = (state.time ?? 0) + dt;
    return { state };
  }

  return { backend: 'mls-mpm', integrator: 'apic', dt, gridNodesPerAxis: gn, step };
}
