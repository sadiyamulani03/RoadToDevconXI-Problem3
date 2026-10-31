import { mul, complement, PRECISION } from "./fixedpoint.ts";

/**
 * Distribution engine matching Solidity DistributionEngine.
 * Computes package allocations from a funding pot, weights, retention rates,
 * and dependency graph using bounded Neumann-series iteration.
 *
 * Guarantees exact conservation: sum(allocations) + dust == pot exactly.
 *
 * Algorithm:
 *   1. base[i] = pot * w_i / 1e18; base remainder -> root.
 *   2. Neumann iterations: total = base + M*base + M^2*base + ...
 *      where M sends (1-r_i)*term[i] to deps proportional to weights.
 *   3. Final allocation a_i = r_i * total_received_i.
 *   4. Dust = pot - sum(a_i) swept to root.
 *
 * Fixed round count bounds gas and guarantees termination for cyclic graphs.
 */

export interface DistributionInput {
  packages: string[];           // ordered package addresses
  weights: bigint[];            // fixed-point weights (sum == 1e18)
  retention: bigint[];          // fixed-point retention [0, 1e18]
  depIndices: number[][];       // depIndices[i] = indices into packages that i depends on
  pot: bigint;                  // total funding pot (wei)
  rootIndex: number;            // index of root package (receives dust)
  maxRounds: number;            // Neumann iteration rounds (bounded)
}

export interface DistributionOutput {
  allocations: bigint[];
  dust: bigint;
  totalReceived: bigint[];
}

export function computeDistribution(input: DistributionInput): DistributionOutput {
  const { packages, weights, retention, depIndices, pot, rootIndex, maxRounds } = input;
  const n = packages.length;
  if (n === 0) throw new Error("Dist: no packages");
  if (weights.length !== n) throw new Error("Dist: weights length");
  if (retention.length !== n) throw new Error("Dist: retention length");
  if (depIndices.length !== n) throw new Error("Dist: deps length");
  if (rootIndex < 0 || rootIndex >= n) throw new Error("Dist: bad root index");
  if (maxRounds <= 0 || maxRounds > 256) throw new Error("Dist: bad rounds");

  // Validate weights sum to 1e18.
  let wsum = 0n;
  for (let i = 0; i < n; i++) wsum += weights[i];
  if (wsum !== PRECISION) throw new Error("Dist: weights must sum to 1e18");

  // Base allocation from pot by weight.
  const base: bigint[] = new Array(n);
  let baseRemainder = pot;
  for (let i = 0; i < n; i++) {
    base[i] = mul(pot, weights[i]);
    baseRemainder -= base[i];
  }
  // Give base remainder to root.
  base[rootIndex] += baseRemainder;

  // Precompute dep weight sums for proportional splitting.
  const depWeightSum: bigint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0n;
    for (const d of depIndices[i]) s += weights[d];
    depWeightSum[i] = s;
  }

  // total[] = total funding received (base + inflows).
  // term[] = newly received funding to propagate this round.
  const total: bigint[] = new Array(n);
  const term: bigint[] = new Array(n);
  for (let i = 0; i < n; i++) {
    total[i] = base[i];
    term[i] = base[i];
  }

  // Neumann iterations.
  for (let round = 0; round < maxRounds; round++) {
    const next: bigint[] = new Array(n).fill(0n);
    for (let i = 0; i < n; i++) {
      if (term[i] === 0n) continue;
      const send = mul(term[i], complement(retention[i]));
      if (send === 0n) continue;
      const d = depIndices[i];
      if (d.length === 0) continue; // no deps -> send lost to dust
      const dwsum = depWeightSum[i];
      if (dwsum === 0n) continue; // zero-weight deps -> dust
      let sentSoFar = 0n;
      for (let k = 0; k < d.length; k++) {
        let share: bigint;
        if (k === d.length - 1) {
          share = send - sentSoFar;
        } else {
          share = (mul(send, weights[d[k]]) * PRECISION) / dwsum;
          sentSoFar += share;
        }
        if (share > 0n) next[d[k]] += share;
      }
    }
    for (let i = 0; i < n; i++) {
      total[i] += next[i];
      term[i] = next[i];
    }
  }

  // Final allocation = retained portion = r_i * total_received_i.
  const alloc: bigint[] = new Array(n);
  let allocSum = 0n;
  for (let i = 0; i < n; i++) {
    alloc[i] = mul(total[i], retention[i]);
    allocSum += alloc[i];
  }
  if (allocSum > pot) throw new Error("Dist: allocation exceeds pot");
  const dustAmount = pot - allocSum;
  alloc[rootIndex] += dustAmount;

  return { allocations: alloc, dust: dustAmount, totalReceived: total };
}
