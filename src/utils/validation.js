export function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

export function deepMerge(base, over) {
  if (!isPlainObject(base) || !isPlainObject(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = isPlainObject(base[k]) && isPlainObject(over[k]) ? deepMerge(base[k], over[k]) : over[k];
  return out;
}

const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Returns a list of problems. An empty list means the configuration is safe to apply. */
export function validateConfig(c) {
  const e = [];
  const s = c.search || {}, st = c.strength || {}, ev = c.evaluation || {};
  if (!num(s.hashMB, 1, 4096)) e.push('search.hashMB must be between 1 and 4096');
  if (!num(s.maxDepth, 1, 128)) e.push('search.maxDepth must be between 1 and 128');
  if (!['pvs', 'alphabeta'].includes(s.algorithm)) e.push("search.algorithm must be 'pvs' or 'alphabeta'");
  if (s.threads !== 1) e.push('search.threads: only 1 thread is supported');
  if (!num(s.aspirationWindow, 1, 10000)) e.push('search.aspirationWindow must be between 1 and 10000');
  if (!num(s.maxQuiescenceDepth, 0, 64)) e.push('search.maxQuiescenceDepth must be between 0 and 64');
  if (!(st.level === 'custom' || (Number.isInteger(st.level) && st.level >= 1 && st.level <= 9))) e.push("strength.level must be 1-9 or 'custom'");
  if (st.maxDepth !== undefined && !num(st.maxDepth, 1, 128)) e.push('strength.maxDepth must be between 1 and 128');
  if (st.timeLimit !== undefined && !num(st.timeLimit, 0, 3_600_000)) e.push('strength.timeLimit must be between 0 and 3600000');
  if (st.nodeLimit !== undefined && !num(st.nodeLimit, 0, 1e12)) e.push('strength.nodeLimit must be >= 0');
  if (st.randomness !== undefined && !num(st.randomness, 0, 1)) e.push('strength.randomness must be between 0 and 1');
  if (!isPlainObject(ev.features)) e.push('evaluation.features must be an object');
  else for (const [k, f] of Object.entries(ev.features)) {
    if (!num(f.opening, -10000, 10000) || !num(f.endgame, -10000, 10000)) e.push(`evaluation.features.${k} needs numeric opening/endgame weights`);
  }
  if (ev.kingRatio !== null && ev.kingRatio !== undefined && !num(ev.kingRatio, 1, 10)) e.push('evaluation.kingRatio must be null or between 1 and 10');
  return e;
}
