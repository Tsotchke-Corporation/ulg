// Shared Procedural 3D Xenobiology Anatomy Mesh Generator & Interactive Bio-Lab Vivarium Controller
// (`src/runtime/biology/xenobiologyAnatomyMesh.js`).
//
// Used BOTH on planetary surfaces (`planetarySurfaceVehiclesGpu.js` in `universes.html`) AND
// inside the Interactive Bio-Lab Specimen Aquarium / Vivarium (`life-lab.html`) so any abducted
// alien creature, plant, fungus, aero-leviathan, or chemotroph looks IDENTICAL up close in the lab!
//
// Emits standard 48-byte vertices (`pos_part(vec4)`, `norm_zone(vec4)`, `col_emiss(vec4)`):
//   - All 17 procedural body plans:
//       * 8 Fauna: quadruped-cursorial, hexapod-armored, biped-strider, radial-tentacular,
//                  aero-gasbag, wing-glider, litho-crawler, aquatic-swimmer
//       * 6 Flora: conifer-spire, branching-arbor, frond-rosette, buoyant-kelp,
//                  biolum-coral, buttressed-monolith
//       * 3 Fungi/Chemotroph: mycelial-fruiting-tree, sporing-hypha-dome, chemotrophic-vent-spire
//   - Supports live interactive behavioral responses to Inspect, Probe, Heat, Cool, Neuro-Stim & Biopsy!

export const BODY_PLAN_IDS = Object.freeze([
  'quadruped-cursorial',
  'hexapod-armored',
  'biped-strider',
  'radial-tentacular',
  'aero-gasbag',
  'wing-glider',
  'litho-crawler',
  'aquatic-swimmer',
  'conifer-spire',
  'branching-arbor',
  'frond-rosette',
  'buoyant-kelp',
  'biolum-coral',
  'buttressed-monolith',
  'mycelial-fruiting-tree',
  'sporing-hypha-dome',
  'chemotrophic-vent-spire'
]);

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function normalize3(v) {
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

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function makeBasisFromAxis(axis) {
  const a = normalize3(axis);
  const ref = Math.abs(a[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const r = normalize3(cross3(ref, a));
  const f = cross3(a, r);
  return { a, r, f };
}

function pushTri(out, p0, p1, p2, n0, n1, n2, rgb, emiss, tag = 4.0) {
  out.push(
    p0[0], p0[1], p0[2], 0, n0[0], n0[1], n0[2], tag, rgb[0], rgb[1], rgb[2], emiss,
    p1[0], p1[1], p1[2], 0, n1[0], n1[1], n1[2], tag, rgb[0], rgb[1], rgb[2], emiss,
    p2[0], p2[1], p2[2], 0, n2[0], n2[1], n2[2], tag, rgb[0], rgb[1], rgb[2], emiss
  );
}

function pushSegmentTube(out, pA, pB, rA, rB, sides, rgb, emiss, tag = 4.0, capEnd = true) {
  const dir = sub3(pB, pA);
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (len < 1e-4) return;
  const { a, r, f } = makeBasisFromAxis(dir);
  const slope = (rA - rB) / len;
  for (let i = 0; i < sides; i += 1) {
    const t0 = (i / sides) * Math.PI * 2;
    const t1 = ((i + 1) / sides) * Math.PI * 2;
    const c0 = Math.cos(t0); const s0 = Math.sin(t0);
    const c1 = Math.cos(t1); const s1 = Math.sin(t1);
    const rad0 = [r[0] * c0 + f[0] * s0, r[1] * c0 + f[1] * s0, r[2] * c0 + f[2] * s0];
    const rad1 = [r[0] * c1 + f[0] * s1, r[1] * c1 + f[1] * s1, r[2] * c1 + f[2] * s1];
    const n0 = normalize3([rad0[0] + a[0] * slope, rad0[1] + a[1] * slope, rad0[2] + a[2] * slope]);
    const n1 = normalize3([rad1[0] + a[0] * slope, rad1[1] + a[1] * slope, rad1[2] + a[2] * slope]);
    const b0 = add3(pA, scale3(rad0, rA));
    const b1 = add3(pA, scale3(rad1, rA));
    const u0 = add3(pB, scale3(rad0, rB));
    const u1 = add3(pB, scale3(rad1, rB));
    pushTri(out, b0, b1, u1, n0, n1, n1, rgb, emiss, tag);
    if (rB > 1e-4) pushTri(out, b0, u1, u0, n0, n1, n0, rgb, emiss, tag);
    if (capEnd && rB > 1e-4) pushTri(out, u0, u1, pB, a, a, a, rgb, emiss, tag);
  }
}

function pushEllipsoid(out, center, rx, ry, rz, basisR, basisU, basisF, rings, segs, rgb, emiss, tag = 4.0) {
  const pt = (u, v) => {
    const phi = v * Math.PI - Math.PI * 0.5;
    const th = u * Math.PI * 2;
    const cp = Math.cos(phi); const sp = Math.sin(phi);
    const ct = Math.cos(th); const st = Math.sin(th);
    const lx = cp * ct * rx;
    const ly = sp * ry;
    const lz = cp * st * rz;
    const pos = [
      center[0] + basisR[0] * lx + basisU[0] * ly + basisF[0] * lz,
      center[1] + basisR[1] * lx + basisU[1] * ly + basisF[1] * lz,
      center[2] + basisR[2] * lx + basisU[2] * ly + basisF[2] * lz
    ];
    const nrm = normalize3([
      basisR[0] * (cp * ct / Math.max(0.05, rx)) + basisU[0] * (sp / Math.max(0.05, ry)) + basisF[0] * (cp * st / Math.max(0.05, rz)),
      basisR[1] * (cp * ct / Math.max(0.05, rx)) + basisU[1] * (sp / Math.max(0.05, ry)) + basisF[1] * (cp * st / Math.max(0.05, rz)),
      basisR[2] * (cp * ct / Math.max(0.05, rx)) + basisU[2] * (sp / Math.max(0.05, ry)) + basisF[2] * (cp * st / Math.max(0.05, rz))
    ]);
    return { pos, nrm };
  };
  for (let r = 0; r < rings; r += 1) {
    const v0 = r / rings;
    const v1 = (r + 1) / rings;
    for (let s = 0; s < segs; s += 1) {
      const u0 = s / segs;
      const u1 = (s + 1) / segs;
      const a00 = pt(u0, v0);
      const a10 = pt(u1, v0);
      const a01 = pt(u0, v1);
      const a11 = pt(u1, v1);
      if (r > 0) pushTri(out, a00.pos, a10.pos, a11.pos, a00.nrm, a10.nrm, a11.nrm, rgb, emiss, tag);
      if (r < rings - 1) pushTri(out, a00.pos, a11.pos, a01.pos, a00.nrm, a11.nrm, a01.nrm, rgb, emiss, tag);
    }
  }
}

function pushFinBlade(out, pBase, pTip, pRear, rgb, emiss, tag = 4.0) {
  const e1 = sub3(pTip, pBase);
  const e2 = sub3(pRear, pBase);
  const n = normalize3(cross3(e1, e2));
  const nNeg = [-n[0], -n[1], -n[2]];
  pushTri(out, pBase, pTip, pRear, n, n, n, rgb, emiss, tag);
  pushTri(out, pBase, pRear, pTip, nNeg, nNeg, nNeg, rgb, emiss, tag);
}

/**
 * Append procedural 3D articulated geometry for ANY of the 17 xenobiology body plans!
 * Returns optional anatomical hit-spheres `{ id, center, radius }` when `outHits` is provided.
 */
export function appendProceduralOrganismGeometry(out, fxOut, org, curvFn = null, outHits = null) {
  const applyCurv = typeof curvFn === 'function' ? curvFn : (p) => p;
  const pos = org.pos || [0, 0, 0];
  const yaw = Number(org.yaw) || 0;
  const pitch = Number(org.pitch) || 0;
  const sc = Number(org.scale) || 1.0;
  const phase = Number(org.phase) || 0;
  const bodyPlan = org.bodyPlan || (org.kind === 'flora' ? 'branching-arbor' : (org.kind === 'fungi' ? 'mycelial-fruiting-tree' : 'quadruped-cursorial'));
  const traits = org.traits || {};

  const primary = org.primaryRgb || org.rgb || [0.32, 0.64, 0.36];
  const secondary = org.secondaryRgb || [primary[0] * 0.72, primary[1] * 0.72, primary[2] * 0.72];
  const accent = org.accentRgb || [0.98, 0.88, 0.32];
  const biolum = org.biolumRgb || [0.24, 0.96, 0.76];
  const bioStr = Number(org.biolumIntensity ?? org.emissive) || 0.0;

  // Interactive vivarium kinematics / reactions (all 0 on calm surface default)
  const recoil = org.recoilVec || [0, 0, 0];
  const arousal = clamp(Number(org.arousal) || 0, 0, 1.5);
  const crouch = clamp(Number(org.crouch) || 0, 0, 0.55);
  const sailFlare = clamp(Number(org.sailFlare) || 0, 0, 1.0);
  const frondClose = clamp(Number(org.frondClose) || 0, 0, 0.85);
  const heatGlow = clamp(Number(org.heatGlow) || 0, 0, 1.5);
  const coolGlow = clamp(Number(org.coolGlow) || 0, 0, 1.5);
  const neuroWave = clamp(Number(org.neuroWave) || 0, 0, 1.5);
  const abductEmiss = org.abducting ? 0.65 : 0.0;

  const cy = Math.cos(yaw); const sy = Math.sin(yaw);
  const cp = Math.cos(pitch); const sp = Math.sin(pitch);
  const oFwd = [sy * cp, sp, cy * cp];
  const oRight = [cy, 0, -sy];
  const oUp = normalize3(cross3(oFwd, oRight));

  const pt = (lx, ly, lz) => applyCurv([
    pos[0] + recoil[0] + oRight[0] * lx + oUp[0] * ly + oFwd[0] * lz,
    pos[1] + recoil[1] + oRight[1] * lx + oUp[1] * ly + oFwd[1] * lz,
    pos[2] + recoil[2] + oRight[2] * lx + oUp[2] * ly + oFwd[2] * lz
  ]);

  const recordHit = (id, lx, ly, lz, radius) => {
    if (outHits) outHits.push({ id, center: pt(lx, ly, lz), radius: radius * sc });
  };

  // Thermal/neuro visual tint overlay on live skin!
  const tintSkin = (baseRgb, zoneEmiss = 0.0, zoneId = 'torso') => {
    let r = baseRgb[0]; let g = baseRgb[1]; let b = baseRgb[2];
    let em = zoneEmiss + abductEmiss + bioStr * 0.25;
    if (heatGlow > 0.05 && (!org.hotZone || org.hotZone === zoneId)) {
      r = clamp(r + heatGlow * 0.65, 0, 1);
      g = clamp(g + heatGlow * 0.18, 0, 1);
      em += heatGlow * 0.85;
    }
    if (coolGlow > 0.05 && (!org.hotZone || org.hotZone === zoneId)) {
      b = clamp(b + coolGlow * 0.65, 0, 1);
      g = clamp(g + coolGlow * 0.35, 0, 1);
      em += coolGlow * 0.45;
    }
    if (neuroWave > 0.05) {
      const wave = 0.5 + 0.5 * Math.sin(phase * 14.0 + (zoneId === 'head' ? 0 : (zoneId === 'torso' ? 1.8 : 3.5)));
      r = clamp(r + biolum[0] * neuroWave * wave * 0.5, 0, 1);
      g = clamp(g + biolum[1] * neuroWave * wave * 0.5, 0, 1);
      b = clamp(b + biolum[2] * neuroWave * wave * 0.5, 0, 1);
      em += neuroWave * wave * 1.1;
    }
    return { rgb: [r, g, b], em };
  };

  const breath = 1.0 + Math.sin(phase * (2.6 + arousal * 4.5)) * (0.045 + arousal * 0.04);
  const swayX = Math.sin(phase * 1.6) * 0.12 * sc + recoil[0] * 0.45;
  const swayZ = Math.cos(phase * 1.3) * 0.09 * sc + recoil[2] * 0.45;

  // =========================================================================
  // A. FLORA BODY PLANS (6 genuinely distinct sculptural architectures!)
  // =========================================================================
  if (bodyPlan === 'conifer-spire') {
    const hT = 5.4 * sc;
    const tCol = tintSkin(secondary, 0, 'torso');
    const cCol = tintSkin(primary, bioStr * 0.3, 'canopy');
    pushSegmentTube(out, pt(0, -0.08 * sc, 0), pt(swayX * 0.3, hT * 0.85, swayZ * 0.3), 0.30 * sc, 0.06 * sc, 6, tCol.rgb, tCol.em);
    for (let tier = 0; tier < 4; tier += 1) {
      const y0 = hT * (0.24 + tier * 0.19);
      const y1 = y0 + hT * (0.28 - tier * 0.03);
      const rad = (1.65 - tier * 0.34) * sc * (1.0 - frondClose * 0.38);
      const sx = swayX * (0.25 + tier * 0.25);
      const sz = swayZ * (0.25 + tier * 0.25);
      pushSegmentTube(out, pt(sx, y0, sz), pt(sx * 1.15, y1, sz * 1.15), rad, rad * 0.14, 7, cCol.rgb, cCol.em, 4.0, true);
    }
    recordHit('torso', 0, hT * 0.28, 0, 0.9);
    recordHit('canopy', 0, hT * 0.68, 0, 1.55);
    recordHit('limbs', 0, hT * 0.45, 0, 1.35);
  } else if (bodyPlan === 'branching-arbor') {
    const hT = 5.2 * sc;
    const tCol = tintSkin(secondary, 0, 'torso');
    const cCol = tintSkin(primary, bioStr * 0.25, 'canopy');
    const lCol = tintSkin([clamp(primary[0] * 1.14, 0, 1), clamp(primary[1] * 1.14, 0, 1), clamp(primary[2] * 1.08, 0, 1)], bioStr * 0.35, 'canopy');
    const forkP = pt(swayX * 0.35, hT * 0.46, swayZ * 0.35);
    pushSegmentTube(out, pt(0, -0.08 * sc, 0), forkP, 0.38 * sc, 0.20 * sc, 7, tCol.rgb, tCol.em);
    const branchDirs = [
      [0.85, 0.92, 0.42], [-0.78, 0.88, 0.56], [0.22, 0.98, -0.84], [-0.42, 1.08, -0.32], [0.08, 1.18, 0.16]
    ];
    for (let bi = 0; bi < branchDirs.length; bi += 1) {
      const bd = branchDirs[bi];
      const fold = 1.0 - frondClose * 0.35;
      const tip = pt(
        bd[0] * 1.45 * sc * fold + swayX,
        hT * (0.44 + bd[1] * 0.44),
        bd[2] * 1.45 * sc * fold + swayZ
      );
      pushSegmentTube(out, forkP, tip, 0.15 * sc, 0.06 * sc, 5, tCol.rgb, tCol.em);
      const clRad = (0.85 + (bi % 2) * 0.28) * sc * (1.0 - frondClose * 0.25);
      pushEllipsoid(out, tip, clRad * 1.18, clRad * 0.72, clRad * 1.08, oRight, oUp, oFwd, 4, 7, bi % 2 === 0 ? cCol.rgb : lCol.rgb, cCol.em);
    }
    recordHit('torso', 0, hT * 0.26, 0, 0.85);
    recordHit('limbs', 0, hT * 0.55, 0, 1.35);
    recordHit('canopy', 0, hT * 0.82, 0, 1.85);
  } else if (bodyPlan === 'frond-rosette') {
    const hT = 4.9 * sc;
    const tCol = tintSkin(secondary, 0, 'torso');
    const cCol = tintSkin(primary, bioStr * 0.25, 'canopy');
    const crown = pt(swayX * 0.65, hT * 0.72, swayZ * 0.65);
    pushSegmentTube(out, pt(0, -0.08 * sc, 0), pt(swayX * 0.2, hT * 0.38, swayZ * 0.2), 0.32 * sc, 0.22 * sc, 6, tCol.rgb, tCol.em);
    pushSegmentTube(out, pt(swayX * 0.2, hT * 0.38, swayZ * 0.2), crown, 0.22 * sc, 0.16 * sc, 6, tCol.rgb, tCol.em);
    const nFronds = 7;
    for (let fi = 0; fi < nFronds; fi += 1) {
      const a = (fi / nFronds) * Math.PI * 2 + 0.3;
      const ca = Math.cos(a); const sa = Math.sin(a);
      const spread = (1.0 - frondClose * 0.65) * 2.1 * sc;
      const lift = (0.55 + frondClose * 0.95) * sc;
      const mid = pt(ca * spread * 0.55 + swayX, hT * 0.72 + lift * 0.75, sa * spread * 0.55 + swayZ);
      const tip = pt(ca * spread + swayX * 1.2, hT * 0.72 + lift * 0.22 - (1 - frondClose) * 0.45 * sc, sa * spread + swayZ * 1.2);
      const side = [-sa * 0.42 * sc, 0, ca * 0.42 * sc];
      pushFinBlade(out, crown, tip, add3(mid, side), cCol.rgb, cCol.em);
      pushFinBlade(out, crown, add3(mid, scale3(side, -1)), tip, cCol.rgb, cCol.em);
    }
    pushEllipsoid(out, crown, 0.36 * sc, 0.32 * sc, 0.36 * sc, oRight, oUp, oFwd, 4, 6, accent, 0.35 + bioStr * 0.5);
    recordHit('torso', 0, hT * 0.36, 0, 0.75);
    recordHit('canopy', 0, hT * 0.82, 0, 1.85);
    recordHit('limbs', 0, hT * 0.62, 0, 1.35);
  } else if (bodyPlan === 'buoyant-kelp') {
    const hT = 6.2 * sc;
    const tCol = tintSkin(secondary, bioStr * 0.2, 'torso');
    const bCol = tintSkin(biolum, 0.42 + bioStr * 0.65, 'canopy');
    const fCol = tintSkin(primary, bioStr * 0.3, 'limbs');
    for (let si = 0; si < 3; si += 1) {
      const ang = (si / 3) * Math.PI * 2;
      const ox = Math.cos(ang) * 0.42 * sc;
      const oz = Math.sin(ang) * 0.42 * sc;
      const hS = hT * (0.72 + si * 0.14);
      const mid = pt(ox + Math.sin(phase * 1.8 + si) * 0.35 * sc, hS * 0.5, oz + Math.cos(phase * 1.5 + si) * 0.35 * sc);
      const top = pt(ox * 1.4 + swayX * (1.2 + si * 0.3), hS, oz * 1.4 + swayZ * (1.2 + si * 0.3));
      pushSegmentTube(out, pt(ox * 0.5, -0.05 * sc, oz * 0.5), mid, 0.14 * sc, 0.10 * sc, 5, tCol.rgb, tCol.em);
      pushSegmentTube(out, mid, top, 0.10 * sc, 0.08 * sc, 5, fCol.rgb, fCol.em);
      const sacR = (0.48 + si * 0.09) * sc * breath;
      pushEllipsoid(out, top, sacR, sacR * 1.24, sacR, oRight, oUp, oFwd, 8, 12, bCol.rgb, bCol.em);
    }
    recordHit('torso', 0, hT * 0.35, 0, 0.95);
    recordHit('canopy', 0, hT * 0.85, 0, 1.45);
    recordHit('limbs', 0, hT * 0.58, 0, 1.15);
  } else if (bodyPlan === 'biolum-coral') {
    const hT = 4.6 * sc;
    const cCol = tintSkin(primary, 0.28 + bioStr * 0.65, 'canopy');
    const tipCol = tintSkin(biolum, 0.65 + bioStr * 0.95, 'canopy');
    const base = pt(0, -0.05 * sc, 0);
    const trunkTop = pt(swayX * 0.2, hT * 0.36, swayZ * 0.2);
    pushSegmentTube(out, base, trunkTop, 0.46 * sc, 0.28 * sc, 6, cCol.rgb, cCol.em);
    for (let bi = 0; bi < 6; bi += 1) {
      const a = (bi / 6) * Math.PI * 2 + 0.2;
      const r1 = (1.1 + (bi % 2) * 0.45) * sc * (1.0 - frondClose * 0.35);
      const h1 = hT * (0.68 + (bi % 3) * 0.16);
      const bMid = pt(Math.cos(a) * r1 * 0.55 + swayX * 0.5, h1 * 0.72, Math.sin(a) * r1 * 0.55 + swayZ * 0.5);
      const bTip = pt(Math.cos(a) * r1 + swayX, h1, Math.sin(a) * r1 + swayZ);
      pushSegmentTube(out, trunkTop, bMid, 0.20 * sc, 0.14 * sc, 5, cCol.rgb, cCol.em);
      pushSegmentTube(out, bMid, bTip, 0.14 * sc, 0.05 * sc, 5, tipCol.rgb, tipCol.em, 4.0, true);
      pushEllipsoid(out, bTip, 0.22 * sc, 0.26 * sc, 0.22 * sc, oRight, oUp, oFwd, 4, 6, tipCol.rgb, tipCol.em + 0.35);
    }
    recordHit('torso', 0, hT * 0.25, 0, 0.95);
    recordHit('canopy', 0, hT * 0.72, 0, 1.75);
    recordHit('limbs', 0, hT * 0.48, 0, 1.35);
  } else if (bodyPlan === 'buttressed-monolith') {
    // High-gravity structural baobab / Socotra dragon-tree with buttressed roots & gnarled multi-branching crown (zero mushroom caps!)
    const hT = 4.4 * sc;
    const tCol = tintSkin(secondary, 0, 'torso');
    const cCol = tintSkin(primary, bioStr * 0.25, 'canopy');
    const lCol = tintSkin([clamp(primary[0] * 1.15, 0, 1), clamp(primary[1] * 1.15, 0, 1), clamp(primary[2] * 1.12, 0, 1)], bioStr * 0.35, 'canopy');
    const crownBase = pt(swayX * 0.15, hT * 0.56, swayZ * 0.15);
    pushSegmentTube(out, pt(0, -0.08 * sc, 0), crownBase, 0.88 * sc, 0.50 * sc, 8, tCol.rgb, tCol.em);
    // 5 massive structural Euler root buttresses
    for (let ri = 0; ri < 5; ri += 1) {
      const a = (ri / 5) * Math.PI * 2;
      pushFinBlade(out, pt(Math.cos(a) * 1.48 * sc, -0.05 * sc, Math.sin(a) * 1.48 * sc), pt(Math.cos(a) * 0.48 * sc, hT * 0.44, Math.sin(a) * 0.48 * sc), pt(0, 0, 0), tCol.rgb, tCol.em);
    }
    // 6 thick spreading gnarled boughs + windswept leaf-pad clusters
    for (let bi = 0; bi < 6; bi += 1) {
      const a = (bi / 6) * Math.PI * 2 + 0.35;
      const spread = (1.55 + (bi % 2) * 0.42) * sc * (1.0 - frondClose * 0.28);
      const lift = hT * (0.82 + (bi % 3) * 0.11);
      const elbow = pt(Math.cos(a) * spread * 0.52 + swayX * 0.3, hT * 0.70, Math.sin(a) * spread * 0.52 + swayZ * 0.3);
      const tip = pt(Math.cos(a) * spread + swayX * 0.6, lift, Math.sin(a) * spread + swayZ * 0.6);
      pushSegmentTube(out, crownBase, elbow, 0.22 * sc, 0.14 * sc, 5, tCol.rgb, tCol.em);
      pushSegmentTube(out, elbow, tip, 0.14 * sc, 0.06 * sc, 5, tCol.rgb, tCol.em);
      const padR = (0.76 + (bi % 2) * 0.20) * sc;
      pushEllipsoid(out, tip, padR * 1.15, padR * 0.42, padR * 1.05, oRight, oUp, oFwd, 4, 7, bi % 2 === 0 ? cCol.rgb : lCol.rgb, cCol.em);
    }
    recordHit('torso', 0, hT * 0.32, 0, 1.25);
    recordHit('canopy', 0, hT * 0.84, 0, 2.15);
    recordHit('limbs', 0, hT * 0.56, 0, 1.65);
  } else if (bodyPlan === 'mycelial-fruiting-tree') {
    // =========================================================================
    // B. FUNGI / MYCELIAL / CHEMOTROPH BODY PLANS (3 distinct weird kingdoms!)
    // =========================================================================
    const hT = 4.4 * sc;
    const stCol = tintSkin(secondary, bioStr * 0.2, 'torso');
    const capCol = tintSkin(primary, bioStr * 0.45, 'canopy');
    const gillCol = tintSkin(biolum, 0.48 + bioStr * 0.85, 'canopy');
    const mid = pt(swayX * 0.45, hT * 0.48, swayZ * 0.45);
    const top = pt(swayX * 0.85, hT * 0.78, swayZ * 0.85);
    pushSegmentTube(out, pt(0, -0.05 * sc, 0), mid, 0.44 * sc, 0.26 * sc, 7, stCol.rgb, stCol.em);
    pushSegmentTube(out, mid, top, 0.26 * sc, 0.34 * sc, 7, stCol.rgb, stCol.em);
    // Undulating fruiting cap + glowing radial gills underneath!
    const capR = 1.85 * sc * (1.0 - frondClose * 0.35) * breath;
    pushEllipsoid(out, add3(top, [0, 0.25 * sc, 0]), capR, 0.68 * sc, capR * 0.94, oRight, oUp, oFwd, 5, 10, capCol.rgb, capCol.em);
    pushSegmentTube(out, add3(top, [0, -0.10 * sc, 0]), add3(top, [0, 0.15 * sc, 0]), capR * 0.86, 0.32 * sc, 10, gillCol.rgb, gillCol.em);
    // Radiating surface mycelial rhizomorph roots
    for (let mi = 0; mi < 6; mi += 1) {
      const a = (mi / 6) * Math.PI * 2;
      pushSegmentTube(out, pt(0, 0.08 * sc, 0), pt(Math.cos(a) * 1.65 * sc, 0.02 * sc, Math.sin(a) * 1.65 * sc), 0.12 * sc, 0.03 * sc, 4, gillCol.rgb, gillCol.em * 0.75);
    }
    recordHit('torso', 0, hT * 0.40, 0, 0.85);
    recordHit('canopy', 0, hT * 0.82, 0, 1.85);
    recordHit('tail', 0, 0.12 * sc, 0, 1.45);
  } else if (bodyPlan === 'sporing-hypha-dome') {
    // Clathrus-like perforated lattice-cage fungal dome with pulsing bioluminescent inner gleba!
    const hT = 3.6 * sc;
    const cageCol = tintSkin(primary, bioStr * 0.35, 'canopy');
    const coreCol = tintSkin(biolum, 0.75 + bioStr * 0.95 + arousal * 0.5, 'torso');
    const center = pt(swayX * 0.3, hT * 0.48, swayZ * 0.3);
    pushEllipsoid(out, center, 0.78 * sc * breath, 0.82 * sc * breath, 0.78 * sc * breath, oRight, oUp, oFwd, 5, 8, coreCol.rgb, coreCol.em);
    for (let rib = 0; rib < 6; rib += 1) {
      const a0 = (rib / 6) * Math.PI * 2;
      const a1 = ((rib + 1) / 6) * Math.PI * 2;
      const rB = 1.38 * sc;
      const p0 = pt(Math.cos(a0) * rB * 0.65, 0, Math.sin(a0) * rB * 0.65);
      const pM = pt(Math.cos(a0 + 0.25) * rB + swayX * 0.4, hT * 0.52, Math.sin(a0 + 0.25) * rB + swayZ * 0.4);
      const pTop = pt(Math.cos(a1) * rB * 0.32 + swayX * 0.7, hT * 0.96, Math.sin(a1) * rB * 0.32 + swayZ * 0.7);
      pushSegmentTube(out, p0, pM, 0.16 * sc, 0.14 * sc, 5, cageCol.rgb, cageCol.em);
      pushSegmentTube(out, pM, pTop, 0.14 * sc, 0.12 * sc, 5, cageCol.rgb, cageCol.em);
    }
    recordHit('torso', 0, hT * 0.48, 0, 0.95);
    recordHit('canopy', 0, hT * 0.78, 0, 1.55);
    recordHit('tail', 0, 0.15 * sc, 0, 1.25);
  } else if (bodyPlan === 'chemotrophic-vent-spire') {
    // Mineralized FeS2/carbonate tubular chimneys crowned with waving chemosynthetic plumed tendrils!
    const hT = 4.2 * sc;
    const tubeCol = tintSkin(secondary, 0.08, 'torso');
    const plumeCol = tintSkin(primary, 0.45 + bioStr * 0.7, 'canopy');
    for (let ti = 0; ti < 4; ti += 1) {
      const a = (ti / 4) * Math.PI * 2 + 0.4;
      const radO = (ti === 0 ? 0.0 : 0.58 * sc);
      const ox = Math.cos(a) * radO;
      const oz = Math.sin(a) * radO;
      const hS = hT * (ti === 0 ? 0.95 : (0.58 + (ti % 2) * 0.18));
      const mouth = pt(ox + swayX * 0.2, hS, oz + swayZ * 0.2);
      pushSegmentTube(out, pt(ox, -0.05 * sc, oz), mouth, 0.26 * sc, 0.18 * sc, 6, tubeCol.rgb, tubeCol.em);
      // Waving gill plumes emerging from tube mouth!
      const pLift = (1.0 - frondClose * 0.72) * 0.95 * sc;
      for (let pi = 0; pi < 4; pi += 1) {
        const pa = (pi / 4) * Math.PI * 2 + phase * 0.8;
        const pTip = add3(mouth, [Math.cos(pa) * 0.55 * sc + swayX * 0.6, pLift, Math.sin(pa) * 0.55 * sc + swayZ * 0.6]);
        pushSegmentTube(out, mouth, pTip, 0.08 * sc, 0.02 * sc, 4, plumeCol.rgb, plumeCol.em);
      }
    }
    recordHit('torso', 0, hT * 0.42, 0, 1.0);
    recordHit('canopy', 0, hT * 0.92, 0, 1.35);
    recordHit('tail', 0, 0.15 * sc, 0, 1.15);
  } else if (bodyPlan === 'aero-gasbag') {
    // =========================================================================
    // C. FAUNA BODY PLANS (8 genuinely distinct articulated procedural creatures!)
    // =========================================================================
    // Buoyant Cloud-Deck / Low-g Sky-Leviathan with ribbed translucent gas sac, lateral fins & trailing tentacles!
    const bob = Math.sin(phase * 2.1) * 0.42 * sc;
    const bodyY = (2.15 - crouch * 0.45) * sc + bob;
    const tCol = tintSkin(primary, 0.18 + bioStr * 0.5, 'torso');
    const hCol = tintSkin(secondary, 0.25 + bioStr * 0.4, 'head');
    const bCol = tintSkin(biolum, 0.68 + bioStr * 0.95 + arousal * 0.6, 'tail');
    pushEllipsoid(out, pt(0, bodyY, 0), 1.18 * sc * breath, 0.92 * sc * breath, 1.88 * sc, oRight, oUp, oFwd, 6, 10, tCol.rgb, tCol.em);
    // Lateral undulating manta fins
    const finBeat = Math.sin(phase * 3.4) * (0.48 + arousal * 0.35) * sc;
    for (const side of [-1, 1]) {
      pushFinBlade(out, pt(side * 0.95 * sc, bodyY - 0.1 * sc, 0.65 * sc), pt(side * 2.75 * sc, bodyY + finBeat, -0.15 * sc), pt(side * 0.85 * sc, bodyY - 0.15 * sc, -1.05 * sc), hCol.rgb, hCol.em);
    }
    // Forward sensory rostrum + glowing ocular cluster
    pushEllipsoid(out, pt(0, bodyY - 0.12 * sc, 1.75 * sc), 0.52 * sc, 0.42 * sc, 0.58 * sc, oRight, oUp, oFwd, 4, 7, hCol.rgb, hCol.em);
    for (const sx of [-0.26, 0.26]) {
      pushEllipsoid(out, pt(sx * sc, bodyY + 0.04 * sc, 2.18 * sc), 0.11 * sc, 0.11 * sc, 0.11 * sc, oRight, oUp, oFwd, 3, 6, accent, 1.25);
    }
    // 5 trailing luminous electro-sensory tentacles
    for (let ti = 0; ti < 5; ti += 1) {
      const tx = (ti - 2) * 0.32 * sc;
      const tw = Math.sin(phase * 3.0 + ti * 1.1) * 0.42 * sc;
      const p0 = pt(tx, bodyY - 0.72 * sc, -0.35 * sc - Math.abs(ti - 2) * 0.22 * sc);
      const p1 = pt(tx + tw * 0.5, bodyY - 1.55 * sc, -0.85 * sc);
      const p2 = pt(tx + tw, bodyY - 2.25 * sc, -1.35 * sc);
      pushSegmentTube(out, p0, p1, 0.09 * sc, 0.06 * sc, 4, bCol.rgb, bCol.em);
      pushSegmentTube(out, p1, p2, 0.06 * sc, 0.02 * sc, 4, bCol.rgb, bCol.em + 0.35);
    }
    recordHit('torso', 0, bodyY, 0, 1.55);
    recordHit('head', 0, bodyY - 0.1 * sc, 1.85 * sc, 0.75);
    recordHit('limbs', 0, bodyY, 0, 2.35);
    recordHit('tail', 0, bodyY - 1.55 * sc, -0.95 * sc, 1.15);
  } else if (bodyPlan === 'wing-glider') {
    const bob = Math.sin(phase * 3.8) * 0.26 * sc;
    const bodyY = (1.75 - crouch * 0.35) * sc + bob;
    const flap = Math.sin(phase * (4.6 + arousal * 4.2)) * (0.72 + arousal * 0.45) * sc;
    const tCol = tintSkin(primary, bioStr * 0.3, 'torso');
    const wCol = tintSkin(secondary, bioStr * 0.4, 'limbs');
    const hCol = tintSkin(primary, bioStr * 0.25, 'head');
    pushEllipsoid(out, pt(0, bodyY, 0), 0.46 * sc * breath, 0.38 * sc * breath, 1.28 * sc, oRight, oUp, oFwd, 5, 8, tCol.rgb, tCol.em);
    pushEllipsoid(out, pt(0, bodyY + 0.16 * sc, 1.26 * sc), 0.28 * sc, 0.26 * sc, 0.44 * sc, oRight, oUp, oFwd, 4, 6, hCol.rgb, hCol.em);
    for (const sx of [-0.15, 0.15]) pushEllipsoid(out, pt(sx * sc, bodyY + 0.24 * sc, 1.55 * sc), 0.07 * sc, 0.07 * sc, 0.07 * sc, oRight, oUp, oFwd, 3, 5, accent, 1.25);
    // Articulated 2-stage swept flapping wings + tail fan
    for (const s of [-1, 1]) {
      const sh = pt(s * 0.38 * sc, bodyY + 0.08 * sc, 0.38 * sc);
      const elb = pt(s * 1.55 * sc, bodyY + 0.28 * sc + flap * 0.55, 0.15 * sc);
      const tip = pt(s * 2.95 * sc, bodyY + 0.12 * sc + flap, -0.58 * sc);
      const rear = pt(s * 0.36 * sc, bodyY - 0.06 * sc, -0.78 * sc);
      pushSegmentTube(out, sh, elb, 0.11 * sc, 0.07 * sc, 4, tCol.rgb, tCol.em);
      pushSegmentTube(out, elb, tip, 0.07 * sc, 0.03 * sc, 4, tCol.rgb, tCol.em);
      pushFinBlade(out, sh, elb, rear, wCol.rgb, wCol.em);
      pushFinBlade(out, elb, tip, rear, wCol.rgb, wCol.em);
    }
    pushFinBlade(out, pt(0, bodyY, -1.15 * sc), pt(-0.68 * sc, bodyY + 0.12 * sc, -2.05 * sc), pt(0.68 * sc, bodyY + 0.12 * sc, -2.05 * sc), wCol.rgb, wCol.em);
    recordHit('torso', 0, bodyY, 0, 0.95);
    recordHit('head', 0, bodyY + 0.16 * sc, 1.28 * sc, 0.52);
    recordHit('limbs', 0, bodyY + 0.2 * sc, 0, 2.45);
    recordHit('tail', 0, bodyY, -1.65 * sc, 0.72);
  } else if (bodyPlan === 'aquatic-swimmer') {
    const bodyY = (1.35 - crouch * 0.25) * sc + Math.sin(phase * 2.4) * 0.18 * sc;
    const wag = Math.sin(phase * (5.4 + arousal * 4.5)) * (0.48 + arousal * 0.25) * sc;
    const tCol = tintSkin(primary, bioStr * 0.4, 'torso');
    const bCol = tintSkin(biolum, 0.65 + bioStr * 0.9, 'tail');
    const fCol = tintSkin(secondary, bioStr * 0.3, 'limbs');
    pushEllipsoid(out, pt(0, bodyY, 0.2 * sc), 0.56 * sc * breath, 0.66 * sc * breath, 1.55 * sc, oRight, oUp, oFwd, 5, 9, tCol.rgb, tCol.em);
    pushSegmentTube(out, pt(0, bodyY, -1.05 * sc), pt(wag * 0.55, bodyY, -2.15 * sc), 0.36 * sc, 0.12 * sc, 6, tCol.rgb, tCol.em);
    // Crescent thunniform caudal fluke + dorsal & pectoral hydrofoils
    pushFinBlade(out, pt(wag * 0.55, bodyY, -2.10 * sc), pt(wag, bodyY + 0.88 * sc, -2.75 * sc), pt(wag * 0.8, bodyY, -2.45 * sc), bCol.rgb, bCol.em);
    pushFinBlade(out, pt(wag * 0.55, bodyY, -2.10 * sc), pt(wag * 0.8, bodyY, -2.45 * sc), pt(wag, bodyY - 0.88 * sc, -2.75 * sc), bCol.rgb, bCol.em);
    pushFinBlade(out, pt(0, bodyY + 0.58 * sc, 0.35 * sc), pt(0, bodyY + 1.28 * sc, -0.42 * sc), pt(0, bodyY + 0.44 * sc, -0.75 * sc), fCol.rgb, fCol.em);
    for (const s of [-1, 1]) {
      pushFinBlade(out, pt(s * 0.48 * sc, bodyY - 0.18 * sc, 0.65 * sc), pt(s * 1.48 * sc, bodyY - 0.48 * sc, -0.15 * sc), pt(s * 0.42 * sc, bodyY - 0.22 * sc, -0.35 * sc), fCol.rgb, fCol.em);
      pushEllipsoid(out, pt(s * 0.34 * sc, bodyY + 0.14 * sc, 1.45 * sc), 0.10 * sc, 0.10 * sc, 0.10 * sc, oRight, oUp, oFwd, 3, 5, accent, 1.3);
    }
    recordHit('torso', 0, bodyY, 0.2 * sc, 1.15);
    recordHit('head', 0, bodyY + 0.08 * sc, 1.35 * sc, 0.62);
    recordHit('limbs', 0, bodyY - 0.2 * sc, 0.1 * sc, 1.35);
    recordHit('tail', wag * 0.6, bodyY, -2.1 * sc, 0.92);
  } else if (bodyPlan === 'radial-tentacular') {
    const pulse = Math.sin(phase * (3.2 + arousal * 3.0));
    const bodyY = (1.35 - crouch * 0.4 + pulse * 0.14) * sc;
    const tCol = tintSkin(primary, bioStr * 0.45, 'torso');
    const bCol = tintSkin(biolum, 0.55 + bioStr * 0.95, 'limbs');
    pushEllipsoid(out, pt(0, bodyY, 0), 0.92 * sc * breath, 0.72 * sc * breath, 0.92 * sc * breath, oRight, oUp, oFwd, 5, 9, tCol.rgb, tCol.em);
    // Ring of 6 ocelli eyes around central bell!
    for (let ei = 0; ei < 6; ei += 1) {
      const a = (ei / 6) * Math.PI * 2;
      pushEllipsoid(out, pt(Math.cos(a) * 0.84 * sc, bodyY + 0.14 * sc, Math.sin(a) * 0.84 * sc), 0.10 * sc, 0.10 * sc, 0.10 * sc, oRight, oUp, oFwd, 3, 5, accent, 1.25);
    }
    // 6 articulated radial walking/grasping tentacles
    for (let ti = 0; ti < 6; ti += 1) {
      const a = (ti / 6) * Math.PI * 2;
      const stride = Math.sin(phase * 4.4 + ti * 1.05) * 0.28 * sc;
      const p0 = pt(Math.cos(a) * 0.62 * sc, bodyY - 0.35 * sc, Math.sin(a) * 0.62 * sc);
      const p1 = pt(Math.cos(a) * 1.25 * sc, bodyY * 0.55 + Math.max(0, stride), Math.sin(a) * 1.25 * sc);
      const p2 = pt(Math.cos(a) * (1.42 * sc + stride * 0.4), 0.04 * sc, Math.sin(a) * (1.42 * sc + stride * 0.4));
      pushSegmentTube(out, p0, p1, 0.15 * sc, 0.10 * sc, 5, tCol.rgb, tCol.em);
      pushSegmentTube(out, p1, p2, 0.10 * sc, 0.04 * sc, 5, bCol.rgb, bCol.em);
    }
    recordHit('head', 0, bodyY + 0.25 * sc, 0, 0.85);
    recordHit('torso', 0, bodyY, 0, 1.05);
    recordHit('limbs', 0, bodyY * 0.45, 0, 1.48);
    recordHit('tail', 0, bodyY + 0.65 * sc, 0, 0.65);
  } else if (bodyPlan === 'biped-strider') {
    const legR = Number(traits.legRatio) || 1.15;
    const bodyY = (1.52 * legR - crouch * 0.55) * sc;
    const swing = Math.sin(phase * (5.6 + arousal * 4.0)) * 0.44 * sc;
    const tCol = tintSkin(primary, bioStr * 0.25, 'torso');
    const hCol = tintSkin(secondary, bioStr * 0.3, 'head');
    const sCol = tintSkin(biolum, 0.45 + sailFlare * 0.9, 'sail');
    pushEllipsoid(out, pt(0, bodyY, 0), 0.56 * sc * breath, 0.52 * sc * breath, 1.05 * sc, oRight, oUp, oFwd, 5, 8, tCol.rgb, tCol.em);
    // Elongated S-curve neck + alert predatory/strider head + glowing eyes!
    const neckTop = pt(0, bodyY + 0.88 * sc * (traits.neckRatio || 1.0), 0.95 * sc);
    pushSegmentTube(out, pt(0, bodyY + 0.22 * sc, 0.72 * sc), neckTop, 0.24 * sc, 0.16 * sc, 6, tCol.rgb, tCol.em);
    pushEllipsoid(out, add3(neckTop, scale3(oFwd, 0.24 * sc)), 0.28 * sc, 0.26 * sc, 0.48 * sc, oRight, oUp, oFwd, 4, 7, hCol.rgb, hCol.em);
    for (const sx of [-0.17, 0.17]) pushEllipsoid(out, add3(neckTop, add3(scale3(oRight, sx * sc), scale3(oFwd, 0.56 * sc))), 0.08 * sc, 0.08 * sc, 0.08 * sc, oRight, oUp, oFwd, 3, 5, accent, 1.35);
    // Counterbalance tail
    pushSegmentTube(out, pt(0, bodyY + 0.08 * sc, -0.82 * sc), pt(0, bodyY + 0.22 * sc, -2.18 * sc), 0.22 * sc, 0.05 * sc, 5, tCol.rgb, tCol.em);
    // 2 articulated reverse-jointed strider legs
    for (const side of [-1, 1]) {
      const sw = side < 0 ? swing : -swing;
      const hip = pt(side * 0.44 * sc, bodyY - 0.14 * sc, -0.05 * sc);
      const knee = pt(side * 0.48 * sc, bodyY * 0.48, -0.28 * sc + sw * 0.45);
      const foot = pt(side * 0.46 * sc, 0.04 * sc, 0.18 * sc + sw);
      pushSegmentTube(out, hip, knee, 0.16 * sc, 0.11 * sc, 5, hCol.rgb, hCol.em);
      pushSegmentTube(out, knee, foot, 0.11 * sc, 0.07 * sc, 5, hCol.rgb, hCol.em);
    }
    if (traits.hasSail) {
      const sailH = (0.75 + sailFlare * 0.65) * sc;
      pushFinBlade(out, pt(0, bodyY + 0.42 * sc, 0.55 * sc), pt(0, bodyY + 0.42 * sc + sailH, -0.1 * sc), pt(0, bodyY + 0.34 * sc, -0.85 * sc), sCol.rgb, sCol.em);
      recordHit('sail', 0, bodyY + 0.78 * sc, -0.1 * sc, 0.78);
    }
    recordHit('torso', 0, bodyY, 0, 0.95);
    recordHit('head', 0, bodyY + 0.88 * sc, 1.05 * sc, 0.58);
    recordHit('limbs', 0, bodyY * 0.48, 0, 0.92);
    recordHit('tail', 0, bodyY + 0.15 * sc, -1.6 * sc, 0.68);
  } else {
    // quadruped-cursorial | hexapod-armored | litho-crawler
    const isHex = bodyPlan === 'hexapod-armored' || bodyPlan === 'litho-crawler';
    const isLitho = bodyPlan === 'litho-crawler';
    const legR = Number(traits.legRatio) || 1.0;
    const bodyY = ((isLitho ? 0.68 : (isHex ? 0.86 : 1.16)) * legR - crouch * 0.42) * sc;
    const swing = Math.sin(phase * (5.2 + arousal * 4.2)) * 0.34 * sc;
    const tCol = tintSkin(primary, bioStr * 0.22, 'torso');
    const hCol = tintSkin(secondary, bioStr * 0.25, 'head');
    const sCol = tintSkin(biolum, 0.42 + sailFlare * 0.95 + heatGlow * 0.5, 'sail');

    // Segmented armored/muscular thorax + abdomen
    pushEllipsoid(out, pt(0, bodyY, 0.22 * sc), (isLitho ? 0.82 : 0.64) * sc * breath, (isLitho ? 0.44 : 0.54) * sc * breath, 1.15 * sc, oRight, oUp, oFwd, 5, 9, tCol.rgb, tCol.em);
    if (isHex) {
      pushEllipsoid(out, pt(0, bodyY - 0.04 * sc, -0.82 * sc), 0.68 * sc * breath, 0.48 * sc, 0.72 * sc, oRight, oUp, oFwd, 4, 8, hCol.rgb, hCol.em);
    }
    // Neck & Cephalized Head + Eyes + optional Horns/Crests!
    const headP = pt(0, bodyY + (isLitho ? 0.18 : 0.44 * (traits.neckRatio || 1.0)) * sc, 1.38 * sc);
    pushSegmentTube(out, pt(0, bodyY + 0.14 * sc, 0.95 * sc), headP, 0.28 * sc, 0.22 * sc, 6, tCol.rgb, tCol.em);
    pushEllipsoid(out, headP, 0.36 * sc, 0.30 * sc, 0.46 * sc, oRight, oUp, oFwd, 4, 7, hCol.rgb, hCol.em);
    for (const sx of [-0.20, 0.20]) {
      pushEllipsoid(out, pt(sx * sc, bodyY + (isLitho ? 0.28 : 0.54 * (traits.neckRatio || 1.0)) * sc, 1.72 * sc), 0.08 * sc, 0.08 * sc, 0.08 * sc, oRight, oUp, oFwd, 3, 5, accent, 1.3);
      if (traits.hasHorns) {
        pushSegmentTube(out, add3(headP, scale3(oRight, sx * 0.9 * sc)), add3(headP, [oRight[0] * sx * 2.2 * sc + oUp[0] * 0.55 * sc + oFwd[0] * 0.28 * sc, oUp[1] * 0.55 * sc, oRight[2] * sx * 2.2 * sc + oFwd[2] * 0.28 * sc]), 0.07 * sc, 0.02 * sc, 4, accent, 0.15);
      }
    }
    // Tail
    const tailWag = Math.sin(phase * 3.8) * 0.28 * sc;
    pushSegmentTube(out, pt(0, bodyY + 0.06 * sc, -1.15 * sc), pt(tailWag, bodyY + 0.18 * sc, -2.05 * sc), 0.16 * sc, 0.04 * sc, 5, tCol.rgb, tCol.em);
    // Articulated 2-segment legs (4 or 6)
    const zPairs = isHex ? [-0.88, -0.05, 0.78] : [-0.74, 0.74];
    for (let pi = 0; pi < zPairs.length; pi += 1) {
      const lz = zPairs[pi] * sc;
      for (const side of [-1, 1]) {
        const sw = ((pi + (side > 0 ? 1 : 0)) & 1) === 0 ? swing : -swing;
        const hip = pt(side * (isLitho ? 0.68 : 0.48) * sc, bodyY - 0.12 * sc, lz);
        const knee = pt(side * (isLitho ? 1.04 : 0.58) * sc, bodyY * 0.52, lz + sw * 0.45);
        const foot = pt(side * (isLitho ? 0.98 : 0.54) * sc, 0.03 * sc, lz + sw);
        pushSegmentTube(out, hip, knee, 0.14 * sc, 0.10 * sc, 5, hCol.rgb, hCol.em);
        pushSegmentTube(out, knee, foot, 0.10 * sc, 0.06 * sc, 5, hCol.rgb, hCol.em);
      }
    }
    // Allen's-rule dorsal thermal radiator sail (on hot worlds / litho-crawlers!)
    if (traits.hasSail || isLitho) {
      const sailH = (0.85 + sailFlare * 0.75 + heatGlow * 0.35) * sc;
      pushFinBlade(out, pt(0, bodyY + 0.36 * sc, 0.78 * sc), pt(0, bodyY + 0.36 * sc + sailH, 0.02 * sc), pt(0, bodyY + 0.32 * sc, -0.88 * sc), sCol.rgb, sCol.em);
      pushSegmentTube(out, pt(0, bodyY + 0.36 * sc, 0.02 * sc), pt(0, bodyY + 0.36 * sc + sailH, 0.02 * sc), 0.05 * sc, 0.02 * sc, 4, accent, 0.25 + sailFlare * 0.5);
      recordHit('sail', 0, bodyY + 0.85 * sc, 0, 0.85);
    }
    recordHit('torso', 0, bodyY, 0, 1.05);
    recordHit('head', 0, bodyY + (isLitho ? 0.22 : 0.48) * sc, 1.42 * sc, 0.62);
    recordHit('limbs', 0, bodyY * 0.45, 0, 1.15);
    recordHit('tail', 0, bodyY + 0.12 * sc, -1.65 * sc, 0.62);
  }

  // Tractor-beam capture ring if currently being abducted on a planet surface!
  if (org.abducting && fxOut) {
    const rRing = 2.1 * sc;
    for (let s = 0; s < 12; s += 1) {
      const a0 = (s / 12) * Math.PI * 2;
      const a1 = ((s + 1) / 12) * Math.PI * 2;
      pushSegmentTube(fxOut, pt(Math.cos(a0) * rRing, 1.4 * sc, Math.sin(a0) * rRing), pt(Math.cos(a1) * rRing, 1.4 * sc, Math.sin(a1) * rRing), 0.09, 0.09, 4, [0.35, 1.0, 0.72], 1.4, 6.0, false);
    }
  }
}

// =========================================================================
// Interactive Bio-Lab 3D Containment Aquarium / Vivarium Controller!
// =========================================================================

export function createVivariumOrganismController(specimen, profile) {
  const sp = specimen || profile?.ecosystem?.species?.[0] || {
    id: 'viv-default',
    kingdom: 'fauna',
    bodyPlan: 'quadruped-cursorial',
    speciesName: 'Chlorocervus stellaris',
    morphClass: 'Cursorial Quadruped',
    primaryRgb: [0.34, 0.68, 0.42],
    secondaryRgb: [0.72, 0.62, 0.46],
    accentRgb: [0.98, 0.88, 0.32],
    biolumRgb: [0.24, 0.96, 0.76],
    biolumIntensity: 0.35,
    traits: { limbCount: 4, symmetry: 'bilateral', bodyMassKg: 74, kleiberWatts: 85, hasSail: false, hasHorns: true, tOptK: 288, tDenatureK: 355 },
    anatomicalParts: []
  };

  const kingdom = sp.kingdom || (sp.kind === 'flora' ? 'flora' : (sp.kind === 'fungi' ? 'fungi' : 'fauna'));
  const isFloat = sp.bodyPlan === 'aero-gasbag' || sp.bodyPlan === 'wing-glider' || sp.bodyPlan === 'aquatic-swimmer';
  const baseTempK = Number(sp.tempK ?? sp.traits?.tOptK ?? profile?.labParams?.memTempK) || 288;
  const tDenatureK = Number(sp.traits?.tDenatureK ?? profile?.ecosystem?.solventInfo?.tDenatureK) || (baseTempK + 75);
  const tFreezeK = Number(profile?.tMeltK) || Math.max(70, baseTempK - 30);

  const state = {
    pos: [0, isFloat ? 0.55 : -1.85, 0],
    vel: [0, 0, 0],
    yaw: 0.42,
    targetYaw: 0.42,
    pitch: 0,
    phase: 0,
    recoilVec: [0, 0, 0],
    recoilVel: [0, 0, 0],
    arousal: 0.12,
    crouch: 0.0,
    sailFlare: 0.12,
    frondClose: 0.0,
    heatGlow: 0.0,
    coolGlow: 0.0,
    neuroWave: 0.0,
    hotZone: null,
    chamberTempK: baseTempK,
    localTissueTempK: baseTempK,
    heartRateBpm: kingdom === 'fauna' ? 58 : (kingdom === 'fungi' ? 14 : 6),
    kleiberWatts: Number(sp.traits?.kleiberWatts) || 64.0,
    behaviorStatus: kingdom === 'fauna' ? (isFloat ? 'Cruising smoothly in containment fluid' : 'Calm exploratory pacing') : (kingdom === 'fungi' ? 'Steady hyphal respiration & bioluminescence' : 'Phototropic equilibrium in native spectrum'),
    lastInteraction: null,
    selectedPart: sp.anatomicalParts?.[0] || null,
    stepIndex: 0
  };

  // Ambient chamber motes + erupted spores/sparks (160 x 48-byte BioBead floats!)
  const MOTE_COUNT = 160;
  const motes = [];
  const oceanRgb = profile?.oceanRgb || [0.08, 0.34, 0.56];
  for (let i = 0; i < MOTE_COUNT; i += 1) {
    const isSporeSlot = i >= 112;
    motes.push({
      pos: [
        ((i * 1.618 % 1) - 0.5) * 7.2,
        -1.6 + ((i * 0.754 % 1)) * 4.4,
        ((i * 0.569 % 1) - 0.5) * 5.2
      ],
      vel: [0, 0.12 + (i % 7) * 0.03, 0],
      rgb: isSporeSlot ? (sp.biolumRgb || [0.32, 1.0, 0.72]) : [oceanRgb[0] + 0.25, oceanRgb[1] + 0.35, oceanRgb[2] + 0.35],
      rad: isSporeSlot ? 0.0 : (0.015 + (i % 4) * 0.006),
      life: 0,
      isSporeSlot
    });
  }

  let latestHits = [];
  let beamFx = null; // { from, to, rgb, ttl }

  function spawnParticleBurst(center, rgb, count = 24, speed = 2.4) {
    let spawned = 0;
    for (let i = 112; i < MOTE_COUNT && spawned < count; i += 1) {
      const m = motes[i];
      const a = (spawned / count) * Math.PI * 2 + state.phase;
      const el = (spawned % 5) * 0.35 - 0.2;
      m.pos = [center[0], center[1], center[2]];
      m.vel = [Math.cos(a) * speed * (0.5 + (spawned % 3) * 0.3), 0.7 + Math.abs(el) * speed, Math.sin(a) * speed * (0.5 + (spawned % 3) * 0.3)];
      m.rgb = rgb;
      m.rad = 0.056;
      m.life = 1.6 + (spawned % 4) * 0.35;
      spawned += 1;
    }
  }

  function step(dt = 0.032) {
    const h = clamp(Number(dt) || 0.032, 0.004, 0.08);
    state.stepIndex += 1;
    state.phase += h * (1.0 + state.arousal * 1.25);

    // Damped spring-mass recoil recovery!
    for (let k = 0; k < 3; k += 1) {
      const fSpring = -28.0 * state.recoilVec[k] - 6.5 * state.recoilVel[k];
      state.recoilVel[k] += fSpring * h;
      state.recoilVec[k] += state.recoilVel[k] * h;
    }

    // Natural behavioral motion inside the +-3.1 x +-2.2 aquarium tank!
    if (kingdom === 'fauna') {
      if (state.arousal > 0.35) {
        // Agitated evasive dart or defensive turn!
        const speed = isFloat ? 2.4 : 1.7;
        state.vel[0] += Math.sin(state.yaw) * speed * state.arousal * h * 2.2;
        state.vel[2] += Math.cos(state.yaw) * speed * state.arousal * h * 2.2;
      } else {
        // Gentle natural wandering / swimming
        if (state.stepIndex % 95 === 0) {
          state.targetYaw += (((state.stepIndex * 0.618) % 1) - 0.5) * 2.2;
        }
        const spd = isFloat ? 0.62 : 0.34;
        state.vel[0] = state.vel[0] * 0.92 + Math.sin(state.yaw) * spd * 0.08;
        state.vel[2] = state.vel[2] * 0.92 + Math.cos(state.yaw) * spd * 0.08;
      }
      // Smoothly steer away from aquarium glass walls
      if (Math.abs(state.pos[0]) > 1.85 || Math.abs(state.pos[2]) > 1.45) {
        state.targetYaw = Math.atan2(-state.pos[0], -state.pos[2]);
      }
      let dyaw = state.targetYaw - state.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      state.yaw += dyaw * clamp(h * (2.6 + state.arousal * 4.5), 0, 1);

      state.pos[0] = clamp(state.pos[0] + state.vel[0] * h, -2.15, 2.15);
      state.pos[2] = clamp(state.pos[2] + state.vel[2] * h, -1.65, 1.65);
      if (isFloat) {
        state.pos[1] = clamp(0.45 + Math.sin(state.phase * 1.2) * 0.35, -0.65, 1.35);
      } else {
        state.pos[1] = -1.85;
      }
      state.vel[0] *= Math.exp(-1.8 * h);
      state.vel[2] *= Math.exp(-1.8 * h);
    }

    // Relax acute stimulus states smoothly back toward chamber baseline
    state.arousal = Math.max(0.08, state.arousal * Math.exp(-0.35 * h));
    state.crouch = Math.max(0, state.crouch * Math.exp(-0.55 * h));
    state.sailFlare = Math.max(0.10, state.sailFlare * Math.exp(-0.38 * h));
    state.frondClose = Math.max(0, state.frondClose * Math.exp(-0.26 * h));
    state.heatGlow = Math.max(0, state.heatGlow * Math.exp(-0.55 * h));
    state.coolGlow = Math.max(0, state.coolGlow * Math.exp(-0.55 * h));
    state.neuroWave = Math.max(0, state.neuroWave * Math.exp(-0.62 * h));
    state.localTissueTempK += (state.chamberTempK - state.localTissueTempK) * clamp(h * 0.45, 0, 1);
    if (beamFx) {
      beamFx.ttl -= h;
      if (beamFx.ttl <= 0) beamFx = null;
    }

    // Live Q10 + arousal Kleiber wattage & heart/pulse telemetry!
    const q10 = Math.pow(2.0, clamp((state.localTissueTempK - baseTempK) / 18.0, -2.0, 2.5));
    const baseW = Number(sp.traits?.kleiberWatts) || 64.0;
    state.kleiberWatts = Number((baseW * q10 * (1.0 + state.arousal * 1.45)).toFixed(1));
    const baseHr = kingdom === 'fauna' ? 56 : (kingdom === 'fungi' ? 14 : 6);
    state.heartRateBpm = Math.round(baseHr * q10 * (1.0 + state.arousal * 1.35));

    // Step ambient bubbles/motes & erupted spores!
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const m = motes[i];
      if (m.isSporeSlot) {
        if (m.life > 0) {
          m.life -= h;
          m.pos[0] += m.vel[0] * h;
          m.pos[1] += m.vel[1] * h;
          m.pos[2] += m.vel[2] * h;
          m.vel[0] *= 0.96; m.vel[1] = m.vel[1] * 0.96 - 0.18 * h; m.vel[2] *= 0.96;
          m.rad = clamp(m.life * 0.065, 0, 0.11);
        } else {
          m.rad = 0;
        }
      } else {
        m.pos[1] += m.vel[1] * h;
        m.pos[0] += Math.sin(state.phase * 0.9 + i) * 0.08 * h;
        if (m.pos[1] > 2.35) m.pos[1] = -1.75;
      }
    }
  }

  function rayPickPart(rayOrigin, rayDir) {
    let best = null;
    let bestDist = Infinity;
    for (const hit of latestHits) {
      const oc = sub3(hit.center, rayOrigin);
      const tProj = oc[0] * rayDir[0] + oc[1] * rayDir[1] + oc[2] * rayDir[2];
      if (tProj < 0.2) continue;
      const closest = add3(rayOrigin, scale3(rayDir, tProj));
      const d = Math.hypot(closest[0] - hit.center[0], closest[1] - hit.center[1], closest[2] - hit.center[2]);
      if (d <= hit.radius * 1.25 && tProj < bestDist) {
        bestDist = tProj;
        best = { ...hit, point: closest, rayT: tProj };
      }
    }
    if (!best && latestHits.length > 0) {
      // Fallback nearest anatomical region if user clicked near silhouette edge
      for (const hit of latestHits) {
        const oc = sub3(hit.center, rayOrigin);
        const tProj = Math.max(0.5, oc[0] * rayDir[0] + oc[1] * rayDir[1] + oc[2] * rayDir[2]);
        const closest = add3(rayOrigin, scale3(rayDir, tProj));
        const d = Math.hypot(closest[0] - hit.center[0], closest[1] - hit.center[1], closest[2] - hit.center[2]);
        if (d <= hit.radius * 2.1 && d < bestDist) {
          bestDist = d;
          best = { ...hit, point: closest, rayT: tProj };
        }
      }
    }
    return best;
  }

  function applyInteraction(tool, hitPart, worldPoint = null) {
    const partId = hitPart?.id || 'torso';
    const partInfo = (sp.anatomicalParts || []).find((p) => p.id === partId)
      || (sp.anatomicalParts || [])[0]
      || { id: partId, label: partId.toUpperCase(), role: 'Anatomical Tissue', tissue: sp.skeleton || 'Biological Matrix', biopsyLayer: 'fold' };
    const hitPos = worldPoint || hitPart?.center || state.pos;
    state.selectedPart = partInfo;
    state.hotZone = partId;

    let reactionText = `Inspected ${partInfo.label}: ${partInfo.tissue}`;
    let biopsyAction = null;

    if (tool === 'probe') {
      state.arousal = Math.min(1.45, state.arousal + 0.78);
      const pushDir = normalize3(sub3(state.pos, hitPos));
      state.recoilVel = [pushDir[0] * 3.8 + (partId === 'head' ? 0 : 1.2), 1.1, pushDir[2] * 3.8];
      if (kingdom === 'fauna') {
        if (partId === 'head') {
          state.sailFlare = 1.0;
          state.targetYaw = Math.atan2(hitPos[0] - state.pos[0], hitPos[2] - state.pos[2]);
          reactionText = `⚠️ ${partInfo.reactionProbe || 'Startled! Snapped head toward probe & flared defenses!'}`;
        } else {
          state.crouch = 0.42;
          state.targetYaw = state.yaw + 1.85;
          reactionText = `🐾 ${partInfo.reactionProbe || 'Physical recoil! Organism flinched & darted across tank!'}`;
        }
        spawnParticleBurst(hitPos, [0.98, 0.88, 0.32], 14, 1.8);
      } else if (kingdom === 'fungi') {
        state.frondClose = 0.55;
        state.neuroWave = 0.85;
        spawnParticleBurst(hitPos, sp.biolumRgb || [0.28, 1.0, 0.72], 36, 3.0);
        reactionText = `🍄 ${partInfo.reactionProbe || 'Fungal recoil! Released glowing spore cloud!'}`;
      } else {
        state.frondClose = 0.82;
        spawnParticleBurst(hitPos, sp.primaryRgb || [0.32, 0.92, 0.52], 16, 1.6);
        reactionText = `🌿 ${partInfo.reactionProbe || 'Seismonastic reflex! Fronds folded inward & stalk swayed!'}`;
      }
      beamFx = { from: [hitPos[0] + 1.4, hitPos[1] + 1.2, hitPos[2] + 1.4], to: hitPos, rgb: [0.98, 0.88, 0.34], ttl: 0.42 };
    } else if (tool === 'heat') {
      state.localTissueTempK = Math.min(tDenatureK + 60, state.localTissueTempK + 42);
      state.heatGlow = 1.35;
      state.arousal = Math.min(1.5, state.arousal + 0.65);
      state.sailFlare = 1.0;
      if (kingdom === 'fungi') spawnParticleBurst(hitPos, [1.0, 0.52, 0.16], 30, 2.4);
      else spawnParticleBurst(hitPos, [1.0, 0.42, 0.12], 18, 2.0);
      const stressed = state.localTissueTempK >= tDenatureK - 10;
      reactionText = stressed
        ? `🔥 THERMAL STRESS (${Math.round(state.localTissueTempK)} K ≥ T_denature ${Math.round(tDenatureK)} K)! Biopolymers unfolding — click Biopsy to watch live GPU denaturation!`
        : `🔥 Heated ${partInfo.label} to ${Math.round(state.localTissueTempK)} K: ${partInfo.reactionHeat || 'Q10 metabolic spike & radiator flare!'}`;
      beamFx = { from: [0, 2.6, 2.6], to: hitPos, rgb: [1.0, 0.36, 0.08], ttl: 0.65 };
    } else if (tool === 'cool') {
      state.localTissueTempK = Math.max(tFreezeK - 15, state.localTissueTempK - 38);
      state.coolGlow = 1.25;
      state.arousal = Math.max(0.05, state.arousal - 0.35);
      state.crouch = 0.35;
      spawnParticleBurst(hitPos, [0.42, 0.88, 1.0], 18, 1.5);
      reactionText = `❄️ Cryo-chilled ${partInfo.label} to ${Math.round(state.localTissueTempK)} K: Q₁₀ metabolic torpor & cryoprotectant contraction.`;
      beamFx = { from: [0, 2.6, 2.6], to: hitPos, rgb: [0.32, 0.82, 1.0], ttl: 0.65 };
    } else if (tool === 'stim') {
      state.neuroWave = 1.45;
      state.arousal = Math.min(1.5, state.arousal + 0.72);
      state.sailFlare = 0.85;
      spawnParticleBurst(hitPos, sp.biolumRgb || [0.24, 0.96, 1.0], 26, 2.6);
      reactionText = `⚡ Neuro-Stim / Light Pulse on ${partInfo.label}: ${partInfo.reactionStim || 'Propagating action-potential & bioluminescent wave!'}`;
      beamFx = { from: [0, 2.6, 2.4], to: hitPos, rgb: [0.22, 0.96, 1.0], ttl: 0.55 };
    } else if (tool === 'sample') {
      state.arousal = Math.min(1.4, state.arousal + 0.45);
      spawnParticleBurst(hitPos, [0.34, 1.0, 0.68], 22, 2.1);
      const targetModeByLayer = {
        membrane: 'protocell-vesicle',
        fold: 'amphipathic-helix-bundle',
        evo: 'quasispecies-evolution',
        hh: 'excitable-spiral',
        morph: 'turing-spots'
      };
      const friendlyLayerByKey = {
        membrane: 'Cell Membrane Bilayer',
        fold: 'Tissue Protein Folding',
        evo: `${sp.xnaAlphabetSize || 4}-Base XNA Genome`,
        hh: 'Excitable Bioenergetics',
        morph: 'Embryonic Morphogenesis'
      };
      const targetLayer = partInfo.biopsyLayer || 'fold';
      const layerLabel = friendlyLayerByKey[targetLayer] || 'Tissue Protein Folding';
      biopsyAction = Object.freeze({
        partId,
        partLabel: partInfo.label,
        tissue: partInfo.tissue,
        targetLayer,
        layerLabel,
        targetMode: targetModeByLayer[targetLayer] || 'amphipathic-helix-bundle',
        tissueTempK: Math.round(state.localTissueTempK),
        fasta: sp.fasta
      });
      reactionText = `💉 Biopsy extracted from ${partInfo.label}! Ready to zoom into ${sp.speciesName}'s live GPU ${layerLabel} (${Math.round(state.localTissueTempK)} K).`;
      beamFx = { from: [0, 2.6, 2.4], to: hitPos, rgb: [0.32, 1.0, 0.68], ttl: 0.75 };
    }

    state.behaviorStatus = reactionText;
    state.lastInteraction = Object.freeze({
      tool,
      partId,
      partLabel: partInfo.label,
      tissue: partInfo.tissue,
      role: partInfo.role,
      reactionText,
      biopsyAction,
      localTempK: Math.round(state.localTissueTempK),
      arousal: Number(state.arousal.toFixed(2))
    });
    return state.lastInteraction;
  }

  function buildFrameBuffers() {
    const solidVerts = [];
    const glassVerts = [];
    const hits = [];

    // 1. Vivarium Substrate Bed (native planetary regolith/ice/rock slab at y = -1.92)
    const bedRgb = profile?.solvent === 'CH4'
      ? [0.28, 0.22, 0.16]
      : (profile?.solvent === 'H2O-subsurface'
        ? [0.16, 0.24, 0.34]
        : (profile?.solvent === 'H2SO4' ? [0.38, 0.32, 0.16] : [0.20, 0.24, 0.22]));
    const W = 3.65; const D = 2.75; const yBot = -1.94; const yTop = 2.68;
    // Bed top quad + subtle rim frame
    pushTri(solidVerts, [-W, yBot, -D], [W, yBot, -D], [W, yBot, D], [0, 1, 0], [0, 1, 0], [0, 1, 0], bedRgb, 0.0, 1.0);
    pushTri(solidVerts, [-W, yBot, -D], [W, yBot, D], [-W, yBot, D], [0, 1, 0], [0, 1, 0], [0, 1, 0], bedRgb, 0.0, 1.0);
    // Metallic containment chamber base plinth & top LED light-ring rail
    const frameRgb = [0.22, 0.30, 0.38];
    const corners = [[-W, -D], [W, -D], [W, D], [-W, D]];
    for (let ci = 0; ci < 4; ci += 1) {
      const c0 = corners[ci];
      const c1 = corners[(ci + 1) % 4];
      pushSegmentTube(solidVerts, [c0[0], yBot, c0[1]], [c1[0], yBot, c1[1]], 0.085, 0.085, 8, frameRgb, 0.12, 4.0, false);
      pushSegmentTube(solidVerts, [c0[0], yTop, c0[1]], [c1[0], yTop, c1[1]], 0.065, 0.065, 8, [0.34, 0.88, 0.76], 0.45, 4.0, false);
      pushSegmentTube(solidVerts, [c0[0], yBot, c0[1]], [c0[0], yTop, c0[1]], 0.055, 0.055, 8, frameRgb, 0.08, 4.0, false);
    }
    // Smooth organic native terrain boulders inside vivarium floor
    for (let ri = 0; ri < 5; ri += 1) {
      const a = (ri / 5) * Math.PI * 2 + 0.6;
      const rx = Math.cos(a) * 2.48;
      const rz = Math.sin(a) * 1.82;
      pushEllipsoid(solidVerts, [rx, yBot + 0.10, rz], 0.56, 0.24 + (ri % 2) * 0.11, 0.46, [1, 0, 0], [0, 1, 0], [0, 0, 1], 6, 10, [bedRgb[0] * 1.24, bedRgb[1] * 1.24, bedRgb[2] * 1.24], 0.0, 1.0);
    }

    // 2. The Live Procedural Organism (identical anatomy to `universes.html`!)
    const orgScale = kingdom === 'flora' ? 0.50 : (kingdom === 'fungi' ? 0.62 : (sp.bodyPlan === 'aero-gasbag' ? 0.72 : 0.94));
    appendProceduralOrganismGeometry(solidVerts, glassVerts, {
      ...sp,
      pos: state.pos,
      yaw: state.yaw,
      pitch: state.pitch,
      scale: orgScale,
      phase: state.phase,
      recoilVec: state.recoilVec,
      arousal: state.arousal,
      crouch: state.crouch,
      sailFlare: state.sailFlare,
      frondClose: state.frondClose,
      heatGlow: state.heatGlow,
      coolGlow: state.coolGlow,
      neuroWave: state.neuroWave,
      hotZone: state.hotZone
    }, null, hits);
    latestHits = hits;

    // 3. Active Tool Beam FX (Probe / Thermal Laser / Cryo-Jet / Neuro-Stim / Biopsy)
    if (beamFx) {
      pushSegmentTube(glassVerts, beamFx.from, beamFx.to, 0.06, 0.03, 6, beamFx.rgb, 1.65, 6.0, false);
    }

    // 4. Translucent Glass Containment Aquarium Walls + Solvent Liquid/Gas Meniscus!
    const glassRgb = [oceanRgb[0] * 0.65 + 0.18, oceanRgb[1] * 0.75 + 0.34, oceanRgb[2] * 0.85 + 0.42];
    const glassA = 0.16;
    // Back & Side Glass panes (front left open or ultra-clear for crisp visibility, drawn with Fresnel glass shader!)
    const pushPane = (p0, p1, p2, p3, nrm, aVal) => {
      pushTri(glassVerts, p0, p1, p2, nrm, nrm, nrm, glassRgb, aVal, 5.0);
      pushTri(glassVerts, p0, p2, p3, nrm, nrm, nrm, glassRgb, aVal, 5.0);
    };
    pushPane([-W, yBot, -D], [W, yBot, -D], [W, yTop, -D], [-W, yTop, -D], [0, 0, 1], glassA);
    pushPane([-W, yBot, D], [-W, yBot, -D], [-W, yTop, -D], [-W, yTop, D], [1, 0, 0], glassA * 0.85);
    pushPane([W, yBot, -D], [W, yBot, D], [W, yTop, D], [W, yTop, -D], [-1, 0, 0], glassA * 0.85);
    // Shimmering top fluid meniscus at yTop - 0.18
    const yMen = yTop - 0.18;
    pushPane([-W, yMen, -D], [W, yMen, -D], [W, yMen, D], [-W, yMen, D], [0, 1, 0], 0.24);

    // 5. Pack ambient motes & spores into standard 48-byte BioBead Float32Array (12 floats/bead)
    const beadsF32 = new Float32Array(MOTE_COUNT * 12);
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const m = motes[i];
      const o = i * 12;
      beadsF32[o + 0] = m.pos[0];
      beadsF32[o + 1] = m.pos[1];
      beadsF32[o + 2] = m.pos[2];
      beadsF32[o + 3] = 1.0;
      beadsF32[o + 4] = m.vel[0];
      beadsF32[o + 5] = m.vel[1];
      beadsF32[o + 6] = m.vel[2];
      beadsF32[o + 7] = m.isSporeSlot ? 1.0 : 0.0;
      beadsF32[o + 8] = m.rgb[0];
      beadsF32[o + 9] = m.rgb[1];
      beadsF32[o + 10] = m.rgb[2];
      beadsF32[o + 11] = m.rad;
    }

    return {
      solidF32: new Float32Array(solidVerts),
      solidVertCount: Math.floor(solidVerts.length / 12),
      glassF32: new Float32Array(glassVerts),
      glassVertCount: Math.floor(glassVerts.length / 12),
      beadsF32,
      beadCount: MOTE_COUNT
    };
  }

  return Object.freeze({
    specimen: sp,
    kingdom,
    state,
    step,
    rayPickPart,
    applyInteraction,
    buildFrameBuffers,
    getTelemetry() {
      return Object.freeze({
        stepIndex: state.stepIndex,
        speciesName: sp.speciesName,
        kingdom,
        bodyPlan: sp.bodyPlan,
        morphClass: sp.morphClass,
        kleiberWatts: state.kleiberWatts,
        heartRateBpm: state.heartRateBpm,
        arousal: Number(state.arousal.toFixed(2)),
        chamberTempK: Math.round(state.chamberTempK),
        localTissueTempK: Math.round(state.localTissueTempK),
        tOptK: Math.round(baseTempK),
        tDenatureK: Math.round(tDenatureK),
        behaviorStatus: state.behaviorStatus,
        selectedPart: state.selectedPart,
        lastInteraction: state.lastInteraction,
        hitCount: latestHits.length
      });
    },
    setChamberTempK(tK) {
      state.chamberTempK = clamp(Number(tK) || baseTempK, 70, 750);
    },
    reset() {
      state.pos = [0, isFloat ? 0.55 : -1.85, 0];
      state.vel = [0, 0, 0];
      state.recoilVec = [0, 0, 0];
      state.recoilVel = [0, 0, 0];
      state.arousal = 0.12;
      state.crouch = 0;
      state.sailFlare = 0.12;
      state.frondClose = 0;
      state.heatGlow = 0;
      state.coolGlow = 0;
      state.neuroWave = 0;
      state.chamberTempK = baseTempK;
      state.localTissueTempK = baseTempK;
      state.behaviorStatus = 'Reset to calm native equilibrium.';
    }
  });
}
