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
import { appendStarVisuals } from './starlightAndExoticOptics.js';

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
function fractJs(x) { return x - Math.floor(x); }
function smoothstepJs(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-7, e1 - e0)));
  return t * t * (3 - 2 * t);
}
function hash3Orb(px, py, pz) {
  const x = fractJs(px * 0.3183099 + 0.1) * 17.0;
  const y = fractJs(py * 0.3183099 + 0.2) * 17.0;
  const z = fractJs(pz * 0.3183099 + 0.3) * 17.0;
  return fractJs(x * y * z * (x + y + z));
}
function vnoise3Orb(px, py, pz) {
  const ix = Math.floor(px); const iy = Math.floor(py); const iz = Math.floor(pz);
  const fx = px - ix; const fy = py - iy; const fz = pz - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const n000 = hash3Orb(ix, iy, iz); const n100 = hash3Orb(ix + 1, iy, iz);
  const n010 = hash3Orb(ix, iy + 1, iz); const n110 = hash3Orb(ix + 1, iy + 1, iz);
  const n001 = hash3Orb(ix, iy, iz + 1); const n101 = hash3Orb(ix + 1, iy, iz + 1);
  const n011 = hash3Orb(ix, iy + 1, iz + 1); const n111 = hash3Orb(ix + 1, iy + 1, iz + 1);
  const m00 = n000 + (n100 - n000) * ux;
  const m10 = n010 + (n110 - n010) * ux;
  const m01 = n001 + (n101 - n001) * ux;
  const m11 = n011 + (n111 - n011) * ux;
  const m0 = m00 + (m10 - m00) * uy;
  const m1 = m01 + (m11 - m01) * uy;
  return m0 + (m1 - m0) * uz;
}
function fbm5Orb(px, py, pz) {
  let x = px; let y = py; let z = pz;
  let sum = 0; let amp = 0.5;
  for (let i = 0; i < 5; i += 1) {
    sum += amp * vnoise3Orb(x, y, z);
    x = x * 2.07 + 13.7;
    y = y * 2.07 - 9.2;
    z = z * 2.07 + 5.4;
    amp *= 0.5;
  }
  return sum;
}

function sampleSphGeologySnapshotJs(n, snap) {
  const w = snap.width;
  const h = snap.height;
  const arr = snap.data;
  const lon = Math.atan2(n[2], n[0]);
  const lat = Math.asin(Math.max(-1, Math.min(1, n[1])));
  const u = fractJs(lon / (Math.PI * 2) + 0.5);
  const v = Math.max(0, Math.min(0.9999, 0.5 - lat / Math.PI));
  const gx = u * w - 0.5;
  const gy = v * h - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const ix0 = ((x0 % w) + w) % w;
  const ix1 = (((x0 + 1) % w) + w) % w;
  const iy0 = Math.max(0, Math.min(h - 1, y0));
  const iy1 = Math.max(0, Math.min(h - 1, y0 + 1));
  const o00 = (iy0 * w + ix0) * 4;
  const o10 = (iy0 * w + ix1) * 4;
  const o01 = (iy1 * w + ix0) * 4;
  const o11 = (iy1 * w + ix1) * 4;
  const lerp4 = (k) => {
    const t0 = arr[o00 + k] * (1 - fx) + arr[o10 + k] * fx;
    const t1 = arr[o01 + k] * (1 - fx) + arr[o11 + k] * fx;
    return t0 * (1 - fy) + t1 * fy;
  };
  return [lerp4(0), lerp4(1), lerp4(2), lerp4(3)];
}

/**
 * Sample orbital planetary surface directly from the live 3D GPU SPH geology snapshot when active
 * (1-to-1 match with `LIT_SPHERE_WGSL` `sample_sph_geology` — ZERO Perlin mismatch!), falling back
 * to `fbm5Orb` only for non-SPH bodies (gas giants or offline unit tests).
 */
export function sampleOrbitalBodySurfaceAtNormal(nHit, bodySpec = {}, seedFloat = 7.81, lightDir = null, sphGeoSnapshot = null) {
  const n = norm3(Array.isArray(nHit) && nHit.length === 3 ? nHit : [0, 0.5, 0.866]);
  const latDeg = Math.asin(Math.max(-1, Math.min(1, n[1]))) * (180 / Math.PI);
  const lonDeg = Math.atan2(n[2], n[0]) * (180 / Math.PI);

  const c1 = Array.isArray(bodySpec.color1) ? bodySpec.color1 : [0.1, 0.25, 0.55];
  const radiusKm = Number(bodySpec.radiusKm) || 6371;
  const isGasGiant = radiusKm >= 14000;
  const hasSph = !isGasGiant && Boolean(sphGeoSnapshot?.data && sphGeoSnapshot.width > 1 && sphGeoSnapshot.height > 1);

  const sunDot = Array.isArray(lightDir) && lightDir.length === 3 ? dot3(n, norm3(lightDir)) : 0.65;
  const isNightSide = sunDot < -0.04;
  const isTwilight = sunDot >= -0.08 && sunDot <= 0.16;
  let solarLonOffsetRad = null;
  if (Array.isArray(lightDir) && lightDir.length === 3) {
    const ld = norm3(lightDir);
    solarLonOffsetRad = Math.atan2(n[2], n[0]) - Math.atan2(ld[2], ld[0]);
  }

  let isOcean = false;
  let isCoast = false;
  let isPolarIce = false;
  let isMountain = false;
  let isDesert = false;
  let isLush = false;
  let biomeLabel = 'Rocky Plains';
  let seaLevelOffsetM = 0;
  let tempOffsetK = 0;
  let ampScale = 1.0;
  let floraDensityScale = 1.0;
  let elev = 0.5;
  let detail = 0.5;
  let hasOcean = !isGasGiant && (c1[2] > c1[0] + 0.14);

  if (hasSph) {
    // 1-to-1 EXACT read from the live GPU 3D SPH spherical geology map rendered on screen!
    const [elevSph, crustComp, thermalV, moistR] = sampleSphGeologySnapshotJs(n, sphGeoSnapshot);
    elev = elevSph;
    detail = crustComp;
    hasOcean = Boolean(sphGeoSnapshot.hasOcean) || (Number.isFinite(sphGeoSnapshot.seaLevelNorm) && sphGeoSnapshot.seaLevelNorm > -1.2);
    const seaLvlSph = Number.isFinite(sphGeoSnapshot.seaLevelNorm) ? sphGeoSnapshot.seaLevelNorm : 0.04;
    // CRITICAL: seaLevelOffsetM stays EXACT 0.0 on SPH worlds so the cropped SPH patch's
    // real zero-crossing `(elevSph - seaLevelNorm)` controls ocean vs shore vs land 1-to-1!
    seaLevelOffsetM = 0.0;
    if (sphGeoSnapshot.isMagmaOcean || thermalV > 0.72) {
      biomeLabel = 'Active Magma Rift & Basalt Crust (SPH)';
      tempOffsetK = 40;
      ampScale = 1.15;
    } else if (hasOcean) {
      const polar = smoothstepJs(0.77, 0.91, Math.abs(n[1]) + elevSph * 0.08);
      if (polar > 0.48) {
        isPolarIce = true;
        biomeLabel = 'Polar Ice Cap & Glaciers (SPH)';
        tempOffsetK = -34;
        floraDensityScale = 0.08;
        ampScale = 0.90;
      } else if (elevSph < seaLvlSph - 0.045) {
        isOcean = true;
        biomeLabel = 'Open Deep Ocean (SPH)';
        floraDensityScale = 0.05;
      } else if (elevSph < seaLvlSph + 0.075) {
        isCoast = true;
        isLush = true;
        biomeLabel = 'Coastal Shoreline & Shelf (SPH)';
        floraDensityScale = 1.25;
      } else {
        const hLand = Math.max(0, Math.min(1, (elevSph - seaLvlSph) / Math.max(0.32, 0.92 - seaLvlSph)));
        if (hLand > 0.50 || crustComp > 0.72) {
          isMountain = true;
          biomeLabel = 'Orogenic Mountain Cordillera (SPH)';
          tempOffsetK = -14;
          ampScale = 1.35;
          floraDensityScale = 0.65;
        } else if (moistR < 0.34) {
          isDesert = true;
          biomeLabel = 'Arid Continental Basin (SPH)';
          tempOffsetK = 12;
          floraDensityScale = 0.30;
        } else {
          isLush = true;
          biomeLabel = 'Temperate SPH Continent & Valleys';
          floraDensityScale = 1.35;
        }
      }
    } else {
      const polar = smoothstepJs(0.84, 0.94, Math.abs(n[1]));
      if (polar > 0.45 && (bodySpec.atm ?? 0) > 0.12) {
        isPolarIce = true;
        biomeLabel = 'Polar Frost Cap (SPH)';
        tempOffsetK = -30;
      } else if (elevSph > 0.22) {
        isMountain = true;
        biomeLabel = 'SPH Crater Rim & Highlands';
        ampScale = 1.32;
      } else if (elevSph < -0.22) {
        biomeLabel = 'SPH Impact Basin / Mare Floor';
        ampScale = 0.92;
      } else {
        biomeLabel = 'SPH Differentiated Regolith Plains';
      }
    }
    return Object.freeze({
      latDeg: Number(latDeg.toFixed(2)),
      lonDeg: Number(lonDeg.toFixed(2)),
      nHit: Object.freeze([n[0], n[1], n[2]]),
      elev: Number(elevSph.toFixed(4)),
      detail: Number(crustComp.toFixed(4)),
      sphSampled: true,
      sphSeaLevelNorm: seaLvlSph,
      hasOcean,
      isGasGiant,
      isOcean,
      isCoast,
      isPolarIce,
      isMountain,
      isDesert,
      isLush,
      isNightSide,
      isTwilight,
      sunDot: Number(sunDot.toFixed(3)),
      solarLonOffsetRad,
      biomeLabel,
      seaLevelOffsetM,
      tempOffsetK,
      ampScale,
      floraDensityScale
    });
  }

  const sx = seedFloat * 2.13;
  const sy = seedFloat * 1.47;
  const sz = seedFloat * 3.19;
  elev = fbm5Orb(n[0] * 3.4 + sx, n[1] * 3.4 + sy, n[2] * 3.4 + sz);
  detail = fbm5Orb(n[0] * 14.0 + sx * 1.7, n[1] * 14.0 + sy * 1.7, n[2] * 14.0 + sz * 1.7);
  const seaLvl = 0.51;

  if (isGasGiant) {
    const bandPhase = Math.sin(n[1] * 16.5 + (elev - 0.5) * 3.4);
    biomeLabel = bandPhase > 0.15 ? 'Ammonia Cloud Zone' : 'Deep Cyclonic Belt';
    tempOffsetK = bandPhase > 0.15 ? -10 : 14;
  } else if (hasOcean) {
    const polar = smoothstepJs(0.76, 0.90, Math.abs(n[1]) + (detail - 0.5) * 0.14);
    if (polar > 0.48) {
      isPolarIce = true;
      biomeLabel = 'Polar Ice Cap & Glaciers';
      tempOffsetK = -34;
      floraDensityScale = 0.08;
      ampScale = 0.85;
    } else if (elev < seaLvl - 0.035) {
      isOcean = true;
      biomeLabel = 'Open Deep Ocean';
      seaLevelOffsetM = 28.0;
      floraDensityScale = 0.05;
    } else if (elev < seaLvl + 0.045) {
      isCoast = true;
      isLush = true;
      biomeLabel = 'Coastal Shoreline & Forest';
      seaLevelOffsetM = 1.5;
      floraDensityScale = 1.15;
    } else {
      const hLand = Math.max(0, Math.min(1, (elev - seaLvl) / 0.32));
      const arid = smoothstepJs(0.25, 0.72, detail) * (1.0 - Math.abs(n[1]));
      if (hLand > 0.55) {
        isMountain = true;
        biomeLabel = 'Alpine Mountain Range';
        seaLevelOffsetM = -24.0;
        tempOffsetK = -14;
        ampScale = 1.48;
        floraDensityScale = 0.55;
      } else if (arid > 0.45) {
        isDesert = true;
        biomeLabel = 'Arid Desert Plateau';
        seaLevelOffsetM = -20.0;
        tempOffsetK = 14;
        ampScale = 0.92;
        floraDensityScale = 0.22;
      } else {
        isLush = true;
        biomeLabel = 'Temperate Forest & Valleys';
        seaLevelOffsetM = -14.0;
        floraDensityScale = 1.30;
      }
    }
  } else {
    const polar = smoothstepJs(0.84, 0.94, Math.abs(n[1]) + (detail - 0.5) * 0.08);
    if (polar > 0.45 && (bodySpec.atm ?? 0) > 0.12) {
      isPolarIce = true;
      biomeLabel = 'Polar Frost Cap';
      tempOffsetK = -30;
    } else if (elev > 0.62) {
      isMountain = true;
      biomeLabel = 'Cratered Highlands & Ridges';
      ampScale = 1.38;
    } else if (elev < 0.40) {
      biomeLabel = 'Lowland Impact Basin';
      ampScale = 0.78;
    } else {
      biomeLabel = 'Regolith Plains';
    }
  }

  return Object.freeze({
    latDeg: Number(latDeg.toFixed(2)),
    lonDeg: Number(lonDeg.toFixed(2)),
    nHit: Object.freeze([n[0], n[1], n[2]]),
    elev: Number(elev.toFixed(4)),
    detail: Number(detail.toFixed(4)),
    sunDot: Number(sunDot.toFixed(3)),
    solarLonOffsetRad,
    isGasGiant,
    isOcean,
    isCoast,
    isPolarIce,
    isMountain,
    isDesert,
    isLush,
    isNightSide,
    isTwilight,
    biomeLabel,
    seaLevelOffsetM,
    tempOffsetK,
    ampScale,
    floraDensityScale
  });
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
 * First-principles orbital seasonal state for any planet/moon in L2/L4 space view:
 * computes live subsolar declination `sin(delta) = dot(spinPole, toStarUnit)` from
 * physical `axialObliquityDeg` & `spinAxisLonDeg` (ZERO planet-name hacks, ZERO hardcoded calendar!),
 * plus spin-aligned tilted sunlight direction so the orbital terminator tilts with obliquity!
 */
export function computeOrbitalSeasonalState({
  bodySpec = {},
  toStarUnit = [1, 0, 0]
} = {}) {
  const isLocked = Boolean(bodySpec?.tidallyLocked);
  const rawObl = bodySpec?.axialObliquityDeg;
  const obliquityDeg = isLocked
    ? 0.0
    : (Number.isFinite(Number(rawObl)) ? Number(rawObl) : 23.44);
  const spinLonDeg = Number.isFinite(Number(bodySpec?.spinAxisLonDeg)) ? Number(bodySpec.spinAxisLonDeg) : 90.0;
  const deg = Math.PI / 180;
  const obl = obliquityDeg * deg;
  const lon = spinLonDeg * deg;
  const pole = norm3([
    Math.sin(obl) * Math.cos(lon),
    Math.cos(obl),
    Math.sin(obl) * Math.sin(lon)
  ]);
  const s = norm3(Array.isArray(toStarUnit) && toStarUnit.length >= 3 ? toStarUnit : [1, 0, 0]);
  const sinDecl = Math.abs(obliquityDeg) < 0.25 ? 0.0 : Math.max(-0.985, Math.min(0.985, dot3(pole, s)));
  const cosDecl = Math.sqrt(Math.max(0.0, 1.0 - sinDecl * sinDecl));
  const declDeg = Math.asin(sinDecl) * (180 / Math.PI);
  const horizLen = Math.hypot(s[0], s[2]);
  const hx = horizLen > 1e-6 ? s[0] / horizLen : 1.0;
  const hz = horizLen > 1e-6 ? s[2] / horizLen : 0.0;
  const tiltedLightDir = norm3([hx * cosDecl, sinDecl, hz * cosDecl]);

  let seasonLabel = 'Equinox';
  if (isLocked) seasonLabel = 'Tidally Locked';
  else if (Math.abs(obliquityDeg) < 4.0) seasonLabel = 'Aseasonal';
  else if (sinDecl > 0.14) seasonLabel = 'N. Summer / S. Winter';
  else if (sinDecl < -0.14) seasonLabel = 'N. Winter / S. Summer';
  else seasonLabel = 'Equinox';

  return Object.freeze({
    obliquityDeg: Number(obliquityDeg.toFixed(2)),
    sinDecl: Number(sinDecl.toFixed(5)),
    declDeg: Number(declDeg.toFixed(2)),
    seasonLabel,
    tiltedLightDir: Object.freeze(tiltedLightDir)
  });
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
 * and planetary rings) into the rotating surface `(East, Up, South)` frame at their
 * TRUE physical metric distances (`distM = distAu * AU_METERS`, up to `10^14 m`) rendered
 * naturally in ULG's unified Reversed Logarithmic Depth Buffer (ZERO fake skybox compression!),
 * while shifting the observer's spherical `(lat, lon)` continuously as the craft flies across
 * any planet, moon, or comet so you can fly right over the terminator onto the pitch-black night side!
 */
export function buildLiveSurfaceCelestialSky({
  solarEngine,
  catalog,
  focusIdx,
  cameraPos = [0, 10, 0],
  craftPosM = null,
  navRadiusM = null,
  env = {},
  surfaceSimSec = 0.0,
  observerLatDeg = 28.0,
  landingSite = null,
  altitudeKm = null,
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
    latitudeRad: (observerLatDeg * Math.PI) / 180,
    observerLatDeg,
    observerLonOffsetDeg: 0,
    isNightSide: false
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

  // Physical spherical travel across the curved planet/moon/comet surface:
  // Flying east/west (craftPosM[0]) or north/south (craftPosM[2]) smoothly rotates the local
  // tangent frame around the body's curvature radius so you can fly over the terminator into night!
  const posForNav = Array.isArray(craftPosM) && craftPosM.length >= 3 ? craftPosM : [0, 0, 0];
  const effNavRadiusM = Math.max(
    450.0,
    Number(navRadiusM) || Number(env.tinyPlanetCurvatureRadiusM) || (focusSpec.isMinorBody ? 1100.0 : 2800.0)
  );
  const baseLatDeg = Number.isFinite(Number(landingSite?.latDeg)) ? Number(landingSite.latDeg) : observerLatDeg;
  const dLatDeg = -(posForNav[2] / effNavRadiusM) * (180 / Math.PI);
  const effLatDeg = Math.max(-85, Math.min(85, baseLatDeg + dLatDeg));
  const cosLatSafe = Math.max(0.25, Math.cos((effLatDeg * Math.PI) / 180));
  const dLonRad = posForNav[0] / (effNavRadiusM * cosLatSafe);

  // Physical spin phase from rotationPeriodHr + chosen orbital landing longitude + spherical flight longitude!
  const rotHr = Number(focusSpec.rotationPeriodHr) || 24.0;
  const omegaSpin = (2 * Math.PI) / (Math.abs(rotHr) * 3600.0) * (rotHr < 0 ? -1 : 1);
  const baseBasis0 = buildSurfaceTangentBasis({
    axialObliquityDeg: Number(focusSpec.axialObliquityDeg) || 23.44,
    spinAxisLonDeg: Number(focusSpec.spinAxisLonDeg) || 90.0,
    observerLatDeg: effLatDeg,
    spinAngleRad: 0.0,
    tidallyLocked: Boolean(focusSpec.tidallyLocked),
    toPrimaryStarUnit: toStar0Unit
  });
  const sEqA = dot3(toStar0Unit, baseBasis0.eqA);
  const sEqB = dot3(toStar0Unit, baseBasis0.eqB);
  const chosenSolarOffset = Number.isFinite(Number(landingSite?.solarLonOffsetRad))
    ? Number(landingSite.solarLonOffsetRad)
    : -0.52;
  const baseMeridOffset = focusSpec.tidallyLocked ? 0.35 : (Math.atan2(sEqB, sEqA) + chosenSolarOffset);
  const spinAngleRad = focusSpec.tidallyLocked
    ? (baseMeridOffset + dLonRad)
    : (baseMeridOffset + omegaSpin * surfaceSimSec + dLonRad);

  const basis = buildSurfaceTangentBasis({
    axialObliquityDeg: Number(focusSpec.axialObliquityDeg) || 23.44,
    spinAxisLonDeg: Number(focusSpec.spinAxisLonDeg) || 90.0,
    observerLatDeg: effLatDeg,
    spinAngleRad,
    tidallyLocked: Boolean(focusSpec.tidallyLocked),
    toPrimaryStarUnit: toStar0Unit
  });

  const toLocal = (v) => [dot3(v, basis.east), dot3(v, basis.up), dot3(v, basis.south)];
  const primarySunDir = env.isRogue ? defaultLight : norm3(toLocal(toStar0Unit));

  // Place every ABOVE-HORIZON N-body star, moon, parent gas giant, and sibling planet at its TRUE physical
  // metric distance `distM = distAu * AU_METERS` (up to 10^14 m) in ULG's unified Reversed
  // Logarithmic Depth Buffer — strictly occluded by the planet's opaque body below the geometric
  // horizon AND attenuated by real Rayleigh/Mie optical depth inside dense atmospheres / gas giants!
  const skyBodies = [];
  const spheres = [];
  const disks = [];
  const lineChunks = [];
  const bodyRadiusM = Math.max(1.0e4, Number(env.radiusM) || (Number(focusSpec.radiusKm) || 6371) * 1000.0);
  const isGasGiantEnv = env.hasSolidCrust === false || bodyRadiusM >= 1.6e7;
  const craftAltM = Math.max(10.0, Number(posForNav[1]) || 20.0);
  const horizonDip = isGasGiantEnv
    ? -0.015
    : -Math.min(0.08, Math.max(0.012, Math.sqrt((2.0 * craftAltM) / bodyRadiusM)));
  const effAltKm = Number.isFinite(Number(altitudeKm)) ? Number(altitudeKm) : (isGasGiantEnv ? 35.0 : 0.03);
  const optDepthAtmo = Math.max(0, Math.min(1.0, Number(env.skyOpticalDepth) || 0));
  // Vertical column optical depth of overlying cloud decks in gas giants / thick super-dense atmospheres (Venus/Jupiter)
  const verticalCloudTau = isGasGiantEnv
    ? Math.max(0.55, Math.min(5.2, 4.4 - (effAltKm / 120.0) * 3.2 + optDepthAtmo * 0.9))
    : ((Number(env.pressurePa) || 0) > 1.5e6 ? (2.6 + optDepthAtmo * 1.4) : 0.0);
  const gasGiantSkyTransmittance = verticalCloudTau > 0.01 ? Math.exp(-verticalCloudTau * 0.85) : 1.0;

  for (let i = 0; i < mCount; i += 1) {
    if (i === focusIdx) continue;
    const sp = catalog[i];
    const st = solarEngine.getMassiveBodyState64(i);
    const dxAu = st.posAu[0] - focusSt.posAu[0];
    const dyAu = st.posAu[1] - focusSt.posAu[1];
    const dzAu = st.posAu[2] - focusSt.posAu[2];
    const distAu = Math.hypot(dxAu, dyAu, dzAu);
    if (!(distAu > 1e-9)) continue;
    const distM = Math.min(8.0e13, Math.max(5.0e4, distAu * AU_METERS));
    const dirLocal = toLocal([dxAu / distAu, dyAu / distAu, dzAu / distAu]);
    const isStar = Boolean(sp.isStar) || i === 0;
    const isParent = focusSpec.parent === i;
    const isMoonOfFocus = sp.parent === focusIdx;
    const trueRadiusM = Math.max(250.0, (Number(sp.radiusKm) || 1737) * 1000.0);
    const angRad = Math.max(1e-6, trueRadiusM / distM);

    // Skip ultra-faint distant moons belonging to OTHER planets (> 0.05 AU away)
    if (!isStar && !isParent && !isMoonOfFocus && sp.parent > 0 && distAu > 0.05) continue;

    const minAng = isStar ? 0.0065 : (isParent || isMoonOfFocus ? 0.0055 : 0.0022);
    const effAng = Math.max(minAng, Math.min(0.42, isStar ? Math.max(angRad * 1.45, minAng) : (isParent || isMoonOfFocus ? Math.max(angRad * 1.25, minAng) : angRad * 3.5)));

    // Record for eclipse calculation before horizon/cloud culling
    skyBodies.push({ i, isStar, distM, dirLocal, angRad: effAng });

    // PHYSICAL PLANETARY BODY OCCLUSION: Never render suns/planets located straight through the opaque planet/gas giant below the horizon!
    if (dirLocal[1] + effAng < horizonDip) continue;

    // PHYSICAL ATMOSPHERIC / CLOUD-DECK EXTINCTION inside gas giants & dense cloud layers (Beer-Lambert law!)
    let skyTrans = 1.0;
    if (verticalCloudTau > 0.01) {
      const airmass = 1.0 / Math.max(0.10, dirLocal[1] + 0.04);
      skyTrans = Math.exp(-verticalCloudTau * airmass * (isStar ? 0.55 : 1.15));
      if (skyTrans < 0.06) continue; // Completely obscured by overlying ammonia/water/sulfuric cloud decks!
    }

    const worldRadiusM = Math.max(trueRadiusM, distM * Math.tan(effAng));
    const pos = [
      cameraPos[0] + dirLocal[0] * distM,
      cameraPos[1] + dirLocal[1] * distM,
      cameraPos[2] + dirLocal[2] * distM
    ];
    const baseC0 = sp.color0 || (isStar ? [1.0, 0.94, 0.78] : [0.72, 0.74, 0.78]);
    const baseC1 = sp.color1 || (isStar ? [1.0, 0.56, 0.18] : [0.42, 0.44, 0.48]);
    const attenC0 = skyTrans < 0.99 ? [baseC0[0] * skyTrans, baseC0[1] * skyTrans, baseC0[2] * skyTrans] : baseC0;
    const attenC1 = skyTrans < 0.99 ? [baseC1[0] * skyTrans, baseC1[1] * skyTrans, baseC1[2] * skyTrans] : baseC1;

    if (isStar) {
      appendStarVisuals({
        spec: { ...sp, color0: attenC0, color1: attenC1 },
        pos,
        radius: worldRadiusM,
        timeSec: surfaceSimSec * 0.05,
        dysonCoverage,
        seed: i * 2.17 + 1.3,
        spheres,
        disks,
        lineChunks,
        alphaMul: skyTrans
      });
    } else {
      spheres.push({
        pos,
        radius: worldRadiusM,
        color0: attenC0,
        color1: attenC1,
        kind: sp.kind ?? 1,
        atm: sp.atm ?? 0.2,
        tempK: Number(sp.tempK) || 220,
        civTechK: Number(sp.civTechK) || 0,
        dysonCoverage: 0,
        pbrOptics: sp.pbrOptics || null,
        seed: i * 2.17 + 1.3
      });
    }

    // If this sky body is a ringed parent planet (e.g. viewing Saturn's rings from Titan's methane shores!)
    if (sp.ringed && worldRadiusM > 1000 && skyTrans > 0.14) {
      const ringNormalLocal = norm3(toLocal([0.16, 0.89, 0.42]));
      disks.push({
        center: pos,
        rIn: (sp.ringInnerKm / Math.max(1, sp.radiusKm)) * worldRadiusM,
        normal: ringNormalLocal,
        rOut: (sp.ringOuterKm / Math.max(1, sp.radiusKm)) * worldRadiusM,
        color: [0.88 * skyTrans, 0.78 * skyTrans, 0.62 * skyTrans],
        kind: 1
      });
    }
  }

  // If the FOCUSED planet itself has rings, place its actual metric ring plane in the unified log depth buffer!
  if (focusSpec.ringed && focusSpec.ringOuterKm > focusSpec.radiusKm) {
    const rBodyM = Math.max(1.0e5, focusSpec.radiusKm * 1000.0);
    disks.push({
      center: [cameraPos[0], cameraPos[1] - rBodyM, cameraPos[2]],
      rIn: focusSpec.ringInnerKm * 1000.0,
      normal: norm3(toLocal(basis.pole)),
      rOut: focusSpec.ringOuterKm * 1000.0,
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
  // Physical latitude gradient (equator warm, mid-latitudes temperate, poles cold) + obliquity seasonal swing
  // (0 deg obliquity -> sinDecl = 0 -> strictly 0 K seasonal swing; 23.4 deg mid-lat Earth crosses 273.15 K cleanly in Winter!)
  const sinLat = Math.sin(latRad);
  const latTempOffsetK = -22.0 * (sinLat * sinLat - 0.25);
  const thermalSwingK = env.hasLiquidOcean ? 62.0 : 88.0;
  const seasonalTempK = Math.max(35, baseTempK + latTempOffsetK + seasonSignal * thermalSwingK * 1.15 + (primarySunDir[1] * 6.0));

  // Physical adiabatic lapse-rate snowline h_snow(t) = (T_sea(t) - T_melt) / Gamma_lapse
  const tMeltK = Number(env.solventMeltTempK) || 273.15;
  const lapseKPerM = Math.max(0.004, Math.min(0.025, (Number(env.gravityMS2) || 9.81) / 1004.0)) * 18.0; // scaled to 40-80 m mountain relief!
  const snowlineM = Math.max(-12.0, Math.min(120.0, (seasonalTempK - tMeltK) / lapseKPerM + 5.0));
  // Sea-ice freeze-thaw fraction (smooth freezing below T_melt; >= 0.72 freezes winter seas walkable/drivable!)
  const iceCoverFrac = env.hasLiquidOcean
    ? Math.max(0, Math.min(1, (tMeltK - seasonalTempK + 2.5) / 12.0))
    : 0.0;
  // Autumn phenology peaks as season cools toward equinox/early winter
  const autumnShift = Math.max(0, Math.min(1, Math.exp(-Math.pow((seasonSignal + 0.12) / 0.16, 2)) * (Math.abs(Number(focusSpec.axialObliquityDeg) || 0) > 8 ? 1.0 : 0.0)));

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
    lines: lineChunks.length ? new Float32Array(lineChunks) : null,
    lightDir: primarySunDir,
    primaryStarDistAu: toStar0DistAu,
    primarySunElevDeg: sunElevDeg,
    gasGiantSkyTransmittance: Number(gasGiantSkyTransmittance.toFixed(3)),
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
      latitudeRad: latRad,
      observerLatDeg: Number(effLatDeg.toFixed(1)),
      observerLonOffsetDeg: Number((dLonRad * (180 / Math.PI)).toFixed(1)),
      sunElevDeg: Number(sunElevDeg.toFixed(1)),
      isNightSide: sunElevDeg < -5.0
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
