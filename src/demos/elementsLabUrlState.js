// Clean, Human-Readable URL State Encoder / Decoder for ULG Material Physics Lab
// (`src/demos/elementsLabUrlState.js`).
//
// Encodes the active specimen (element/isotope, compound, or chemical reaction),
// active scale tab, sub-simulation view, and key non-default physics parameters
// into concise shareable query strings (and parses both modern `?el=Au&view=...`
// links and legacy `?z=79&a=197&tab=atomic` links seamlessly).

import { ELEMENT_SYMBOLS, symbolForZ } from '../runtime/electronicStructure/periodicTable.js';
import { mostStableMassNumberForZ } from '../runtime/nuclear/nuclearStructureGpu.js';

export const VALID_TABS = Object.freeze([
  'nuclear', 'atomic', 'crystal', 'md', 'compound', 'polytope'
]);

export const TAB_VIEWS = Object.freeze({
  nuclear: Object.freeze(['tdse', 'fission', 'bateman']),
  atomic: Object.freeze(['cloud', 'volume']),
  crystal: Object.freeze(['photon-shell', 'lattice', 'bloch', 'tdks-atom', 'spin-llg', 'transport']),
  md: Object.freeze(['equilibrium', 'strain', 'acoustic', 'shear', 'thermal', 'surface']),
  compound: Object.freeze(['molecule', 'reaction-path', 'vibrations', 'reactive-md']),
  polytope: Object.freeze(['3d-surface', '2d-facets', 'residual-map'])
});

export const TAB_DEFAULT_VIEW = Object.freeze({
  nuclear: 'tdse',
  atomic: 'cloud',
  crystal: 'photon-shell',
  md: 'equilibrium',
  compound: 'molecule',
  polytope: '3d-surface'
});

const SYMBOL_TO_Z = new Map();
for (let i = 0; i < ELEMENT_SYMBOLS.length; i += 1) {
  SYMBOL_TO_Z.set(ELEMENT_SYMBOLS[i].toLowerCase(), i + 1);
}

const VIEW_TO_TAB = new Map();
for (const [tab, views] of Object.entries(TAB_VIEWS)) {
  for (const v of views) VIEW_TO_TAB.set(v, tab);
}

const POL_NAME_TO_CODE = Object.freeze({ ey: 0, ez: 1, circ: 2, circular: 2, lcp: 2 });
const POL_CODE_TO_NAME = Object.freeze(['ey', 'ez', 'circ']);
const FVIEW_NAME_TO_CODE = Object.freeze({ vol: 0, volume: 0, scatt: 1, scattered: 1, cut: 2 });
const FVIEW_CODE_TO_NAME = Object.freeze(['vol', 'scatt', 'cut']);
const VALID_TDKS_ORBS = new Set(['valence', 'd2', 'd0', 'p0', 's0', 'f0']);

export function resolveAtomicNumberToken(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Math.trunc(Number(s));
    return n >= 1 && n <= 118 ? n : null;
  }
  // Support isotope shorthand like "U-235" or "Co60" or plain symbol "Au"
  const symOnly = s.replace(/[-\s]?\d+$/, '').toLowerCase();
  return SYMBOL_TO_Z.get(symOnly) ?? null;
}

function parseIsotopeSuffixFromEl(raw) {
  if (!raw) return null;
  const m = String(raw).trim().match(/^[A-Za-z]{1,3}[-\s]?(\d{1,3})$/);
  return m ? Math.trunc(Number(m[1])) : null;
}

function sanitizeFormulaToken(raw) {
  const s = String(raw || '').trim();
  if (!s || s.length > 48) return null;
  if (!/^[A-Za-z0-9()[\]\s+\-.,]+$/.test(s)) return null;
  return s.replace(/\s+/g, '');
}

function parseReactantsParam(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  // Support comma, pipe, plus, or space-separated reactant pairs (e.g. "HCl,NaOH", "Na|H2O", "Na H2O")
  const parts = s.split(/[,|+\s]+/).map((p) => sanitizeFormulaToken(p)).filter(Boolean);
  if (parts.length < 2) return null;
  return [parts[0], parts[1]];
}

/**
 * Parse a query string (e.g. `window.location.search`) into a fully validated
 * initial state descriptor for `elements-lab.html`.
 */
export function parseElementsLabUrlState(search = '') {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));

  const reactPair = parseReactantsParam(params.get('react'));
  const compoundRaw = sanitizeFormulaToken(params.get('compound') || params.get('formula'));
  const elRaw = params.get('el') || params.get('element') || params.get('z');
  const parsedZ = resolveAtomicNumberToken(elRaw);
  const elIsoA = parseIsotopeSuffixFromEl(params.get('el') || params.get('element'));

  let specimenKind = 'element';
  let Z = parsedZ ?? 26;
  let A = null;
  let formula = null;
  let reactants = null;

  if (reactPair) {
    specimenKind = 'reaction';
    reactants = reactPair;
  } else if (compoundRaw) {
    specimenKind = 'compound';
    formula = compoundRaw;
  } else {
    specimenKind = 'element';
    const rawA = params.get('a');
    const aNum = rawA != null && rawA.trim() !== '' && Number.isFinite(Number(rawA))
      ? Math.trunc(Number(rawA))
      : elIsoA;
    if (aNum != null && aNum >= Z && aNum <= 310) {
      A = aNum;
    }
  }

  // Tab & Sub-View (if `view` is specified without `tab`, infer the parent tab!)
  const rawView = String(params.get('view') || '').trim().toLowerCase();
  const rawTab = String(params.get('tab') || '').trim().toLowerCase();
  let tab = VALID_TABS.includes(rawTab) ? rawTab : null;
  if (!tab && rawView && VIEW_TO_TAB.has(rawView)) {
    tab = VIEW_TO_TAB.get(rawView);
  }
  if (!tab) {
    if (specimenKind === 'reaction') tab = 'compound';
    else if (specimenKind === 'compound') tab = 'compound';
  }
  const effectiveTab = tab || 'nuclear';
  const allowedViews = TAB_VIEWS[effectiveTab] || [];
  const view = allowedViews.includes(rawView) ? rawView : null;

  // Quantum numbers (n, l, m) for Tab 2 Atomic Dirac-KS
  const hasN = params.has('n') && Number.isFinite(Number(params.get('n')));
  const hasL = params.has('l') && Number.isFinite(Number(params.get('l')));
  const hasM = params.has('m') && Number.isFinite(Number(params.get('m')));
  const hasExplicitQuantumNumbers = hasN || hasL || hasM;
  const n = hasN ? Math.max(1, Math.min(7, Math.trunc(Number(params.get('n'))))) : null;
  const l = hasL ? Math.max(0, Math.min((n ?? 7) - 1, Math.trunc(Number(params.get('l'))))) : null;
  const m = hasM ? Math.max(-(l ?? 6), Math.min(l ?? 6, Math.trunc(Number(params.get('m'))))) : null;

  // Electronic structure / Relativistic toggles
  const xcRaw = String(params.get('xc') || '').trim().toLowerCase();
  const functional = (xcRaw === 'pbe' || xcRaw === 'lda' || xcRaw === 'bare') ? xcRaw : null;
  const relRaw = params.get('rel');
  const relativisticSpinOrbit = relRaw != null
    ? !(relRaw === '0' || relRaw.toLowerCase() === 'false')
    : null;

  // 3D Maxwell-KS / Optics params
  const orbRaw = String(params.get('orb') || '').trim().toLowerCase();
  const tdksOrbitalPreset = VALID_TDKS_ORBS.has(orbRaw) ? orbRaw : null;
  const polRaw = String(params.get('pol') || '').trim().toLowerCase();
  const tdksPolMode = Object.prototype.hasOwnProperty.call(POL_NAME_TO_CODE, polRaw)
    ? POL_NAME_TO_CODE[polRaw]
    : (/^[012]$/.test(polRaw) ? Number(polRaw) : null);
  const fviewRaw = String(params.get('fview') || '').trim().toLowerCase();
  const tdksFieldView = Object.prototype.hasOwnProperty.call(FVIEW_NAME_TO_CODE, fviewRaw)
    ? FVIEW_NAME_TO_CODE[fviewRaw]
    : (/^[012]$/.test(fviewRaw) ? Number(fviewRaw) : null);
  const lamRaw = params.get('lam');
  const probeWavelengthNm = lamRaw != null && Number.isFinite(Number(lamRaw))
    ? Math.max(380, Math.min(780, Math.round(Number(lamRaw))))
    : null;
  const monoRaw = params.get('mono');
  const photonModeMono = monoRaw != null
    ? (monoRaw === '1' || monoRaw.toLowerCase() === 'true')
    : (probeWavelengthNm != null ? true : null);

  // Nuclear, Thermal, Chemistry, and Polytope view modifiers
  const b2Raw = params.get('b2');
  const fissionBeta2 = b2Raw != null && Number.isFinite(Number(b2Raw))
    ? Math.max(0, Math.min(1.35, Number(b2Raw)))
    : null;
  const tRaw = params.get('T') ?? params.get('temp');
  const tempK = tRaw != null && Number.isFinite(Number(tRaw))
    ? Math.max(0.5, Math.min(12000, Number(tRaw)))
    : null;
  const mepRaw = params.get('mep');
  const molColorMode = mepRaw != null ? (mepRaw === '1' || mepRaw.toLowerCase() === 'true' ? 1 : 0) : null;
  const orbCloudRaw = params.get('orbCloud');
  const molShowOrbitalOverlay = orbCloudRaw != null
    ? (orbCloudRaw === '1' || orbCloudRaw.toLowerCase() === 'true')
    : null;
  const deutRaw = params.get('deut');
  const vibDeuterated = deutRaw != null ? (deutRaw === '1' || deutRaw.toLowerCase() === 'true') : null;
  const regRaw = String(params.get('regime') || '').trim().toLowerCase();
  const polytopeRegime = (regRaw === 'planetary' || regRaw === 'lab') ? regRaw : null;
  const spdRaw = params.get('speed');
  const simSpeed = spdRaw != null && Number.isFinite(Number(spdRaw))
    ? Math.max(0.05, Math.min(2.0, Number(spdRaw)))
    : null;

  // Optional 3D camera framing (`cam=yaw,pitch,dist`)
  let camera = null;
  const camRaw = params.get('cam');
  if (camRaw) {
    const parts = camRaw.split(',').map((x) => Number(x));
    if (parts.length >= 2 && parts.every((v) => Number.isFinite(v))) {
      camera = {
        yaw: Math.max(-6.3, Math.min(6.3, parts[0])),
        pitch: Math.max(-1.4, Math.min(1.4, parts[1])),
        dist: parts.length >= 3 ? Math.max(1.2, Math.min(6.0, parts[2])) : null
      };
    }
  }

  return Object.freeze({
    specimenKind,
    Z,
    A,
    formula,
    reactants,
    tab,
    view,
    hasExplicitQuantumNumbers,
    n,
    l,
    m,
    functional,
    relativisticSpinOrbit,
    tdksOrbitalPreset,
    tdksPolMode,
    tdksFieldView,
    probeWavelengthNm,
    photonModeMono,
    fissionBeta2,
    tempK,
    molColorMode,
    molShowOrbitalOverlay,
    vibDeuterated,
    polytopeRegime,
    simSpeed,
    camera
  });
}

/**
 * Serialize current Material Physics Lab state into a concise, human-readable,
 * shareable URL query string (starting with `?`). Only emits non-default
 * view parameters so links stay clean and readable.
 */
export function serializeElementsLabUrlState({
  specimenKind = 'element',
  Z = 26,
  A = null,
  formula = null,
  reactants = null,
  tab = 'nuclear',
  view = null,
  n = null,
  l = null,
  m = null,
  functional = 'pbe',
  relativisticSpinOrbit = true,
  tdksOrbitalPreset = 'valence',
  tdksPolMode = 0,
  tdksFieldView = 0,
  photonModeMono = false,
  probeWavelengthNm = 440,
  fissionBeta2 = 0,
  tempK = null,
  molColorMode = 0,
  molShowOrbitalOverlay = false,
  vibDeuterated = false,
  polytopeRegime = 'lab',
  simSpeed = 1.0,
  camera = null
} = {}, { includeCamera = false } = {}) {
  const params = new URLSearchParams();
  const safeTab = VALID_TABS.includes(tab) ? tab : 'nuclear';

  if (specimenKind === 'reaction' && Array.isArray(reactants) && reactants.length >= 2) {
    params.set('react', `${reactants[0]},${reactants[1]}`);
  } else if (specimenKind === 'compound' && formula) {
    params.set('compound', String(formula).trim());
  } else {
    const zClamped = Math.max(1, Math.min(118, Math.trunc(Number(Z) || 26)));
    params.set('el', symbolForZ(zClamped));
    const defaultA = mostStableMassNumberForZ(zClamped);
    if (A != null && Number.isFinite(Number(A)) && Math.trunc(Number(A)) !== defaultA) {
      params.set('a', String(Math.trunc(Number(A))));
    }
  }

  params.set('tab', safeTab);
  const allowed = TAB_VIEWS[safeTab] || [];
  if (view && allowed.includes(view)) {
    params.set('view', view);
  }

  if (safeTab === 'nuclear') {
    if (view === 'fission' && Number(fissionBeta2) > 0.01) {
      params.set('b2', Number(fissionBeta2).toFixed(2));
    }
  } else if (safeTab === 'atomic') {
    if (specimenKind === 'element') {
      if (Number.isFinite(n)) params.set('n', String(Math.trunc(n)));
      if (Number.isFinite(l)) params.set('l', String(Math.trunc(l)));
      if (Number.isFinite(m)) params.set('m', String(Math.trunc(m)));
      if (functional && functional !== 'pbe') params.set('xc', functional);
      if (relativisticSpinOrbit === false) params.set('rel', '0');
    }
  } else if (safeTab === 'crystal') {
    if (specimenKind === 'element' && relativisticSpinOrbit === false) {
      params.set('rel', '0');
    }
    if (view === 'tdks-atom') {
      if (tdksOrbitalPreset && tdksOrbitalPreset !== 'valence') params.set('orb', tdksOrbitalPreset);
      if (tdksPolMode > 0 && POL_CODE_TO_NAME[tdksPolMode]) params.set('pol', POL_CODE_TO_NAME[tdksPolMode]);
      if (tdksFieldView > 0 && FVIEW_CODE_TO_NAME[tdksFieldView]) params.set('fview', FVIEW_CODE_TO_NAME[tdksFieldView]);
      if (photonModeMono) params.set('lam', String(Math.round(probeWavelengthNm || 440)));
    } else if (view === 'photon-shell') {
      if (photonModeMono) params.set('lam', String(Math.round(probeWavelengthNm || 440)));
    } else if (view === 'spin-llg' || view === 'transport') {
      if (Number.isFinite(tempK) && Math.abs(tempK - 300) >= 1) {
        params.set('T', tempK < 20 ? Number(tempK).toFixed(1) : String(Math.round(tempK)));
      }
    }
  } else if (safeTab === 'md') {
    if (Number.isFinite(tempK)) {
      params.set('T', String(Math.round(tempK)));
    }
  } else if (safeTab === 'compound') {
    if (molColorMode === 1) params.set('mep', '1');
    if (molShowOrbitalOverlay) params.set('orbCloud', '1');
    if (view === 'vibrations' && vibDeuterated) params.set('deut', '1');
    if (view === 'reactive-md' && Number.isFinite(tempK) && Math.abs(tempK - 340) >= 5) {
      params.set('T', String(Math.round(tempK)));
    }
  } else if (safeTab === 'polytope') {
    if (polytopeRegime === 'planetary') params.set('regime', 'planetary');
  }

  if (simSpeed != null && Number.isFinite(Number(simSpeed)) && Number(simSpeed) > 0 && Math.abs(Number(simSpeed) - 1.0) >= 0.025) {
    params.set('speed', Number(simSpeed).toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));
  }

  if (includeCamera && camera && Number.isFinite(camera.yaw) && Number.isFinite(camera.pitch)) {
    const isDefault = Math.abs(camera.yaw - 0.42) < 0.03
      && Math.abs(camera.pitch - 0.28) < 0.03
      && (!Number.isFinite(camera.dist) || Math.abs(camera.dist - 2.85) < 0.05);
    if (!isDefault) {
      const distStr = Number.isFinite(camera.dist) ? `,${camera.dist.toFixed(2)}` : '';
      params.set('cam', `${camera.yaw.toFixed(2)},${camera.pitch.toFixed(2)}${distStr}`);
    }
  }

  return `?${params.toString()}`;
}

export function formatElementsLabPageTitle({
  specimenKind = 'element',
  Z = 26,
  A = null,
  formula = null,
  reactants = null,
  tab = 'nuclear',
  view = null
} = {}) {
  const viewNames = {
    tdse: 'Nuclear TDSE',
    fission: '3D Nuclear Fission',
    bateman: 'Bateman Decay',
    cloud: '3D Dirac–KS Orbital',
    volume: 'Spin Volume',
    'photon-shell': '2D Maxwell Optical Slab',
    lattice: '3D Crystal Cell',
    bloch: '3D Bloch Bands',
    'tdks-atom': '3D Maxwell–KS Atom',
    'spin-llg': '3D Spin Lattice',
    transport: 'Electron Transport / BCS',
    equilibrium: 'Live MD & Phonons',
    strain: 'MD Stress–Strain',
    acoustic: 'Acoustic Crystal Bar',
    shear: 'Couette Viscosity',
    thermal: 'Thermal Transport',
    surface: 'Surface Tension Slab',
    molecule: '3D Molecule & Bonds',
    'reaction-path': 'GPU CI-NEB Reaction',
    vibrations: 'IR/Raman Vibrations',
    'reactive-md': '3D Reactive MD',
    '3d-surface': '3D Polytope Atlas',
    '2d-facets': '2D Polytope Facets',
    'residual-map': 'Chebyshev Residuals'
  };
  let subj;
  if (specimenKind === 'reaction' && Array.isArray(reactants) && reactants.length >= 2) {
    subj = `${reactants[0]} + ${reactants[1]}`;
  } else if (specimenKind === 'compound' && formula) {
    subj = formula;
  } else {
    const sym = symbolForZ(Math.max(1, Math.min(118, Math.trunc(Number(Z) || 26))));
    const defA = mostStableMassNumberForZ(Math.max(1, Math.min(118, Math.trunc(Number(Z) || 26))));
    subj = (A != null && Math.trunc(Number(A)) !== defA) ? `${sym}-${Math.trunc(Number(A))}` : sym;
  }
  const vLabel = viewNames[view] || viewNames[TAB_DEFAULT_VIEW[tab]] || tab;
  return `${subj} · ${vLabel} — ULG Material Physics Lab`;
}
