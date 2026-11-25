import { createRng } from '../utils/rng.js';

const cache = new Map();

/** Zobrist tables: two independent 32-bit halves give a ~53-bit position key. */
export function getZobrist(size) {
  if (cache.has(size)) return cache.get(size);
  const n = size * size;
  const rng = createRng(0x1e8c1c0 + size);
  const Z1 = new Int32Array(4 * n), Z2 = new Int32Array(4 * n);
  for (let i = 0; i < Z1.length; i++) { Z1[i] = rng.int32(); Z2[i] = rng.int32(); }
  const z = { Z1, Z2, T1: rng.int32(), T2: rng.int32() };
  cache.set(size, z);
  return z;
}

/** 0 black man, 1 black king, 2 white man, 3 white king */
export const pieceIndex = (p) => (p > 0 ? 0 : 2) + (p === 2 || p === -2 ? 1 : 0);
