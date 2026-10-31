// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FixedPoint} from "./FixedPoint.sol";

/**
 * @title WeightingLib
 * @dev Converts a pairwise comparison matrix into deterministic importance
 * weights using fixed-point power iteration (principal eigenvector).
 *
 * All math is fixed-point (1e18). No floating point. Fixed iteration count
 * guarantees termination and reproducibility.
 *
 * Method:
 *   1. Build smoothed matrix M[i][j] = (comparisons[i][j] + 1) / columnSum(j)
 *      The +1 smoothing makes the matrix positive/primitive, guaranteeing a
 *      unique principal eigenvector (Perron-Frobenius) and handling missing
 *      comparisons / disconnected components.
 *   2. Power iteration: v_{t+1} = M * v_t, L1-normalize to 1e18 each round.
 *   3. Fixed 64 rounds. Deterministic given the same matrix.
 *   4. Residual (1e18 - sum) assigned to the highest-weight package for exact
 *      normalization.
 */
library WeightingLib {
    uint256 internal constant ITERATIONS = 64;
    uint256 internal constant SMOOTHING = 1; // +1 vote per cell

    /**
     * @dev Compute weights from a comparison matrix.
     * `packages` = ordered package addresses (length n).
     * `comparisons` = n x n matrix; comparisons[i][j] = # jurors voting i > j.
     * Returns weights[] (length n, sum == 1e18 exactly), aligned with packages.
     */
    function computeWeights(address[] memory packages, uint256[][] memory comparisons)
        internal
        pure
        returns (uint256[] memory weights)
    {
        uint256 n = packages.length;
        require(n > 0, "WeightingLib: no packages");
        require(comparisons.length == n, "WeightingLib: matrix rows mismatch");

        weights = new uint256[](n);
        // Build column-stochastic matrix M (as uint256 fixed point 1e18).
        // M[i][j] fixed point.
        uint256[][] memory M = new uint256[][](n);
        for (uint256 j = 0; j < n; j++) {
            M[j] = new uint256[](n);
        }

        // Column sums.
        uint256[] memory colSum = new uint256[](n);
        for (uint256 j = 0; j < n; j++) {
            uint256 s = 0;
            for (uint256 i = 0; i < n; i++) {
                s += comparisons[i][j] + SMOOTHING;
            }
            colSum[j] = s;
        }

        // Fill M[i][j] = (comparisons[i][j] + 1) * 1e18 / colSum[j].
        for (uint256 j = 0; j < n; j++) {
            for (uint256 i = 0; i < n; i++) {
                uint256 val = comparisons[i][j] + SMOOTHING;
                M[j][i] = (val * 1e18) / colSum[j]; // note: M[j][i] = row j, col i?
                // We want M[row][col]. Let M[i][j] = fraction of j's weight flowing to i.
            }
        }
        // Rebuild correctly: M[i][j] = (comparisons[i][j] + 1) / colSum[j].
        for (uint256 j = 0; j < n; j++) {
            for (uint256 i = 0; i < n; i++) {
                uint256 val = comparisons[i][j] + SMOOTHING;
                M[i][j] = (val * 1e18) / colSum[j];
            }
        }

        // Initialize v[i] = 1e18 / n.
        uint256[] memory v = new uint256[](n);
        uint256 init = 1e18 / n;
        for (uint256 i = 0; i < n; i++) {
            v[i] = init;
        }

        // Power iteration.
        uint256[] memory vNew = new uint256[](n);
        for (uint256 round = 0; round < ITERATIONS; round++) {
            // vNew[i] = sum_j M[i][j] * v[j] (fixed point).
            for (uint256 i = 0; i < n; i++) {
                uint256 acc = 0;
                for (uint256 j = 0; j < n; j++) {
                    acc += FixedPoint.mul(v[j], M[i][j]);
                }
                vNew[i] = acc;
            }
            // L1 normalize to 1e18.
            uint256 total = 0;
            for (uint256 i = 0; i < n; i++) {
                total += vNew[i];
            }
            if (total > 0) {
                uint256 factor = (1e18 * 1e18) / total; // scale factor in fixed point
                for (uint256 i = 0; i < n; i++) {
                    v[i] = FixedPoint.mul(vNew[i], factor);
                }
            } else {
                for (uint256 i = 0; i < n; i++) {
                    v[i] = init;
                }
            }
        }

        // Assign to output and handle residual for exact sum 1e18.
        uint256 total = 0;
        uint256 maxIdx = 0;
        uint256 maxVal = 0;
        for (uint256 i = 0; i < n; i++) {
            weights[i] = v[i];
            total += v[i];
            if (v[i] > maxVal) {
                maxVal = v[i];
                maxIdx = i;
            }
        }
        if (total > 1e18) {
            require(weights[maxIdx] >= total - 1e18, "WeightingLib: residual underflow");
            weights[maxIdx] -= (total - 1e18);
        } else if (total < 1e18) {
            weights[maxIdx] += (1e18 - total);
        }
        return weights;
    }
}
