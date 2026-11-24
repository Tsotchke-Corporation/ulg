/**
 * Pure Initial-Condition Cloud Builders for Self-Gravitating Molecular Nebulae.
 *
 * Strictly specifies initial `(pos, mass, vel, T_0, rho_0, X_H, X_He, X_Z)` ONLY!
 * Contains ZERO dynamics, ZERO phase triggers, and ZERO preset-specific laws:
 * every scenario is fed verbatim into ULG's general `self-gravitating-hydro@1`
 * runtime engine with the exact same universal physical laws.
 */

import {
  HYDRO_PARTICLE_STRIDE_FLOATS,
  SIM_MASS_PER_SOLAR_MASS
} from '../sph/selfGravitatingHydroGpu.js';

export const NEBULA_INITIAL_CONDITIONS = Object.freeze({
  'solar-nebula': Object.freeze({
    id: 'solar-nebula',
    label: 'Solar Nebula (1.0 M☉)',
    shortLabel: '1 M☉ Solar Star',
    description: 'Cold 25 K turbulent 1.0 M☉ H₂ cloud fed into ULG general self-gravitating hydro + quantum plasma EOS & Gamow fusion laws.',
    totalMassSolar: 1.0,
    initialTempK: 25,
    initialLog10Rho: -16.0,
    angularMomentum: 0.44,
    cloudRadius: 9.0,
    geometry: 'bonnor-ebert'
  }),
  'massive-supernova': Object.freeze({
    id: 'massive-supernova',
    label: 'Massive Cloud → Supernova (18 M☉)',
    shortLabel: '18 M☉ Supernova',
    description: 'Identical laws, 18× heavier initial hydrogen particles -> rapid CNO/triple-α burn -> Fe photodisintegration collapse -> nuclear-saturation EOS bounce & Black Hole.',
    totalMassSolar: 18.0,
    initialTempK: 36,
    initialLog10Rho: -15.3,
    angularMomentum: 0.22,
    cloudRadius: 8.6,
    geometry: 'bonnor-ebert'
  }),
  'binary-nursery': Object.freeze({
    id: 'binary-nursery',
    label: 'Binary Star Nursery (2.4 M☉)',
    shortLabel: '2.4 M☉ Binary',
    description: 'Identical laws on a rotating twin-lobe 2.4 M☉ molecular cloud fragmenting into two orbiting fusing stars linked by tidal gas.',
    totalMassSolar: 2.4,
    initialTempK: 28,
    initialLog10Rho: -15.7,
    angularMomentum: 0.65,
    cloudRadius: 9.5,
    geometry: 'twin-lobe'
  })
});

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a 16-float (`64 B`) initial particle buffer for a cold molecular
 * hydrogen nebula. Presets differ ONLY by total cloud mass (`m_i = M / N`),
 * angular momentum, and initial geometry — NEVER by physics law flags!
 */
export function createHydrogenNebulaInitialBodies({
  count = 8192,
  preset = 'solar-nebula',
  gravityG = 0.42,
  seed = 1939,
  centerOffset = [0, 0, 0]
} = {}) {
  const cfg = NEBULA_INITIAL_CONDITIONS[preset] || NEBULA_INITIAL_CONDITIONS['solar-nebula'];
  const n = Math.max(256, Math.min(32768, Math.floor(count)));
  const bodies = new Float32Array(n * HYDRO_PARTICLE_STRIDE_FLOATS);
  const ox = Number(centerOffset?.[0]) || 0;
  const oy = Number(centerOffset?.[1]) || 0;
  const oz = Number(centerOffset?.[2]) || 0;
  const rand = mulberry32(seed + (preset === 'massive-supernova' ? 101 : preset === 'binary-nursery' ? 202 : 0));
  const gauss = () => {
    const u1 = Math.max(1e-7, rand());
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  // True linear physical mass: 18 M_sun literally has exact 18x mass per particle!
  const simTotalMass = cfg.totalMassSolar * SIM_MASS_PER_SOLAR_MASS;
  const particleMass = simTotalMass / n;
  const logT0 = Math.log10(cfg.initialTempK);
  const logRho0 = cfg.initialLog10Rho;

  const modes = [];
  for (let m = 0; m < 8; m += 1) {
    modes.push({
      kx: (rand() - 0.5) * 0.72,
      ky: (rand() - 0.5) * 0.72,
      kz: (rand() - 0.5) * 0.72,
      phase: rand() * Math.PI * 2,
      amp: 0.45 + rand() * 0.65
    });
  }

  for (let i = 0; i < n; i += 1) {
    const off = i * HYDRO_PARTICLE_STRIDE_FLOATS;
    let x; let y; let z;
    let vx; let vy; let vz;

    let localCenterX = 0;
    if (cfg.geometry === 'twin-lobe') {
      const lobe = i & 1;
      const sign = lobe === 0 ? -1 : 1;
      const sepHalf = 4.5;
      localCenterX = sign * sepHalf;
      const isBridge = i % 10 === 0;
      if (isBridge) {
        const s = (rand() * 2 - 1) * sepHalf;
        x = s;
        y = gauss() * 0.65;
        z = gauss() * 0.85 + Math.sin(s * 0.55) * 0.75;
        localCenterX = s;
      } else {
        // Two Jeans-unstable cores in true circular Keplerian mutual orbit (v = sqrt(G M_tot / (4 a)))
        const u = Math.pow(rand(), 1.15);
        const r = 0.18 + u * 2.55;
        const cosPh = 2 * rand() - 1;
        const sinPh = Math.sqrt(Math.max(0, 1 - cosPh * cosPh));
        const th = rand() * Math.PI * 2;
        x = sign * sepHalf + r * sinPh * Math.cos(th);
        y = r * cosPh * 0.62;
        z = r * sinPh * Math.sin(th);
      }
      const vKepler = Math.sqrt((gravityG * simTotalMass) / (4.0 * sepHalf)) * 1.04;
      const lx = x - sign * sepHalf;
      const lz = z;
      const lr = Math.hypot(lx, lz) + 0.35;
      const vSpin = Math.sqrt((gravityG * simTotalMass * 0.22) / (lr + 0.6)) * 0.42;
      vx = (isBridge ? (-z / (Math.hypot(x, z) + 0.5)) * vKepler * 0.7 : (-lz / lr) * vSpin) + gauss() * 0.10;
      vy = gauss() * 0.08;
      vz = (isBridge ? (x / (Math.hypot(x, z) + 0.5)) * vKepler * 0.7 : sign * vKepler + (lx / lr) * vSpin) + gauss() * 0.10;
    } else {
      const isOuterHalo = i > n * 0.72;
      const u = rand();
      const r = isOuterHalo
        ? 3.3 + Math.pow(u, 0.8) * (cfg.cloudRadius - 3.3)
        : 0.18 + Math.pow(u, 1.28) * 5.0;
      const cosPh = 2 * rand() - 1;
      const sinPh = Math.sqrt(Math.max(0, 1 - cosPh * cosPh));
      const th = rand() * Math.PI * 2;
      const qx = r * sinPh * Math.cos(th);
      const qy = r * cosPh * (isOuterHalo ? 0.56 : 0.78);
      const qz = r * sinPh * Math.sin(th);

      let dx = 0; let dy = 0; let dz = 0;
      for (const m of modes) {
        const s = Math.sin(m.kx * qx + m.ky * qy + m.kz * qz + m.phase) * m.amp;
        dx += m.kx * s;
        dy += m.ky * s;
        dz += m.kz * s;
      }
      x = qx + dx * 0.92;
      y = qy + dy * 0.62;
      z = qz + dz * 0.92;

      const rXz = Math.hypot(x, z) + 0.35;
      const spinProfile = isOuterHalo ? 1.05 : (0.30 + 0.55 * Math.min(1, rXz / 6.0));
      const vRot = Math.sqrt((gravityG * simTotalMass * 0.38) / (rXz + 1.1)) * cfg.angularMomentum * spinProfile;
      const vInfall = isOuterHalo ? -0.06 : -0.18;
      const r3 = Math.hypot(x, y, z) + 0.4;
      vx = (-z / rXz) * vRot + (x / r3) * vInfall + gauss() * 0.14;
      vy = (y / r3) * vInfall * 0.8 + gauss() * 0.10;
      vz = (x / rXz) * vRot + (z / r3) * vInfall + gauss() * 0.14;
    }

    // Measure local core boost from each lobe's own center (translation- & multi-body-invariant!)
    const rInit = Math.hypot(x - localCenterX, y, z);
    const coreBoost = Math.exp(-rInit * rInit / 12.0);
    const localLogRho = logRho0 + coreBoost * 1.0;
    const localLogT = logT0 + coreBoost * 0.10;
    const hSmooth = 0.32 + 0.04 * Math.min(6, rInit);

    // Primordial cosmic abundances: X_H = 0.74, X_He = 0.25, X_Z = 0.01 (sum == 1.0)
    bodies[off + 0] = x + ox;
    bodies[off + 1] = y + oy;
    bodies[off + 2] = z + oz;
    bodies[off + 3] = particleMass;
    bodies[off + 4] = vx;
    bodies[off + 5] = vy;
    bodies[off + 6] = vz;
    bodies[off + 7] = hSmooth;
    bodies[off + 8] = localLogT;
    bodies[off + 9] = localLogRho;
    bodies[off + 10] = 0.74;
    bodies[off + 11] = -30.0;
    bodies[off + 12] = 0.998;
    bodies[off + 13] = 0.0;
    bodies[off + 14] = 0.25;
    bodies[off + 15] = 0.01;
  }
  return bodies;
}
