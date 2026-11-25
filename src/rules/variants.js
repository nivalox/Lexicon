import { createRuleset } from './ruleset.js';
import { american } from './american.js';
import { international } from './international.js';
import { russian } from './russian.js';
import { brazilian } from './brazilian.js';
import { pool } from './pool.js';

export const VARIANT_DEFINITIONS = { american, international, russian, brazilian, pool };
const registry = new Map();
for (const def of Object.values(VARIANT_DEFINITIONS)) registry.set(def.id, createRuleset(def));

/** Register a new variant from a plain object (e.g. parsed from JSON). */
export function registerVariant(def) {
  const rules = createRuleset(def);
  registry.set(rules.id, rules);
  return rules;
}

/** Resolve a variant id, a ruleset object, or a plain definition into a ruleset. */
export function getRuleset(idOrDef = 'american') {
  if (typeof idOrDef === 'string') {
    const r = registry.get(idOrDef.toLowerCase());
    if (!r) throw new Error(`Unknown variant "${idOrDef}". Known: ${[...registry.keys()].join(', ')}`);
    return r;
  }
  if (idOrDef && idOrDef.firstTurn !== undefined && Object.isFrozen(idOrDef)) return idOrDef;
  return createRuleset(idOrDef);
}

export const listVariants = () => [...registry.keys()];
