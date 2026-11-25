// Writes the JSON forms of rulesets and configuration: rules/*.json and config/*.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VARIANT_DEFINITIONS } from '../src/rules/variants.js';
import { DEFAULT_CONFIG } from '../src/config/defaults.js';
import { STRENGTH_PRESETS } from '../src/strength/presets.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const w = (rel, obj) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), JSON.stringify(obj, null, 2) + '\n'); };
for (const [id, def] of Object.entries(VARIANT_DEFINITIONS)) w(`rules/${id}.json`, def);
w('config/default.json', DEFAULT_CONFIG);
w('config/search.json', DEFAULT_CONFIG.search);
w('config/evaluation.json', DEFAULT_CONFIG.evaluation);
w('config/strength.json', { current: DEFAULT_CONFIG.strength, presets: STRENGTH_PRESETS });
w('config/browser.json', DEFAULT_CONFIG.browser);
for (const id of Object.keys(VARIANT_DEFINITIONS)) w(`books/${id}.json`, { format: 'lexicon-book-1', variant: id, source: 'empty', entries: [] });
console.log('exported rules/, config/ and books/');
