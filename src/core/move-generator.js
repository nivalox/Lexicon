import { CAPTURED } from '../utils/constants.js';
import { Move } from './move.js';
import { DIRS_ALL, DIRS_DOWN, DIRS_UP } from './board.js';

/**
 * Legal move generation, driven entirely by the position's ruleset.
 * Captured pieces stay on the board (as blocking markers) until a sequence ends,
 * so no piece can be jumped twice and a mover may pass back through its origin.
 */
export function generateMoves(pos) {
  const { board, turn, rules, geo } = pos;
  const out = [];
  for (let sq = 0; sq < geo.n; sq++) {
    const p = board[sq];
    if (p * turn > 0) genCaptures(pos, sq, p, out);
  }
  if (out.length) {
    if (rules.majorityCapture) {
      let max = 0;
      for (let i = 0; i < out.length; i++) if (out[i].caps.length > max) max = out[i].caps.length;
      let w = 0;
      for (let i = 0; i < out.length; i++) if (out[i].caps.length === max) out[w++] = out[i];
      out.length = w;
    }
    if (rules.mandatoryCapture) return out;
  }
  genQuiet(pos, out);
  return out;
}

function genQuiet(pos, out) {
  const { board, turn, rules, geo } = pos;
  const NEXT = geo.NEXT, size = geo.size, flying = rules.flyingKings;
  for (let sq = 0; sq < geo.n; sq++) {
    const p = board[sq];
    if (p * turn <= 0) continue;
    const king = p === 2 || p === -2;
    const dirs = king ? DIRS_ALL : p > 0 ? DIRS_DOWN : DIRS_UP;
    const kingRow = p > 0 ? size - 1 : 0;
    for (let i = 0; i < dirs.length; i++) {
      let to = NEXT[sq * 4 + dirs[i]];
      while (to >= 0 && board[to] === 0) {
        out.push(new Move(geo, sq, to, [sq, to], [], [], !king && geo.rowOf[to] === kingRow));
        if (!(king && flying)) break;
        to = NEXT[to * 4 + dirs[i]];
      }
    }
  }
}

function genCaptures(pos, start, piece, out) {
  const b = pos.board, geo = pos.geo, NEXT = geo.NEXT, rowOf = geo.rowOf, rules = pos.rules;
  const flying = rules.flyingKings, mode = rules.promotionDuringCapture;
  const startKing = piece === 2 || piece === -2;
  const kingRow = piece > 0 ? geo.size - 1 : 0;
  const manDirs = rules.menCaptureBackward ? DIRS_ALL : piece > 0 ? DIRS_DOWN : DIRS_UP;
  const path = [start], caps = [], capP = [];
  b[start] = 0; // the moving piece leaves its square for the duration of the search

  // Is any capture available from sq (with the current captured markers in place)?
  const canCapture = (sq, isKing) => {
    const dirs = isKing ? DIRS_ALL : manDirs;
    for (let i = 0; i < dirs.length; i++) {
      const d = dirs[i];
      let s = NEXT[sq * 4 + d];
      if (isKing && flying) while (s >= 0 && b[s] === 0) s = NEXT[s * 4 + d];
      if (s < 0) continue;
      const mp = b[s];
      if (mp === 0 || mp === CAPTURED || mp * piece > 0) continue;
      const l = NEXT[s * 4 + d];
      if (l >= 0 && b[l] === 0) return true;
    }
    return false;
  };

  const record = (L, nowKing) => {
    path.push(L);
    const promotes = !startKing && (mode === 'continuesAsMan' ? rowOf[L] === kingRow : nowKing);
    out.push(new Move(geo, start, L, path.slice(), caps.slice(), capP.slice(), promotes));
    path.pop();
  };

  const dfs = (sq, isKing) => {
    const dirs = isKing ? DIRS_ALL : manDirs;
    for (let i = 0; i < dirs.length; i++) {
      const d = dirs[i];
      let s = NEXT[sq * 4 + d];
      if (isKing && flying) while (s >= 0 && b[s] === 0) s = NEXT[s * 4 + d];
      if (s < 0) continue;
      const mp = b[s];
      if (mp === 0 || mp === CAPTURED || mp * piece > 0) continue;
      let L = NEXT[s * 4 + d];
      if (L < 0 || b[L] !== 0) continue;

      b[s] = CAPTURED; caps.push(s); capP.push(mp);

      const landings = [];
      if (isKing && flying) { while (L >= 0 && b[L] === 0) { landings.push(L); L = NEXT[L * 4 + d]; } }
      else landings.push(L);

      // A flying king that can keep capturing from some landing square must land on one of those.
      let continued = false;
      const terms = [];
      for (let j = 0; j < landings.length; j++) {
        const L2 = landings[j];
        const promo = !isKing && rowOf[L2] === kingRow;
        if (promo && mode === 'ends') { terms.push(L2, true); continue; }
        const nk = isKing || (promo && mode === 'continuesAsKing');
        if (canCapture(L2, nk)) {
          continued = true;
          path.push(L2); dfs(L2, nk); path.pop();
        } else terms.push(L2, nk);
      }
      if (!continued) for (let j = 0; j < terms.length; j += 2) record(terms[j], terms[j + 1]);

      b[s] = mp; caps.pop(); capP.pop();
    }
  };

  dfs(start, startKing);
  b[start] = piece;
}
