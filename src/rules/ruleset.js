import { BLACK, WHITE } from '../utils/constants.js';

export const PROMOTION_MODES = ['ends', 'continuesAsKing', 'continuesAsMan'];

/** Every ruleset field and its default. Rulesets are plain JSON-compatible objects. */
export const RULESET_DEFAULTS = Object.freeze({
  id: 'custom',
  name: 'Custom',
  size: 8,                          // board is size x size; max 10 (squares are packed in 7 bits)
  startRows: 3,                     // rows of men per side at the start
  firstMove: 'black',               // 'black' (top, moves down) | 'white' (bottom, moves up)
  menCaptureBackward: false,
  flyingKings: false,               // long-range kings (move and capture along whole diagonals)
  mandatoryCapture: true,           // alias: forceJumps. false = captures are optional
  stopMultiJumpEarly: false,        // may end a multi-jump after any capture (needs mandatoryCapture=false)
  majorityCapture: false,           // must take the sequence that captures the most pieces (needs mandatoryCapture)
  promotionDuringCapture: 'ends',   // 'ends' | 'continuesAsKing' | 'continuesAsMan'
  capturedRemovedAfterSequence: true, // true: captured pieces stay on the board and BLOCK until the sequence ends
                                    // false: they vanish immediately and later jumps may pass through their squares
                                    // (alias: capturedPiecesBlock, same meaning as true/false above)
  noProgressPlies: 80,              // draw after N plies without a capture or man move (0 = off)
  kingsOnlyPlies: 0,                // draw after N plies, only when all pieces are kings (0 = off)
  repetitionCount: 3,               // draw on N-fold repetition (0 = off)
  notation: 'numeric',
  verified: false,                  // true only when checked against an official rulebook
  notes: '',
});

const ALIASES = { forceJumps: 'mandatoryCapture', capturedPiecesBlock: 'capturedRemovedAfterSequence' };

/** Applies friendly aliases (forceJumps, capturedPiecesBlock); reports conflicts with the canonical name. */
function normalize(def, errors = []) {
  const out = { ...def };
  for (const [alias, canon] of Object.entries(ALIASES)) {
    if (!(alias in out)) continue;
    if (canon in out && out[canon] !== out[alias]) errors.push(`${alias} and ${canon} disagree`);
    out[canon] = out[alias];
    delete out[alias];
  }
  return out;
}

export function validateRuleset(def) {
  const e = [];
  const r = { ...RULESET_DEFAULTS, ...normalize(def, e) };
  if (!Number.isInteger(r.size) || r.size < 4 || r.size > 10 || r.size % 2) e.push('size must be an even integer between 4 and 10');
  if (!Number.isInteger(r.startRows) || r.startRows < 1 || r.startRows * 2 >= r.size) e.push('startRows must leave at least one empty row between the armies');
  if (r.firstMove !== 'black' && r.firstMove !== 'white') e.push("firstMove must be 'black' or 'white'");
  if (!PROMOTION_MODES.includes(r.promotionDuringCapture)) e.push(`promotionDuringCapture must be one of ${PROMOTION_MODES.join(', ')}`);
  for (const k of ['noProgressPlies', 'kingsOnlyPlies', 'repetitionCount']) {
    if (!Number.isInteger(r[k]) || r[k] < 0) e.push(`${k} must be a non-negative integer`);
  }
  for (const k of ['menCaptureBackward', 'flyingKings', 'mandatoryCapture', 'majorityCapture', 'stopMultiJumpEarly', 'capturedRemovedAfterSequence']) {
    if (typeof r[k] !== 'boolean') e.push(`${k} must be a boolean`);
  }
  if (r.stopMultiJumpEarly === true && r.mandatoryCapture !== false) e.push('stopMultiJumpEarly requires mandatoryCapture (forceJumps) = false');
  if (r.majorityCapture === true && r.mandatoryCapture !== true) e.push('majorityCapture requires mandatoryCapture = true');
  if (typeof r.id !== 'string' || !r.id) e.push('id must be a non-empty string');
  return e;
}

export function createRuleset(def) {
  const errors = validateRuleset(def);
  if (errors.length) throw new Error(`Invalid ruleset: ${errors.join('; ')}`);
  const r = { ...RULESET_DEFAULTS, ...normalize(def) };
  r.firstTurn = r.firstMove === 'black' ? BLACK : WHITE;
  return Object.freeze(r);
}
