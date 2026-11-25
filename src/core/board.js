/**
 * Board geometry for any even size up to 10x10.
 * Orientation: row 0 is the top (Black's side), row size-1 the bottom (White's side),
 * and the bottom-left square is dark. Dark squares are those where (row + col) is odd.
 * Playable squares are numbered 1..size*size/2 left-to-right, top-to-bottom.
 */
const cache = new Map();

export const DIRS_DOWN = [0, 1];       // Black men move down
export const DIRS_UP = [2, 3];         // White men move up
export const DIRS_ALL = [0, 1, 2, 3];
// direction d: 0 = down-left, 1 = down-right, 2 = up-left, 3 = up-right
const DR = [1, 1, -1, -1];
const DC = [-1, 1, -1, 1];

export function getGeometry(size) {
  if (cache.has(size)) return cache.get(size);
  const n = size * size, half = size / 2;
  const NEXT = new Int16Array(n * 4).fill(-1); // neighbour square in each direction, or -1
  const dark = new Uint8Array(n);
  const rowOf = new Uint8Array(n);
  const colOf = new Uint8Array(n);
  const sqToNum = new Int16Array(n);           // internal index -> playable number (0 for light squares)
  const numToSq = new Int16Array(half * size + 1);
  const center = new Int8Array(n);
  const mainDiag = new Uint8Array(n);          // squares with row+col == size-1 (the long diagonal)
  const mid = (size - 1) / 2;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const sq = r * size + c;
      rowOf[sq] = r; colOf[sq] = c;
      dark[sq] = (r + c) & 1;
      center[sq] = Math.round(size / 2 - (Math.abs(r - mid) + Math.abs(c - mid)));
      mainDiag[sq] = r + c === size - 1 ? 1 : 0;
      for (let d = 0; d < 4; d++) {
        const r1 = r + DR[d], c1 = c + DC[d];
        if (r1 >= 0 && r1 < size && c1 >= 0 && c1 < size) NEXT[sq * 4 + d] = r1 * size + c1;
      }
    }
    for (let k = 0; k < half; k++) {
      const c = 2 * k + (r % 2 === 0 ? 1 : 0);
      const num = r * half + k + 1;
      sqToNum[r * size + c] = num;
      numToSq[num] = r * size + c;
    }
  }
  const geo = { size, n, half, squares: half * size, NEXT, dark, rowOf, colOf, sqToNum, numToSq, center, mainDiag };
  cache.set(size, geo);
  return geo;
}

/** Piece codes: 0 empty, +1/+2 black man/king, -1/-2 white man/king. */
export const isKing = (p) => p === 2 || p === -2;
