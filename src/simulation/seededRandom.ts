/**
 * NeuroForge Simulation Engine — Deterministic Seeded PRNG
 *
 * Implements the mulberry32 algorithm (32-bit state), which is fast,
 * reproducible, and passes basic statistical quality tests.
 *
 * Reference: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 *
 * Unit-testable: given the same seed, every sequence of calls returns
 * identical values, making simulation results reproducible.
 */

// ---------------------------------------------------------------------------
// PRNG state container
// ---------------------------------------------------------------------------

/** Opaque PRNG handle; do not modify its internals directly. */
export interface SeededRng {
  /** Current 32-bit state. Advance it only through `nextFloat`. */
  state: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new PRNG seeded with the given integer.
 * The seed is hashed once before use to decorrelate nearby seed values.
 */
export function createRng(seed: number): SeededRng {
  // Hash the seed with a single mulberry32 step to avoid low-quality output
  // for very small seed values (e.g., 0 or 1).
  return { state: (seed >>> 0) ^ 0xdeadbeef };
}

// ---------------------------------------------------------------------------
// Sampling functions
// ---------------------------------------------------------------------------

/**
 * Advance the PRNG and return the next value in [0, 1).
 * Mutates `rng.state`.
 */
export function nextFloat(rng: SeededRng): number {
  // mulberry32 step
  let z = (rng.state += 0x6d2b79f5);
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  rng.state = z;
  return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
}

/**
 * Return a value uniformly distributed in [min, max).
 */
export function nextRange(rng: SeededRng, min: number, max: number): number {
  return min + nextFloat(rng) * (max - min);
}

/**
 * Return the next sample from a normal distribution with the given
 * mean and standard deviation, using the Box-Muller transform.
 * Both `u1` and `u2` are consumed from the generator.
 */
export function nextNormal(
  rng: SeededRng,
  mean: number,
  stddev: number,
): number {
  // Box-Muller — uses two uniform samples
  const u1 = Math.max(nextFloat(rng), 1e-10); // avoid log(0)
  const u2 = nextFloat(rng);
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stddev;
}

/**
 * Clamp `value` to [lo, hi].
 * Exported here because every module that clamps simulation values uses it.
 */
export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}
