const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
let level = LEVELS.warn;
let sink = typeof console !== 'undefined' ? console : null;

export const logger = {
  setLevel(name) { if (name in LEVELS) level = LEVELS[name]; },
  setSink(s) { sink = s; },
  error: (...a) => { if (level >= 1 && sink) sink.error(...a); },
  warn: (...a) => { if (level >= 2 && sink) sink.warn(...a); },
  info: (...a) => { if (level >= 3 && sink) sink.log(...a); },
  debug: (...a) => { if (level >= 4 && sink) sink.log(...a); },
};
