// Authentic 18-Column IUPAC Periodic Table Layout & Metadata (Z = 1..118)
// (`src/demos/periodicTableMetadata.js`).
// Pure presentation metadata for the 18x7 + Lanthanide/Actinide picker modal
// (zero physics constants — all physics properties remain GPU-derived!).

import { ELEMENT_SYMBOLS, ATOMIC_MASS_U } from '../runtime/electronicStructure/periodicTable.js';

export const ELEMENT_NAMES = Object.freeze([
  'Hydrogen', 'Helium', 'Lithium', 'Beryllium', 'Boron', 'Carbon', 'Nitrogen', 'Oxygen', 'Fluorine', 'Neon',
  'Sodium', 'Magnesium', 'Aluminum', 'Silicon', 'Phosphorus', 'Sulfur', 'Chlorine', 'Argon', 'Potassium', 'Calcium',
  'Scandium', 'Titanium', 'Vanadium', 'Chromium', 'Manganese', 'Iron', 'Cobalt', 'Nickel', 'Copper', 'Zinc',
  'Gallium', 'Germanium', 'Arsenic', 'Selenium', 'Bromine', 'Krypton', 'Rubidium', 'Strontium', 'Yttrium', 'Zirconium',
  'Niobium', 'Molybdenum', 'Technetium', 'Ruthenium', 'Rhodium', 'Palladium', 'Silver', 'Cadmium', 'Indium', 'Tin',
  'Antimony', 'Tellurium', 'Iodine', 'Xenon', 'Cesium', 'Barium', 'Lanthanum', 'Cerium', 'Praseodymium', 'Neodymium',
  'Promethium', 'Samarium', 'Europium', 'Gadolinium', 'Terbium', 'Dysprosium', 'Holmium', 'Erbium', 'Thulium', 'Ytterbium',
  'Lutetium', 'Hafnium', 'Tantalum', 'Tungsten', 'Rhenium', 'Osmium', 'Iridium', 'Platinum', 'Gold', 'Mercury',
  'Thallium', 'Lead', 'Bismuth', 'Polonium', 'Astatine', 'Radon', 'Francium', 'Radium', 'Actinium', 'Thorium',
  'Protactinium', 'Uranium', 'Neptunium', 'Plutonium', 'Americium', 'Curium', 'Berkelium', 'Californium', 'Einsteinium', 'Fermium',
  'Mendelevium', 'Nobelium', 'Lawrencium', 'Rutherfordium', 'Dubnium', 'Seaborgium', 'Bohrium', 'Hassium', 'Meitnerium', 'Darmstadtium',
  'Roentgenium', 'Copernicium', 'Nihonium', 'Flerovium', 'Moscovium', 'Livermorium', 'Tennessine', 'Oganesson'
]);

export const ELEMENT_FAMILIES = Object.freeze({
  'alkali': { label: 'Alkali Metal', color: '#fb923c' },
  'alkaline-earth': { label: 'Alkaline Earth', color: '#facc15' },
  'transition': { label: 'Transition Metal', color: '#60a5fa' },
  'post-transition': { label: 'Post-Transition', color: '#38bdf8' },
  'metalloid': { label: 'Metalloid', color: '#2dd4bf' },
  'nonmetal': { label: 'Reactive Nonmetal', color: '#34d399' },
  'halogen': { label: 'Halogen', color: '#4ade80' },
  'noble': { label: 'Noble Gas', color: '#c084fc' },
  'lanthanide': { label: 'Lanthanide', color: '#f472b6' },
  'actinide': { label: 'Actinide', color: '#fb7185' }
});

const ALKALI_SET = new Set([3, 11, 19, 37, 55, 87]);
const ALKALINE_SET = new Set([4, 12, 20, 38, 56, 88]);
const METALLOID_SET = new Set([5, 14, 32, 33, 51, 52, 84]);
const NONMETAL_SET = new Set([1, 6, 7, 8, 15, 16, 34]);
const HALOGEN_SET = new Set([9, 17, 35, 53, 85, 117]);
const NOBLE_SET = new Set([2, 10, 18, 36, 54, 86, 118]);
const POST_TRANS_SET = new Set([13, 31, 49, 50, 81, 82, 83, 113, 114, 115, 116]);

// Highlight filter tags for fast exploration in the IUPAC picker
const FERROMAGNET_SET = new Set([26, 27, 28, 64, 66]);
const SUPERCONDUCTOR_SET = new Set([13, 22, 23, 30, 41, 42, 43, 44, 49, 50, 57, 73, 74, 75, 76, 77, 80, 81, 82, 90]);
const REACTIVE_METAL_SET = new Set([3, 11, 12, 13, 19, 20, 30, 37, 38, 55, 56, 87, 88]);

export function familyForZ(Z) {
  if (Z >= 57 && Z <= 71) return 'lanthanide';
  if (Z >= 89 && Z <= 103) return 'actinide';
  if (ALKALI_SET.has(Z)) return 'alkali';
  if (ALKALINE_SET.has(Z)) return 'alkaline-earth';
  if (NOBLE_SET.has(Z)) return 'noble';
  if (HALOGEN_SET.has(Z)) return 'halogen';
  if (NONMETAL_SET.has(Z)) return 'nonmetal';
  if (METALLOID_SET.has(Z)) return 'metalloid';
  if (POST_TRANS_SET.has(Z)) return 'post-transition';
  return 'transition';
}

/**
 * Exact 18-column IUPAC grid position `(row: 1..9, col: 1..18)` for every Z = 1..118:
 *   Rows 1..7: main 18-column periodic table (La/Ac slots carry range placeholders in col 3)
 *   Row 8 (col 4..18): Lanthanides (57..71)
 *   Row 9 (col 4..18): Actinides (89..103)
 */
export function iupacGridPositionForZ(Z) {
  if (Z === 1) return { row: 1, col: 1 };
  if (Z === 2) return { row: 1, col: 18 };
  if (Z <= 4) return { row: 2, col: Z - 2 };
  if (Z <= 10) return { row: 2, col: Z + 8 };
  if (Z <= 12) return { row: 3, col: Z - 10 };
  if (Z <= 18) return { row: 3, col: Z };
  if (Z <= 36) return { row: 4, col: Z - 18 };
  if (Z <= 54) return { row: 5, col: Z - 36 };
  if (Z <= 56) return { row: 6, col: Z - 54 };
  if (Z <= 71) return { row: 8, col: Z - 53 }; // 57->col 4 .. 71->col 18
  if (Z <= 86) return { row: 6, col: Z - 68 }; // 72->col 4 .. 86->col 18
  if (Z <= 88) return { row: 7, col: Z - 86 };
  if (Z <= 103) return { row: 9, col: Z - 85 }; // 89->col 4 .. 103->col 18
  return { row: 7, col: Z - 100 }; // 104->col 4 .. 118->col 18
}

export function buildIupacPeriodicTableEntries() {
  const list = [];
  for (let Z = 1; Z <= 118; Z += 1) {
    const pos = iupacGridPositionForZ(Z);
    const family = familyForZ(Z);
    list.push({
      Z,
      symbol: ELEMENT_SYMBOLS[Z - 1],
      name: ELEMENT_NAMES[Z - 1],
      massU: ATOMIC_MASS_U[Z - 1],
      row: pos.row,
      col: pos.col,
      family,
      isFerromagnet: FERROMAGNET_SET.has(Z),
      isSuperconductor: SUPERCONDUCTOR_SET.has(Z),
      isReactiveMetal: REACTIVE_METAL_SET.has(Z)
    });
  }
  return list;
}
