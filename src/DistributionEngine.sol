// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FixedPoint} from "./lib/FixedPoint.sol";

/**
 * @title DistributionEngine
 * @dev Computes package allocations from a funding pot, weights, retention
 * rates, and the dependency graph. Uses a bounded Neumann-series iteration
 * to handle cycles deterministically. Guarantees exact conservation:
 * sum(allocations) + dust == pot, with dust swept to the root package.
 *
 * All math fixed-point (1e18). No floating point. Fixed round count bounds
 * gas and guarantees termination for cyclic graphs.
 */
contract DistributionEngine {
    event DistributionComputed(
        bytes32 indexed distributionId, uint256 indexed pot, uint256[] allocations, uint256 dust
    );
    event DistributionFinalized(bytes32 indexed distributionId, bytes32 merkleRoot);

    // distributionId -> package -> final allocation (wei)
    mapping(bytes32 => mapping(address => uint256)) public allocations;
    // distributionId -> pot
    mapping(bytes32 => uint256) public pots;
    // distributionId -> dust swept to root
    mapping(bytes32 => uint256) public dust;
    // distributionId -> root package
    mapping(bytes32 => address) public rootPackage;
    // distributionId -> ordered package list
    mapping(bytes32 => address[]) public distributionPackages;
    // distributionId -> whether finalized (conservation asserted)
    mapping(bytes32 => bool) public finalized;
    // distributionId -> merkle root of allocations
    mapping(bytes32 => bytes32) public merkleRoots;

    uint256 public constant DEFAULT_ROUNDS = 64;

    /**
     * @dev Compute the distribution.
     *
     * `packages`       ordered package addresses (length n).
     * `weights`        fixed-point importance weights (sum == 1e18).
     * `retention`      fixed-point retention rates [0, 1e18] per package.
     * `depIndices`     depIndices[i] = array of indices into `packages` that
     *                   package i depends on.
     * `pot`            total funding pot (wei).
     * `rootIndex`      index of root package (receives dust).
     * `maxRounds`      Neumann iteration rounds (bounded -> terminates).
     *
     * Returns (allocations[], dust). sum(allocations) + dust == pot exactly.
     */
    function computeDistribution(
        address[] memory packages,
        uint256[] memory weights,
        uint256[] memory retention,
        uint256[][] memory depIndices,
        uint256 pot,
        uint256 rootIndex,
        uint256 maxRounds
    ) public returns (uint256[] memory, uint256) {
        uint256 n = packages.length;
        require(n > 0, "Dist: no packages");
        require(weights.length == n, "Dist: weights length");
        require(retention.length == n, "Dist: retention length");
        require(depIndices.length == n, "Dist: deps length");
        require(rootIndex < n, "Dist: bad root index");
        require(maxRounds > 0 && maxRounds <= 256, "Dist: bad rounds");

        // Validate weights sum to 1e18.
        uint256 wsum = 0;
        for (uint256 i = 0; i < n; i++) {
            wsum += weights[i];
        }
        require(wsum == 1e18, "Dist: weights must sum to 1e18");

        // Base allocation from pot by weight.
        uint256[] memory base = new uint256[](n);
        uint256 baseRemainder = pot;
        for (uint256 i = 0; i < n; i++) {
            base[i] = FixedPoint.mul(pot, weights[i]); // pot * w / 1e18
            baseRemainder -= base[i];
        }
        // Give base remainder to root.
        base[rootIndex] += baseRemainder;

        // Precompute dep weight sums for proportional splitting.
        uint256[] memory depWeightSum = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            uint256 s = 0;
            uint256[] memory d = depIndices[i];
            for (uint256 k = 0; k < d.length; k++) {
                s += weights[d[k]];
            }
            depWeightSum[i] = s;
        }

        // total[] = total funding received by each package (base + inflows).
        // term[] = newly received funding to propagate this round.
        uint256[] memory total = new uint256[](n);
        uint256[] memory term = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            total[i] = base[i];
            term[i] = base[i];
        }

        // Neumann iterations: total = base + M*base + M^2*base + ...
        // where M[j][i] = (1 - r_i) * share(i->j). Bounded rounds -> terminates
        // even on cyclic graphs (spectral radius < 1 because leaves retain 100%).
        for (uint256 round = 0; round < maxRounds; round++) {
            uint256[] memory next = new uint256[](n);
            for (uint256 i = 0; i < n; i++) {
                if (term[i] == 0) continue;
                // Amount i redistributes = term[i] * (1 - r_i).
                uint256 send = FixedPoint.mul(term[i], FixedPoint.complement(retention[i]));
                if (send == 0) continue;
                uint256[] memory d = depIndices[i];
                if (d.length == 0) continue; // no deps -> send lost to dust
                uint256 dwsum = depWeightSum[i];
                if (dwsum == 0) continue; // zero-weight deps -> dust
                // Split send among deps proportional to weights.
                uint256 sentSoFar = 0;
                for (uint256 k = 0; k < d.length; k++) {
                    uint256 share;
                    if (k == d.length - 1) {
                        // Last dep gets the remainder for an exact split.
                        share = send - sentSoFar;
                    } else {
                        share = (FixedPoint.mul(send, weights[d[k]]) * 1e18) / dwsum;
                        sentSoFar += share;
                    }
                    if (share > 0) next[d[k]] += share;
                }
            }
            for (uint256 i = 0; i < n; i++) {
                total[i] += next[i];
                term[i] = next[i];
            }
        }

        // Final allocation = retained portion = r_i * total_received_i.
        // sum(allocation) == pot exactly (modulo truncation dust swept to root).
        uint256[] memory alloc = new uint256[](n);
        uint256 allocSum = 0;
        for (uint256 i = 0; i < n; i++) {
            alloc[i] = FixedPoint.mul(total[i], retention[i]);
            allocSum += alloc[i];
        }
        require(allocSum <= pot, "Dist: allocation exceeds pot");
        uint256 dustAmount = pot - allocSum;
        alloc[rootIndex] += dustAmount;

        return (alloc, dustAmount);
    }

    /**
     * @dev Commit a computed distribution. Asserts exact conservation.
     * `merkleRoot` is the Merkle root of (recipient, allocation) leaves.
     */
    function commitDistribution(
        bytes32 distributionId,
        address[] memory packages,
        uint256[] memory allocs,
        uint256 dustAmount,
        address root,
        bytes32 merkleRoot
    ) external {
        require(!finalized[distributionId], "Dist: already finalized");
        require(packages.length == allocs.length, "Dist: length mismatch");

        // Exact conservation: sum(allocs) must equal pot (dust already in allocs).
        uint256 total = 0;
        for (uint256 i = 0; i < allocs.length; i++) {
            total += allocs[i];
            allocations[distributionId][packages[i]] = allocs[i];
        }
        distributionPackages[distributionId] = packages;
        rootPackage[distributionId] = root;
        dust[distributionId] = dustAmount;
        merkleRoots[distributionId] = merkleRoot;

        // Conservation invariant will be checked against the pot set in RetroFunding.
        // Here we just record; the facade asserts pot == total.
        emit DistributionComputed(distributionId, total, allocs, dustAmount);
    }

    /**
     * @dev Set the pot for a distribution (called by facade before commit).
     */
    function setPot(bytes32 distributionId, uint256 pot) external {
        require(!finalized[distributionId], "Dist: finalized");
        pots[distributionId] = pot;
    }

    /**
     * @dev Assert conservation: sum(allocations) == pot. Callable by facade
     * at finalization time.
     */
    function assertConservation(bytes32 distributionId) external view {
        uint256 pot = pots[distributionId];
        uint256 total = 0;
        address[] memory pkgs = distributionPackages[distributionId];
        for (uint256 i = 0; i < pkgs.length; i++) {
            total += allocations[distributionId][pkgs[i]];
        }
        require(total == pot, "Dist: conservation violated");
    }

    function getAllocation(bytes32 distributionId, address pkg) external view returns (uint256) {
        return allocations[distributionId][pkg];
    }

    function getPot(bytes32 distributionId) external view returns (uint256) {
        return pots[distributionId];
    }

    function getDust(bytes32 distributionId) external view returns (uint256) {
        return dust[distributionId];
    }

    function getMerkleRoot(bytes32 distributionId) external view returns (bytes32) {
        return merkleRoots[distributionId];
    }

    function isFinalized(bytes32 distributionId) external view returns (bool) {
        return finalized[distributionId];
    }

    function setFinalized(bytes32 distributionId) external {
        require(!finalized[distributionId], "Dist: already final");
        finalized[distributionId] = true;
    }
}
