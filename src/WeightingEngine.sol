// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {WeightingLib} from "./lib/WeightingLib.sol";

/**
 * @title WeightingEngine
 * @dev Computes and commits deterministic package weights from pairwise
 * judgments. Weights are computed off-chain (reproducible) and committed
 * on-chain; this contract can recompute to verify or resolve disputes.
 */
contract WeightingEngine {
    event WeightsCommitted(bytes32 indexed distributionId, bytes32 indexed weightHash, uint256[] weights);

    // distributionId -> package -> weight (fixed point 1e18)
    mapping(bytes32 => mapping(address => uint256)) public weights;
    // distributionId -> committed weight hash
    mapping(bytes32 => bytes32) public committedWeightHash;
    // distributionId -> whether weights finalized
    mapping(bytes32 => bool) public weightsFinalized;
    // distributionId -> ordered package list
    mapping(bytes32 => address[]) public distributionPackages;
    uint256 public constant WEIGHTING_VERSION = 1;

    /**
     * @dev Compute weights off-chain friendly: returns weights for given
     * packages + comparison matrix. Deterministic.
     */
    function compute(address[] memory packages, uint256[][] memory comparisons) public pure returns (uint256[] memory) {
        return WeightingLib.computeWeights(packages, comparisons);
    }

    /**
     * @dev Commit weights for a distribution. Callable by the RetroFunding
     * facade after jury aggregation. Reverts if already finalized.
     */
    function commitWeights(
        bytes32 distributionId,
        address[] memory packages,
        uint256[][] memory comparisons,
        uint256[] memory weights_
    ) external {
        require(!weightsFinalized[distributionId], "WeightingEngine: finalized");
        require(packages.length == weights_.length, "WeightingEngine: length mismatch");

        // Recompute to verify the submitted weights match the matrix.
        uint256[] memory expected = WeightingLib.computeWeights(packages, comparisons);
        for (uint256 i = 0; i < packages.length; i++) {
            require(expected[i] == weights_[i], "WeightingEngine: weights mismatch");
            weights[distributionId][packages[i]] = weights_[i];
        }

        distributionPackages[distributionId] = packages;

        bytes32 hash = keccak256(abi.encode(distributionId, packages, weights_));
        committedWeightHash[distributionId] = hash;

        emit WeightsCommitted(distributionId, hash, weights_);
    }

    /**
     * @dev Finalize weights (lock). Only via RetroFunding facade.
     */
    function finalizeWeights(bytes32 distributionId) external {
        require(!weightsFinalized[distributionId], "WeightingEngine: already final");
        weightsFinalized[distributionId] = true;
    }

    /**
     * @dev Get weight for a package in a distribution.
     */
    function getWeight(bytes32 distributionId, address pkg) external view returns (uint256) {
        return weights[distributionId][pkg];
    }

    /**
     * @dev Get committed hash.
     */
    function getWeightHash(bytes32 distributionId) external view returns (bytes32) {
        return committedWeightHash[distributionId];
    }

    /**
     * @dev Verify that a candidate weight array matches the committed matrix.
     */
    function verify(
        bytes32 distributionId,
        address[] memory packages,
        uint256[][] memory comparisons,
        uint256[] memory candidateWeights
    ) public view returns (bool) {
        uint256[] memory expected = WeightingLib.computeWeights(packages, comparisons);
        if (expected.length != candidateWeights.length) return false;
        for (uint256 i = 0; i < expected.length; i++) {
            if (expected[i] != candidateWeights[i]) return false;
        }
        return true;
    }
}
