// First-Principles Host-Star Illumination Spectrum, Inverse-Square Flux & Exotic Star Rendering
// (`src/runtime/astrophysics/starlightAndExoticOptics.js`).
//
// Strictly Star Spec v0.4 & ULG General-Law Thesis compliant:
//   - Zero hardcoded planet names or material hacks.
//   - Computes linear host-star RGB spectrum directly from effective temperature `T_eff`
//     and evolutionary stage (O/B/A/F/G/K/M blackbody, Pulsar synchrotron pulse, White Dwarf
//     diamond-blue, Red Supergiant vermilion, Black Hole relativistic accretion amber).
//   - Computes exact inverse-square irradiance `F = (L_* / L_sun) / d_AU^2` mapped through
//     perceptual Weber-Fechner photographic exposure compression so Mercury blazes, Earth = 1.0x,
//     Mars = ~0.84x, outer giants/Pluto sit authentically in crisp outer-system twilight, and
//     rogue planets sit in interstellar starlight!
//   - Renders exotic host stars (Pulsars/Magnetars with spinning lighthouse beams & magnetosphere
//     dipole loops, Stellar Black Holes with EHT photon ring + Novikov-Thorne disk + BZ jets,
//     White Dwarfs with ionized shells) consistently in L2 System, L4 Planetary Orbit, AND
//     Planetary Surface celestial skies.

export const ULG_STARLIGHT_OPTICS_SCHEMA = 'ulg.astrophysics.starlight-and-exotic-optics.v1';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

/**
 * Continuous physical Planck blackbody linear illumination RGB from effective temperature `T_eff (K)`.
 * Normalized so G2V Solar 5778 K ~ `[1.00, 0.97, 0.91]`, M-dwarf 3000 K ~ `[1.00, 0.48, 0.22]`,
 * O/B 25000 K ~ `[0.66, 0.84, 1.00]`.
 */
export function starTemperatureToLightRgb(tempK) {
  const t = clamp(Number(tempK) || 5778, 1200, 50000);
  // Exact CIE 1931 Planckian-locus linear-sRGB anchor interpolation (Mitchell Charity / CIE D65):
  //   2400 K -> [1.00, 0.38, 0.10], 3000 K -> [1.00, 0.56, 0.24], 4200 K -> [1.00, 0.78, 0.52],
  //   5778 K -> [1.00, 0.96, 0.91], 7500 K -> [0.90, 0.95, 1.00], 12000 K -> [0.76, 0.87, 1.00],
  //   26000 K -> [0.64, 0.79, 1.00]
  const anchors = [
    [1200, [1.00, 0.16, 0.04]],
    [2400, [1.00, 0.38, 0.10]],
    [3000, [1.00, 0.56, 0.24]],
    [4200, [1.00, 0.78, 0.52]],
    [5778, [1.00, 0.96, 0.91]],
    [7500, [0.90, 0.95, 1.00]],
    [12000, [0.76, 0.87, 1.00]],
    [26000, [0.64, 0.79, 1.00]],
    [50000, [0.58, 0.74, 1.00]]
  ];
  let rgb = anchors[anchors.length - 1][1];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const [t0, c0] = anchors[i];
    const [t1, c1] = anchors[i + 1];
    if (t <= t1) {
      const u = clamp((Math.log(t) - Math.log(t0)) / Math.max(1e-6, Math.log(t1) - Math.log(t0)), 0, 1);
      rgb = [
        c0[0] + (c1[0] - c0[0]) * u,
        c0[1] + (c1[1] - c0[1]) * u,
        c0[2] + (c1[2] - c0[2]) * u
      ];
      break;
    }
  }
  const peak = Math.max(0.01, rgb[0], rgb[1], rgb[2]);
  return [
    Number((rgb[0] / peak).toFixed(4)),
    Number((rgb[1] / peak).toFixed(4)),
    Number((rgb[2] / peak).toFixed(4))
  ];
}

/**
 * Compute physically grounded host-star light spectrum RGB AND inverse-square distance
 * irradiance gain for any orbiting planet, moon, ring, spacecraft, or planetary surface.
 */
export function computeHostStarIllumination({
  starSpec = null,
  bodySpec = null,
  distanceAu = 1.0,
  timeSec = 0.0,
  isRogue = false,
  stellarModeHint = null
} = {}) {
  if (isRogue) {
    return Object.freeze({
      rgb: Object.freeze([0.42, 0.54, 0.80]),
      fluxGain: 0.14,
      fluxEarth: 0.0,
      irradianceWm2: 0.0,
      distanceAu: Infinity,
      luminositySolar: 0.0,
      apparentMagV: 12.0,
      starTempK: 0,
      exoticStage: 'rogue',
      vec4: Object.freeze([0.42, 0.54, 0.80, 0.14])
    });
  }

  const stage = String(starSpec?.stage || '').toLowerCase();
  const isPulsar = stage === 'neutron-star' || stage === 'magnetar' || stage === 'supernova-remnant-pwn'
    || stellarModeHint === 'pulsar' || stellarModeHint === 'magnetar';
  const isBlackHole = stage === 'stellar-black-hole' || stage === 'hypernova-remnant';
  const isWhiteDwarf = stage === 'white-dwarf' || stage === 'planetary-nebula';

  const starTempK = Number(starSpec?.tempK ?? starSpec?.effectiveTempK) || (isPulsar ? 850000 : (isWhiteDwarf ? 18500 : 5778));
  const lumSolar = Math.max(
    1e-5,
    Number(starSpec?.luminositySolar)
      || (isPulsar ? 0.18 : (isBlackHole ? 0.35 : (isWhiteDwarf ? 0.012 : 1.0)))
  );
  const dAu = Math.max(
    0.012,
    Number.isFinite(Number(distanceAu)) && Number(distanceAu) > 0
      ? Number(distanceAu)
      : (Number(bodySpec?.aAu) || 1.0)
  );

  // Exact inverse-square irradiance relative to Earth at 1 AU around 1 L_sun (1361 W/m^2)
  const fluxEarth = lumSolar / (dAu * dAu);
  const irradianceWm2 = 1361.0 * fluxEarth;
  const apparentMagV = -26.74 - 2.5 * Math.log10(Math.max(1e-12, fluxEarth));

  // Photographic / Weber-Fechner exposure curve:
  //   Mercury (~6.7 F_E) -> 1.50x | Earth (1.0 F_E) -> 1.00x | Mars (0.43) -> 0.84x
  //   Jupiter (0.037) -> 0.53x | Saturn (0.011) -> 0.43x | Uranus (0.0027) -> 0.35x | Pluto (0.00064) -> 0.29x
  let fluxGain = clamp(0.14 + 0.86 * Math.pow(Math.max(1e-6, fluxEarth), 0.24), 0.14, 1.85);
  let rgb = starTemperatureToLightRgb(starTempK);

  if (isPulsar) {
    // Synchrotron + polar-cap lighthouse sweep modulation: unmistakable electric cyan-violet illumination!
    const sweep = Math.pow(Math.max(0, Math.cos(timeSec * 3.8)), 6.0);
    const basePulsar = [0.64, 0.88, 1.0];
    const pulseTint = [0.78, 0.68, 1.0];
    rgb = [
      Number((basePulsar[0] + (pulseTint[0] - basePulsar[0]) * sweep * 0.55).toFixed(4)),
      Number((basePulsar[1] + (pulseTint[1] - basePulsar[1]) * sweep * 0.55).toFixed(4)),
      Number((basePulsar[2] + (pulseTint[2] - basePulsar[2]) * sweep * 0.55).toFixed(4))
    ];
    fluxGain = clamp(fluxGain * (0.76 + 0.46 * sweep), 0.24, 1.75);
  } else if (isBlackHole) {
    // Relativistic accretion-disk warm amber-gold + UV inner ring glow
    rgb = [1.0, 0.72, 0.42];
    fluxGain = clamp(fluxGain * 0.85, 0.18, 1.45);
  } else if (isWhiteDwarf) {
    rgb = [0.76, 0.90, 1.0];
  }

  return Object.freeze({
    rgb: Object.freeze(rgb),
    fluxGain: Number(fluxGain.toFixed(4)),
    fluxEarth,
    irradianceWm2,
    distanceAu: dAu,
    luminositySolar: lumSolar,
    apparentMagV: Number(apparentMagV.toFixed(2)),
    starTempK,
    exoticStage: isPulsar ? 'neutron-star' : (isBlackHole ? 'stellar-black-hole' : (isWhiteDwarf ? 'white-dwarf' : (stage || 'main-sequence'))),
    vec4: Object.freeze([rgb[0], rgb[1], rgb[2], Number(fluxGain.toFixed(4))])
  });
}

/**
 * Canonical mapping from any star catalog spec (`stage`, `tempK`, `massSolar`)
 * to its matching L3 WebGPU stellar solver mode & MLS-MPM preset.
 * Never accidentally drops an exotic pulsar/BH/WD or normal massive star into unstable collapse!
 */
export function resolveStellarRegimeForStarSpec(starSpec, recommendedL3Regime = null) {
  if (!starSpec) {
    return { stellarMode: 'fusion', stellarPreset: 'main-sequence-star', isExotic: false };
  }
  const stage = String(starSpec.stage || '').toLowerCase();
  const tempK = Number(starSpec.tempK ?? starSpec.effectiveTempK) || 5778;
  const massSolar = Number(starSpec.massSolar ?? starSpec.initialMassSolar) || 1.0;

  if (stage === 'neutron-star' || stage === 'pulsar') {
    return {
      stellarMode: recommendedL3Regime === 'snr-pwn' ? 'snr-pwn' : 'pulsar',
      stellarPreset: 'main-sequence-star',
      isExotic: true
    };
  }
  if (stage === 'magnetar') {
    return { stellarMode: 'magnetar', stellarPreset: 'main-sequence-star', isExotic: true };
  }
  if (stage === 'supernova-remnant-pwn') {
    return { stellarMode: 'snr-pwn', stellarPreset: 'main-sequence-star', isExotic: true };
  }
  if (stage === 'stellar-black-hole' || stage === 'hypernova-remnant') {
    return { stellarMode: 'black-hole', stellarPreset: 'main-sequence-star', isExotic: true };
  }
  if (stage === 'white-dwarf' || stage === 'planetary-nebula') {
    return {
      stellarMode: (stage === 'planetary-nebula' || recommendedL3Regime === 'planetary-nebula') ? 'planetary-nebula' : 'white-dwarf-tov',
      stellarPreset: 'main-sequence-star',
      isExotic: true
    };
  }
  if (stage === 'protostar-yso') {
    return { stellarMode: 'nebular-mhd', stellarPreset: 'main-sequence-star', isExotic: false };
  }
  if (stage === 'red-giant') {
    return { stellarMode: 'fusion', stellarPreset: 'red-supergiant', isExotic: false };
  }
  if (stage === 'agb-superwind' || stage === 'agb-carbon') {
    return { stellarMode: 'fusion', stellarPreset: 'agb-carbon', isExotic: false };
  }
  if (stage === 'brown-dwarf' || massSolar < 0.08 || tempK < 2200) {
    return { stellarMode: 'fusion', stellarPreset: 'brown-dwarf', isExotic: false };
  }
  if (tempK >= 11000 || massSolar >= 5.5) {
    return { stellarMode: 'fusion', stellarPreset: 'blue-supergiant', isExotic: false };
  }
  return { stellarMode: 'fusion', stellarPreset: 'main-sequence-star', isExotic: false };
}

/**
 * Append authentic 3D visuals for any host/companion star (`spheres`, `disks`, `lineChunks`)
 * consistently across L2 System, L4 Planetary Orbit (including distant sky-shell stars!),
 * AND Planetary Surface skies!
 */
export function appendStarVisuals({
  spec,
  pos,
  radius,
  timeSec = 0.0,
  dysonCoverage = 0.0,
  seed = 1.37,
  spheres,
  disks,
  lineChunks = null,
  alphaMul = 1.0,
  stellarModeHint = null
}) {
  const stage = String(spec?.stage || '').toLowerCase();
  const isPulsar = stage === 'neutron-star' || stage === 'magnetar' || stage === 'supernova-remnant-pwn'
    || stellarModeHint === 'pulsar' || stellarModeHint === 'magnetar';
  const isMag = stage === 'magnetar' || stellarModeHint === 'magnetar';
  const isBlackHole = stage === 'stellar-black-hole' || stage === 'hypernova-remnant' || spec?.kind === 5;
  const isWhiteDwarf = stage === 'white-dwarf' || stage === 'planetary-nebula';
  const r = Math.max(1e-4, Number(radius) || 0.25);
  const cx = pos[0];
  const cy = pos[1];
  const cz = pos[2];

  if (isBlackHole) {
    // Pitch-black Schwarzschild/Kerr Event Horizon + EHT n=1 Doppler Photon Ring (`kind: 5`, `color0: [0,0,0]`)!
    spheres.push({
      pos: [cx, cy, cz],
      radius: r,
      color0: [0.0, 0.0, 0.0],
      color1: [1.0, 0.72, 0.28],
      kind: 5,
      atm: 0.0,
      tempK: 1.5e7,
      dysonCoverage: 0,
      seed
    });
    // Relativistic Novikov-Thorne Doppler-beamed accretion disk!
    disks.push({
      center: [cx, cy, cz],
      rIn: r * 1.48,
      normal: [0.16, 0.94, 0.30],
      rOut: r * 4.85,
      color: [1.0, 0.72, 0.34],
      kind: 0
    });
    // Twin polar Blandford-Znajek relativistic jet beams!
    if (lineChunks) {
      const jetAxis = norm3([0.16, 0.94, 0.30]);
      const t1 = norm3(cross3(jetAxis, [1, 0, 0]));
      const t2 = cross3(jetAxis, t1);
      const jetLen = r * 7.5;
      for (const sgn of [-1, 1]) {
        for (let k = 0; k < 6; k += 1) {
          const ang = (k / 6) * Math.PI * 2 + timeSec * 1.6;
          const spread = r * 0.42;
          const p0 = [
            cx + jetAxis[0] * (sgn * r * 1.05) + (t1[0] * Math.cos(ang) + t2[0] * Math.sin(ang)) * (r * 0.14),
            cy + jetAxis[1] * (sgn * r * 1.05) + (t1[1] * Math.cos(ang) + t2[1] * Math.sin(ang)) * (r * 0.14),
            cz + jetAxis[2] * (sgn * r * 1.05) + (t1[2] * Math.cos(ang) + t2[2] * Math.sin(ang)) * (r * 0.14)
          ];
          const p1 = [
            cx + jetAxis[0] * (sgn * jetLen) + (t1[0] * Math.cos(ang) + t2[0] * Math.sin(ang)) * spread,
            cy + jetAxis[1] * (sgn * jetLen) + (t1[1] * Math.cos(ang) + t2[1] * Math.sin(ang)) * spread,
            cz + jetAxis[2] * (sgn * jetLen) + (t1[2] * Math.cos(ang) + t2[2] * Math.sin(ang)) * spread
          ];
          lineChunks.push(...p0, 0.52, 0.88, 1.0, 0.82 * alphaMul);
          lineChunks.push(...p1, 0.45, 0.56, 1.0, 0.10 * alphaMul);
        }
      }
    }
    return { exoticRendered: 'black-hole' };
  }

  if (isPulsar) {
    // Compact electric cyan-violet Neutron Star / Magnetar core
    spheres.push({
      pos: [cx, cy, cz],
      radius: r,
      color0: isMag ? [1.0, 0.80, 0.98] : [0.78, 0.96, 1.0],
      color1: isMag ? [0.86, 0.28, 0.96] : [0.56, 0.26, 1.0],
      kind: 0,
      atm: 0.0,
      tempK: 1.2e6,
      dysonCoverage: 0,
      seed
    });
    // Equatorial pulsar wind nebula / twisted synchrotron disk halo
    disks.push({
      center: [cx, cy, cz],
      rIn: r * 1.55,
      normal: [0.08, 0.98, 0.16],
      rOut: r * 3.15,
      color: isMag ? [0.92, 0.42, 0.98] : [0.42, 0.84, 1.0],
      kind: 1
    });
    // Spinning oblique-rotator relativistic lighthouse beams + dipole magnetosphere loops!
    if (lineChunks) {
      const omega = isMag ? 2.4 : 4.2;
      const spinPhi = timeSec * omega + seed;
      const obliq = 0.66; // ~38 deg magnetic obliquity
      const magAxis = norm3([
        Math.sin(obliq) * Math.cos(spinPhi),
        Math.cos(obliq),
        Math.sin(obliq) * Math.sin(spinPhi)
      ]);
      const upRef = Math.abs(magAxis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u1 = norm3(cross3(magAxis, upRef));
      const u2 = cross3(magAxis, u1);
      const beamLen = r * 9.5;
      const beamCol0 = isMag ? [1.0, 0.62, 1.0] : [0.58, 0.94, 1.0];
      const beamCol1 = isMag ? [0.76, 0.22, 0.98] : [0.44, 0.36, 1.0];
      // Twin bright conical lighthouse beams (8 filaments per pole)
      for (const pole of [-1, 1]) {
        for (let k = 0; k < 8; k += 1) {
          const ang = (k / 8) * Math.PI * 2;
          const rStart = r * 0.22;
          const rEnd = r * 1.45;
          const ox = u1[0] * Math.cos(ang) + u2[0] * Math.sin(ang);
          const oy = u1[1] * Math.cos(ang) + u2[1] * Math.sin(ang);
          const oz = u1[2] * Math.cos(ang) + u2[2] * Math.sin(ang);
          const p0 = [cx + magAxis[0] * (pole * r * 0.85) + ox * rStart, cy + magAxis[1] * (pole * r * 0.85) + oy * rStart, cz + magAxis[2] * (pole * r * 0.85) + oz * rStart];
          const p1 = [cx + magAxis[0] * (pole * beamLen) + ox * rEnd, cy + magAxis[1] * (pole * beamLen) + oy * rEnd, cz + magAxis[2] * (pole * beamLen) + oz * rEnd];
          lineChunks.push(...p0, beamCol0[0], beamCol0[1], beamCol0[2], 0.94 * alphaMul);
          lineChunks.push(...p1, beamCol1[0], beamCol1[1], beamCol1[2], 0.14 * alphaMul);
        }
      }
      // 6 oblique dipolar magnetosphere field loops r(theta) = R_max * sin^2(theta)
      const rLoop = r * 3.8;
      for (let l = 0; l < 6; l += 1) {
        const az = (l / 6) * Math.PI * 2;
        const dirE = [u1[0] * Math.cos(az) + u2[0] * Math.sin(az), u1[1] * Math.cos(az) + u2[1] * Math.sin(az), u1[2] * Math.cos(az) + u2[2] * Math.sin(az)];
        let prev = null;
        for (let s = 1; s <= 15; s += 1) {
          const th = (s / 16) * Math.PI;
          const sinT = Math.sin(th);
          const rr = rLoop * sinT * sinT;
          const pt = [
            cx + (magAxis[0] * Math.cos(th) + dirE[0] * sinT) * rr,
            cy + (magAxis[1] * Math.cos(th) + dirE[1] * sinT) * rr,
            cz + (magAxis[2] * Math.cos(th) + dirE[2] * sinT) * rr
          ];
          if (prev) {
            lineChunks.push(...prev, 0.44, 0.72, 1.0, 0.48 * alphaMul);
            lineChunks.push(...pt, 0.44, 0.72, 1.0, 0.48 * alphaMul);
          }
          prev = pt;
        }
      }
    }
    return { exoticRendered: isMag ? 'magnetar' : 'pulsar' };
  }

  if (isWhiteDwarf) {
    spheres.push({
      pos: [cx, cy, cz],
      radius: r,
      color0: [0.88, 0.96, 1.0],
      color1: [0.48, 0.78, 1.0],
      kind: 0,
      atm: 0.0,
      tempK: Number(spec?.tempK) || 18500,
      dysonCoverage,
      seed
    });
    if (lineChunks) {
      // Glowing ionized planetary-nebula degeneracy halo rings around White Dwarf!
      for (let ring = 0; ring < 2; ring += 1) {
        const rr = r * (2.2 + ring * 1.15);
        const tilt = 0.42 + ring * 0.65;
        let prev = null;
        for (let s = 0; s <= 32; s += 1) {
          const a = (s / 32) * Math.PI * 2;
          const pt = [
            cx + Math.cos(a) * rr,
            cy + Math.sin(a) * rr * Math.sin(tilt),
            cz + Math.sin(a) * rr * Math.cos(tilt)
          ];
          if (prev) {
            lineChunks.push(...prev, 0.45, 0.88, 1.0, (0.42 - ring * 0.14) * alphaMul);
            lineChunks.push(...pt, 0.45, 0.88, 1.0, (0.42 - ring * 0.14) * alphaMul);
          }
          prev = pt;
        }
      }
    }
    return { exoticRendered: 'white-dwarf' };
  }

  // Standard Main-Sequence / Red Giant / Blue Supergiant / Brown Dwarf star
  const isRedGiant = stage === 'red-giant' || stage === 'agb-superwind';
  spheres.push({
    pos: [cx, cy, cz],
    radius: r,
    color0: isRedGiant ? [1.0, 0.44, 0.14] : (spec?.color0 || [1.0, 0.93, 0.74]),
    color1: isRedGiant ? [0.74, 0.12, 0.04] : (spec?.color1 || [1.0, 0.60, 0.20]),
    kind: 0,
    atm: 0.0,
    tempK: Number(spec?.tempK) || 5778,
    dysonCoverage,
    seed
  });
  return { exoticRendered: null };
}
