import { mul, PRECISION, div } from "./fixedpoint.ts";

/**
 * Weighting engine matching Solidity WeightingLib.
 * Converts pairwise comparison matrix into deterministic importance weights
 * using fixed-point power iteration (principal eigenvector).
 *
 * Method:
 *   1. Build smoothed matrix M[i][j] = (comparisons[i][j] + 1) / columnSum(j)
 *      +1 smoothing makes matrix positive/primitive -> unique principal
 *      eigenvector (Perron-Frobenius), handles missing comparisons /
 *      disconnected components.
 *   2. Power iteration: v_{t+1} = M * v_t, L1-normalize to 1e18 each round.
 *   3. Fixed 64 rounds. Deterministic given the same matrix.
 *   4. Residual (1e18 - sum) assigned to highest-weight package for exact
 *      normalization.
 */

const ITERATIONS = 64;
const SMOOTHING = 1n;

export function computeWeights(
  comparisons: bigint[][]
): { weights: bigint[]; iterations: number } {
  const n = comparisons.length;
  if (n === 0) throw new Error("WeightingLib: no packages");

  // Validate square matrix.
  for (let i = 0; i < n; i++) {
    if (comparisons[i].length !== n) throw new Error("WeightingLib: matrix not square");
  }

  // Column sums (with smoothing).
  const colSum: bigint[] = new Array(n).fill(0n);
  for (let j = 0; j < n; j++) {
    let s = 0n;
    for (let i = 0; i < n; i++) {
      s += comparisons[i][j] + SMOOTHING;
    }
    colSum[j] = s;
  }

  // M[i][j] = (comparisons[i][j] + 1) * 1e18 / colSum[j].
  const M: bigint[][] = [];
  for (let i = 0; i < n; i++) {
    M[i] = new Array(n);
    for (let j = 0; j < n; j++) {
      const val = comparisons[i][j] + SMOOTHING;
      M[i][j] = (val * PRECISION) / colSum[j];
    }
  }

  // Initialize v[i] = 1e18 / n.
  const v: bigint[] = new Array(n);
  const init = PRECISION / BigInt(n);
  for (let i = 0; i < n; i++) v[i] = init;

  const vNew: bigint[] = new Array(n);
  for (let round = 0; round < ITERATIONS; round++) {
    // vNew[i] = sum_j M[i][j] * v[j] (fixed point).
    for (let i = 0; i < n; i++) {
      let acc = 0n;
      for (let j = 0; j < n; j++) {
        acc += mul(v[j], M[i][j]);
      }
      vNew[i] = acc;
    }
    // L1 normalize to 1e18.
    let total = 0n;
    for (let i = 0; i < n; i++) total += vNew[i];
    if (total > 0n) {
      const factor = (PRECISION * PRECISION) / total;
      for (let i = 0; i < n; i++) v[i] = mul(vNew[i], factor);
    } else {
      for (let i = 0; i < n; i++) v[i] = init;
    }
  }

  // Assign output and handle residual for exact sum 1e18.
  const weights = new Array(n);
  let total = 0n;
  let maxIdx = 0;
  let maxVal = 0n;
  for (let i = 0; i < n; i++) {
    weights[i] = v[i];
    total += v[i];
    if (v[i] > maxVal) { maxVal = v[i]; maxIdx = i; }
  }
  if (total > PRECISION) {
    if (weights[maxIdx] < total - PRECISION) throw new Error("WeightingLib: residual underflow");
    weights[maxIdx] -= (total - PRECISION);
  } else if (total < PRECISION) {
    weights[maxIdx] += (PRECISION - total);
  }

  return { weights, iterations: ITERATIONS };
}
