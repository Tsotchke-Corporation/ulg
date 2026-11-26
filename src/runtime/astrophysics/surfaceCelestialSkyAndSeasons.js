// Canonical First-Principles Planetary Surface Celestial Sky, Multi-Star Eclipses,
// Emergent Milankovitch Seasons, & Orbital L4 Atmospheric CFD Wind Streamlines
// (`src/runtime/astrophysics/surfaceCelestialSkyAndSeasons.js`).
//
// Strictly Star Spec v0.4 compliant:
//   - ZERO planet-name hacks, ZERO scripted sun-orbit loops: host star(s), moons,
//     planetary rings, and sibling planets move strictly according to live WebGPU
//     double-float symplectic N-body positions + physical planetary spin & obliquity!
//   - Seasons, snowline altitude, and sea-ice freeze-thaw emerge continuously from
//     axial obliquity, orbital declination, stellar flux, and active solvent T_melt!

import { AU_METERS } from './solarSystemNBodyGpu.js';

function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Construct the exact orthonormal rotating surface tangent basis `(east, up, south)`
 * in ecliptic coordinates from physical obliquity, spin-axis longitude, observer latitude,
 * and sidereal rotation phase `spinAngleRad` (or synchronous tidal-lock subsolar alignment).
 */
export function buildSurfaceTangentBasis({
  axialObliquityDeg = 23.44,
  spinAxisLonDeg = 90.0,
  observerLatDeg = 28.0,
  spinAngleRad = 0.0,
  tidallyLocked = false,
  toPrimaryStarUnit = null
} = {}) {
  const deg = Math.PI / 180;
  const obl = axialObliquityDeg * deg;
  const lon = spinAxisLonDeg * deg;
  // North spin pole unit vector in ecliptic coordinates (Y = ecliptic north!)
  const pole = norm3([
    Math.sin(obl) * Math.cos(lon),
    Math.cos(obl),
    Math.sin(obl) * Math.sin(lon)
  ]);
  const ref = Math.abs(pole[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  let eqA = norm3(cross3(ref, pole));
  let eqB = norm3(cross3(pole, eqA));

  // If tidally locked and we have the live vector toward the host star, orient the equatorial
  // prime meridian toward the substellar point so daylight/twilight stays physically locked!
  if (tidallyLocked && Array.isArray(toPrimaryStarUnit)) {
    const proj = [
      toPrimaryStarUnit[0] - pole[0] * dot3(toPrimaryStarUnit, pole),
      toPrimaryStarUnit[1] - pole[1] * dot3(toPrimaryStarUnit, pole),
      toPrimaryStarUnit[2] - pole[2] * dot3(toPrimaryStarUnit, pole)
    ];
    if (Math.hypot(proj[0], proj[1], proj[2]) > 1e-4) {
      eqA = norm3(proj);
      eqB = norm3(cross3(pole, eqA));
    }
  }

  const phi = Math.max(-85, Math.min(85, observerLatDeg)) * deg;
  const cPhi = Math.cos(phi);
  const sPhi = Math.sin(phi);
  const cLam = Math.cos(spinAngleRad);
  const sLam = Math.sin(spinAngleRad);

  // Local meridian vector in equatorial plane
  const mer = [
    eqA[0] * cLam + eqB[0] * sLam,
    eqA[1] * cLam + eqB[1] * sLam,
    eqA[2] * cLam + eqB[2] * sLam
  ];
  // Local Up (surface outward normal), East (direction of prograde spin!), South (right-handed XZ = East x Up)
  const up = norm3([
    mer[0] * cPhi + pole[0] * sPhi,
    mer[1] * cPhi + pole[1] * sPhi,
    mer[2] * cPhi + pole[2] * sPhi
  ]);
  const east = norm3([
    -eqA[0] * sLam + eqB[0] * cLam,
    -eqA[1] * sLam + eqB[1] * cLam,
    -eqA[2] * sLam + eqB[2] * cLam
  ]);
  const south = norm3(cross3(east, up));
  return { pole, eqA, eqB, east, up, south, observerLatRad: phi };
}

/**
 * Exact circle-circle angular occultation fraction `f_occ in [0, 1]` when an occluder
 * disk of angular radius `rOcc` is at angular separation `sep` from a star disk `rStar`.
 */
export function evaluateSolarEclipseOccultation(sepRad, rStarRad, rOccRad) {
  if (!(rStarRad > 1e-9) || !(rOccRad > 1e-9)) return 0.0;
  if (sepRad >= rStarRad + rOccRad) return 0.0;
  if (sepRad <= Math.abs(rOccRad - rStarRad)) {
    return rOccRad >= rStarRad ? 1.0 : (rOccRad * rOccRad) / (rStarRad * rStarRad);
  }
  const d = sepRad;
  const r1 = rStarRad;
  const r2 = rOccRad;
  const c1 = Math.max(-1, Math.min(1, (d * d + r1 * r1 - r2 * r2) / (2 * d * r1)));
  const c2 = Math.max(-1, Math.min(1, (d * d + r2 * r2 - r1 * r1) / (2 * d * r2)));
  const area = r1 * r1 * Math.acos(c1) + r2 * r2 * Math.acos(c2)
    - 0.5 * Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
  return Math.max(0, Math.min(1, area / (Math.PI * r1 * r1)));
}

/**
 * Map every live N-body object (1–3 host stars, moons, parent gas giant, sibling planets,
 * and planetary rings) into the rotating surface `(East, Up, South)` sky frame on a
 * monotonic Reversed-Z sky proxy shell `R_sky in [25 km, 220 km]`, plus compute exact
 * multi-star lighting, solar eclipse dimming, and emergent Milankovitch seasons!
 */
export function buildLiveSurfaceCelestialSky({
  solarEngine,
  catalog,
  focusIdx,
  cameraPos = [0, 10, 0],
  env = {},
  surfaceSimSec = 0.0,
  observerLatDeg = 28.0,
  dysonCoverage = 0.0
} = {}) {
  const defaultLight = env.isRogue
    ? norm3([0.15, 0.96, 0.22])
    : norm3([0.58, 0.44, 0.68]);

  const fallbackClimate = {
    seasonName: 'Equinox',
    declinationDeg: 0,
    localHour: 10.5,
    surfaceTempK: Number(env.tempK) || 288,
    snowlineM: Math.max(8, (Number(env.terrainAmpM) || 42) * 0.56),
    iceCoverFrac: 0.0,
    autumnShift: 0.0,
    eclipseFactor: 1.0,
    latitudeRad: (observerLatDeg * Math.PI) / 180
  };

  if (!solarEngine || !Array.isArray(catalog) || focusIdx < 0 || focusIdx >= catalog.length) {
    return {
      spheres: [],
      disks: [],
      lightDir: defaultLight,
      primarySunElevDeg: Math.asin(defaultLight[1]) * (180 / Math.PI),
      climate: fallbackClimate
    };
  }

  const focusSpec = catalog[focusIdx];
  const mCount = Math.min(solarEngine.massiveCount, catalog.length);
  const focusSt = solarEngine.getMassiveBodyState64(focusIdx);
  const star0St = solarEngine.getMassiveBodyState64(0);
  const toStar0Ecl = [
    star0St.posAu[0] - focusSt.posAu[0],
    star0St.posAu[1] - focusSt.posAu[1],
    star0St.posAu[2] - focusSt.posAu[2]
  ];
  const toStar0DistAu = Math.max(1e-6, Math.hypot(toStar0Ecl[0], toStar0Ecl[1], toStar0Ecl[2]));
  const toStar0Unit = [toStar0Ecl[0] / toStar0DistAu, toStar0Ecl[1] / toStar0DistAu, toStar0Ecl[2] / toStar0DistAu];

  // Physical spin phase from rotationPeriodHr (starting in crisp morning/midday light at t=0!)
  const rotHr = Number(focusSpec.rotationPeriodHr) || 24.0;
  const omegaSpin = (2 * Math.PI) / (Math.abs(rotHr) * 3600.0) * (rotHr < 0 ? -1 : 1);
  // Compute initial angle offset so t=0 always begins with the primary star visibly aloft (~32 deg morning sky!)
  const baseBasis0 = buildSurfaceTangentBasis({
    axialObliquityDeg: Number(focusSpec.axialObliquityDeg) || 23.44,
    spinAxisLonDeg: Number(focusSpec.spinAxisLonDeg) || 90.0,
    observerLatDeg,
    spinAngleRad: 0.0,
    tidallyLocked: Boolean(focusSpec.tidallyLocked),
    toPrimaryStarUnit: toStar0Unit
  });
  const sEqA = dot3(toStar0Unit, baseBasis0.eqA);
  const sEqB = dot3(toStar0Unit, baseBasis0.eqB);
  // Exact subsolar longitude minus ~30 deg -> crisp 10:00 AM sunlit morning on EVERY orbital quadrant!
  const baseMeridOffset = focusSpec.tidallyLocked ? 0.35 : (Math.atan2(sEqB, sEqA) - 0.52);
  const spinAngleRad = focusSpec.tidallyLocked
    ? baseMeridOffset
    : (baseMeridOffset + omegaSpin * surfaceSimSec);

  const basis = buildSurfaceTangentBasis({
    axialObliquityDeg: Number(focusSpec.axialObliquityDeg) || 23.44,
    spinAxisLonDeg: Number(focusSpec.spinAxisLonDeg) || 90.0,
    observerLatDeg,
    spinAngleRad,
    tidallyLocked: Boolean(focusSpec.tidallyLocked),
    toPrimaryStarUnit: toStar0Unit
  });

  const toLocal = (v) => [dot3(v, basis.east), dot3(v, basis.up), dot3(v, basis.south)];
  const primarySunDir = env.isRogue ? defaultLight : norm3(toLocal(toStar0Unit));

  // Map every other N-body star, moon, parent gas giant, and sibling planet onto a monotonic
  // Reversed-Z sky shell R_sky(d_m) in [25 km, 220 km] preserving exact depth ordering!
  const skyBodies = [];
  const spheres = [];
  const disks = [];

  for (let i = 0; i < mCount; i += 1) {
    if (i === focusIdx) continue;
    const sp = catalog[i];
    const st = solarEngine.getMassiveBodyState64(i);
    const dxAu = st.posAu[0] - focusSt.posAu[0];
    const dyAu = st.posAu[1] - focusSt.posAu[1];
    const dzAu = st.posAu[2] - focusSt.posAu[2];
    const distAu = Math.hypot(dxAu, dyAu, dzAu);
    if (!(distAu > 1e-9)) continue;
    const distM = distAu * AU_METERS;
    const dirLocal = toLocal([dxAu / distAu, dyAu / distAu, dzAu / distAu]);
    const isStar = Boolean(sp.isStar) || i === 0;
    const isParent = focusSpec.parent === i;
    const isMoonOfFocus = sp.parent === focusIdx;
    const angRad = Math.max(1e-5, ((Number(sp.radiusKm) || 1737) * 1000) / distM);

    // Skip ultra-faint distant moons belonging to OTHER planets (> 0.05 AU away)
    if (!isStar && !isParent && !isMoonOfFocus && sp.parent > 0 && distAu > 0.05) continue;

    // Monotonic logarithmic distance proxy in [25 km .. 220 km] so closer moons always depth-occlude distant suns!
    const rSkyM = 25000.0 + 24000.0 * Math.log10(1.0 + distM / 1.0e7);
    // Slightly boost tiny distant sibling planets so they remain crisp evening/morning stars, while keeping
    // Host Sun(s), Moons, and Parent Gas Giants at true dramatic astronomical angular sizes!
    const minAng = isStar ? 0.0085 : (isParent || isMoonOfFocus ? 0.0075 : 0.0028);
    const effAng = Math.max(minAng, Math.min(0.42, isStar ? angRad * 1.85 : (isParent || isMoonOfFocus ? angRad * 1.45 : angRad * 4.5)));
    const proxyRadiusM = rSkyM * Math.tan(effAng);
    const pos = [
      cameraPos[0] + dirLocal[0] * rSkyM,
      cameraPos[1] + dirLocal[1] * rSkyM,
      cameraPos[2] + dirLocal[2] * rSkyM
    ];

    skyBodies.push({ i, isStar, distM, dirLocal, angRad: effAng });
    spheres.push({
      pos,
      radius: proxyRadiusM,
      color0: sp.color0 || (isStar ? [1.0, 0.94, 0.78] : [0.72, 0.74, 0.78]),
      color1: sp.color1 || (isStar ? [1.0, 0.56, 0.18] : [0.42, 0.44, 0.48]),
      kind: isStar ? 0 : (sp.kind ?? 1),
      atm: isStar ? 0.0 : (sp.atm ?? 0.2),
      tempK: Number(sp.tempK) || (isStar ? 5778 : 220),
      civTechK: Number(sp.civTechK) || 0,
      dysonCoverage: isStar ? dysonCoverage : 0,
      seed: i * 2.17 + 1.3
    });

    // If this sky body is a ringed parent planet (e.g. viewing Saturn's rings from Titan's methane shores!)
    if (sp.ringed && proxyRadiusM > 60) {
      const ringNormalLocal = norm3(toLocal([0.16, 0.89, 0.42]));
      disks.push({
        center: pos,
        rIn: (sp.ringInnerKm / Math.max(1, sp.radiusKm)) * proxyRadiusM,
        normal: ringNormalLocal,
        rOut: (sp.ringOuterKm / Math.max(1, sp.radiusKm)) * proxyRadiusM,
        color: [0.88, 0.78, 0.62],
        kind: 1
      });
    }
  }

  // If the FOCUSED planet itself has rings (e.g. standing on a ringed world!), project its own ring arch overhead!
  if (focusSpec.ringed && focusSpec.ringOuterKm > focusSpec.radiusKm) {
    const rScale = 48000.0 / Math.max(1, focusSpec.radiusKm);
    disks.push({
      center: [cameraPos[0], cameraPos[1] - 48000.0, cameraPos[2]],
      rIn: focusSpec.ringInnerKm * rScale,
      normal: norm3(toLocal(basis.pole)),
      rOut: focusSpec.ringOuterKm * rScale,
      color: [0.88, 0.78, 0.62],
      kind: 1
    });
  }

  // Exact circle-circle solar eclipse occultation by any closer moon/body transiting the primary host star!
  let maxEclipseOcc = 0.0;
  const primaryStarRec = skyBodies.find((b) => b.i === 0);
  if (primaryStarRec) {
    for (const b of skyBodies) {
      if (b.isStar || b.distM >= primaryStarRec.distM) continue;
      const cosSep = Math.max(-1, Math.min(1, dot3(b.dirLocal, primaryStarRec.dirLocal)));
      const sep = Math.acos(cosSep);
      if (sep < primaryStarRec.angRad + b.angRad) {
        const occ = evaluateSolarEclipseOccultation(sep, primaryStarRec.angRad, b.angRad);
        if (occ > maxEclipseOcc) maxEclipseOcc = occ;
      }
    }
  }
  const eclipseFactor = Math.max(0.06, 1.0 - maxEclipseOcc * 0.94);

  // ---- Emergent Milankovitch Orbital Seasons (ZERO hardcoded calendar!) ----
  // Subsolar declination sin(delta) = dot(pole, toStar0Unit)
  const sinDecl = Math.max(-1, Math.min(1, dot3(basis.pole, toStar0Unit)));
  const declRad = Math.asin(sinDecl);
  const declDeg = declRad * (180 / Math.PI);
  const latRad = basis.observerLatRad;
  // Seasonal insolation anomaly relative to equinox (positive in local summer, negative in local winter!)
  const seasonSignal = Math.sin(latRad) * sinDecl;
  const baseTempK = Number(env.tempK) || 288;
  // Thermal inertia damped seasonal temperature swing (larger on dry/thin-air worlds, gentler on deep oceans)
  const thermalSwingK = env.hasLiquidOcean ? 34.0 : 48.0;
  const seasonalTempK = Math.max(35, baseTempK + seasonSignal * thermalSwingK * 1.18 + (primarySunDir[1] * 6.0));

  // Physical adiabatic lapse-rate snowline h_snow(t) = (T_sea(t) - T_melt) / Gamma_lapse
  const tMeltK = Number(env.solventMeltTempK) || 273.15;
  const lapseKPerM = Math.max(0.004, Math.min(0.025, (Number(env.gravityMS2) || 9.81) / 1004.0)) * 18.0; // scaled to 40-80 m mountain relief!
  const snowlineM = Math.max(-12.0, Math.min(120.0, (seasonalTempK - tMeltK) / lapseKPerM + 6.0));
  // Sea-ice freeze-thaw fraction (smooth freezing below T_melt; >= 0.72 freezes winter seas walkable/drivable!)
  const iceCoverFrac = env.hasLiquidOcean
    ? Math.max(0, Math.min(1, (tMeltK - seasonalTempK + 2.5) / 14.0))
    : 0.0;
  // Autumn phenology peaks as season cools toward equinox/early winter
  const autumnShift = Math.max(0, Math.min(1, Math.exp(-Math.pow((seasonSignal + 0.14) / 0.18, 2)) * (Math.abs(Number(focusSpec.axialObliquityDeg) || 0) > 8 ? 1.0 : 0.2)));

  let seasonName = 'Equinox';
  if (Math.abs(Number(focusSpec.axialObliquityDeg) || 0) < 4) seasonName = 'Aseasonal';
  else if (seasonSignal > 0.14) seasonName = 'Summer';
  else if (seasonSignal < -0.14) seasonName = iceCoverFrac >= 0.72 ? 'Deep Winter (Frozen Sea)' : 'Winter';
  else if (seasonSignal >= 0) seasonName = 'Spring';
  else seasonName = 'Autumn';

  // Local solar hour [0..24) from sun azimuth/elevation
  const sunElevDeg = Math.asin(Math.max(-1, Math.min(1, primarySunDir[1]))) * (180 / Math.PI);
  const localHour = ((12.0 - Math.atan2(primarySunDir[0], Math.max(-1, Math.min(1, primarySunDir[1]))) * (12.0 / Math.PI)) % 24 + 24) % 24;

  return {
    spheres,
    disks,
    lightDir: primarySunDir,
    primarySunElevDeg: sunElevDeg,
    climate: {
      seasonName,
      declinationDeg: Number(declDeg.toFixed(1)),
      localHour: Number(localHour.toFixed(2)),
      surfaceTempK: Math.round(seasonalTempK),
      snowlineM: Number(snowlineM.toFixed(1)),
      iceCoverFrac: Number(iceCoverFrac.toFixed(3)),
      autumnShift: Number(autumnShift.toFixed(3)),
      eclipseFactor: Number(eclipseFactor.toFixed(3)),
      maxEclipseOcc: Number(maxEclipseOcc.toFixed(3)),
      latitudeRad: latRad
    }
  };
}

/**
 * Build translucent 3D orbital atmospheric CFD wind-flow streamlines hovering just above
 * the focused L4 atmospheric planet (`r = radius * 1.022`) from its live physical rotation,
 * Hadley/Ferrel/Rhines jet regime, and baroclinic Rossby eddies — makes L4 atmospheric CFD
 * unmistakably visible right from orbit!
 */
export function buildOrbitalCfdStreamlines({
  center = [0, 0, 0],
  radius = 1.0,
  atmoState = null,
  timeSec = 0.0,
  seed = 1.0,
  alphaMul = 1.0
} = {}) {
  if (!atmoState || !(atmoState.surfacePressurePa >= 20.0) || !(radius > 0.05) || alphaMul < 0.02) {
    return [];
  }
  const rotScale = Math.max(0.05, Math.min(14.0, (atmoState.rotationOmegaRadS / 7.2921e-5) * (atmoState.radiusM / 6.371e6)));
  const isMultiJet = rotScale > 2.0;
  const rShell = radius * 1.048;
  const latBands = isMultiJet
    ? [-1.05, -0.78, -0.52, -0.26, 0.0, 0.26, 0.52, 0.78, 1.05]
    : [-0.95, -0.56, -0.20, 0.0, 0.20, 0.56, 0.95];
  const streaksPerBand = isMultiJet ? 7 : 6;
  const segs = 12;
  const out = [];

  for (let bi = 0; bi < latBands.length; bi += 1) {
    const baseLat = latBands[bi];
    const cosL = Math.cos(baseLat);
    // Zonal jet direction matching planetaryAtmosphereElectricGpu.js!
    const uJet = isMultiJet
      ? (0.76 * Math.cos(10 * baseLat) + 0.36 * Math.sin(18 * baseLat)) * cosL
      : (0.54 * Math.sin(2 * baseLat) * Math.sin(2 * baseLat) - 0.32 * Math.pow(Math.max(0, cosL), 3));
    const speedSign = uJet >= 0 ? 1 : -1;
    const speedMag = Math.max(0.22, Math.abs(uJet));
    // Warm amber/gold for retrograde/easterly equatorial jets, crisp cyan-white for prograde/westerly jets!
    const rgb = speedSign > 0 ? [0.44, 0.92, 1.0] : [1.0, 0.78, 0.36];

    for (let si = 0; si < streaksPerBand; si += 1) {
      const lonStart = ((si / streaksPerBand) * Math.PI * 2 + bi * 0.73 + seed * 1.13 + timeSec * uJet * 0.48);
      const arcLen = 0.36 + 0.38 * speedMag;
      let prev = null;
      for (let k = 0; k <= segs; k += 1) {
        const f = k / segs;
        const lon = lonStart + speedSign * f * arcLen;
        // Rossby baroclinic wave meander in latitude!
        const lat = Math.max(-1.42, Math.min(1.42, baseLat + 0.088 * Math.sin(3.0 * lon + bi * 1.4 - timeSec * 0.35)));
        const cl = Math.cos(lat);
        const pt = [
          center[0] + rShell * cl * Math.cos(lon),
          center[1] + rShell * Math.sin(lat),
          center[2] + rShell * cl * Math.sin(lon)
        ];
        if (prev) {
          const taper = Math.sin(f * Math.PI) * (0.36 + 0.44 * Math.min(1, speedMag)) * alphaMul;
          out.push(prev[0], prev[1], prev[2], rgb[0], rgb[1], rgb[2], taper * 0.78);
          out.push(pt[0], pt[1], pt[2], rgb[0], rgb[1], rgb[2], taper);
        }
        prev = pt;
      }
    }
  }
  return out;
}
