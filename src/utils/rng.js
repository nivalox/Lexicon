/** Small seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function createRng(seed = 1) {
  let a = seed | 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int32 = () => (next() * 4294967296) | 0;
  next.int = (n) => Math.floor(next() * n);
  return next;
}
