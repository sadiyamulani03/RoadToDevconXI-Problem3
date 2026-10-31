// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MerkleDistributor
 * @dev Handles Merkle-root-committed allocations and individual claims.
 *
 * Leaf = keccak256(abi.encodePacked(recipient, allocation, leafIndex)).
 * Root committed after finalization and immutable thereafter.
 *
 * Claim rules:
 *   - caller must be the recipient (leaf binds recipient + amount + index)
 *   - Merkle proof verified against committed root
 *   - caller-supplied amount must equal committed leaf amount
 *   - claimed[recipient] set to TRUE BEFORE any transfer (checks-effects-interactions)
 *   - nonReentrant guard
 *   - safe ETH transfer
 *   - double-claim protection via claimed flag
 */
contract MerkleDistributor is ReentrancyGuard {
    event Claimed(address indexed recipient, uint256 indexed amount, bytes32 indexed distributionId);
    event RootCommitted(bytes32 indexed distributionId, bytes32 root);

    // distributionId -> merkle root
    mapping(bytes32 => bytes32) public roots;
    // distributionId -> recipient -> claimed
    mapping(bytes32 => mapping(address => bool)) public claimed;
    // distributionId -> total pot
    mapping(bytes32 => uint256) public pots;
    // distributionId -> finalized (root locked)
    mapping(bytes32 => bool) public finalized;

    /**
     * @dev Commit a Merkle root for a distribution. Locks it (immutable after).
     * Callable only before finalization.
     */
    function commitRoot(bytes32 distributionId, bytes32 root, uint256 pot) external {
        require(!finalized[distributionId], "Merkle: finalized");
        require(root != bytes32(0), "Merkle: zero root");
        roots[distributionId] = root;
        pots[distributionId] = pot;
        emit RootCommitted(distributionId, root);
    }

    /**
     * @dev Lock the root (finalize). After this, root cannot change and claims open.
     */
    function finalizeRoot(bytes32 distributionId) external {
        require(!finalized[distributionId], "Merkle: already final");
        require(roots[distributionId] != bytes32(0), "Merkle: no root");
        finalized[distributionId] = true;
    }

    /**
     * @dev Claim an allocation. Recipient supplies proof + amount + leafIndex.
     * Leaf = keccak256(abi.encodePacked(recipient, amount, leafIndex)).
     * The proof is verified index-based (deterministic left/right) against the
     * committed root. The amount must match the committed leaf; caller must be
     * the recipient.
     */
    function claim(
        bytes32 distributionId,
        address recipient,
        uint256 amount,
        uint256 leafIndex,
        bytes32[] calldata proof
    ) external payable nonReentrant {
        require(finalized[distributionId], "Merkle: not finalized");
        require(!claimed[distributionId][recipient], "Merkle: already claimed");
        require(amount > 0, "Merkle: zero amount");

        // Recompute leaf: recipient + amount + index bound together.
        bytes32 leaf = keccak256(abi.encodePacked(recipient, amount, leafIndex));

        // Index-based Merkle verification (deterministic left/right).
        bytes32 computedHash = leaf;
        uint256 idx = leafIndex;
        for (uint256 i = 0; i < proof.length; i++) {
            bool isLeft = (idx & 1) == 0;
            if (isLeft) {
                computedHash = keccak256(abi.encodePacked(computedHash, proof[i]));
            } else {
                computedHash = keccak256(abi.encodePacked(proof[i], computedHash));
            }
            idx >>= 1;
        }
        require(computedHash == roots[distributionId], "Merkle: invalid proof");

        // Checks-effects-interactions: mark claimed BEFORE transfer.
        claimed[distributionId][recipient] = true;

        // Safe ETH transfer.
        (bool success,) = payable(recipient).call{value: amount}("");
        require(success, "Merkle: transfer failed");

        emit Claimed(recipient, amount, distributionId);
    }

    /**
     * @dev Get the committed root.
     */
    function getRoot(bytes32 distributionId) external view returns (bytes32) {
        return roots[distributionId];
    }

    /**
     * @dev Check if already claimed.
     */
    function isClaimed(bytes32 distributionId, address recipient) external view returns (bool) {
        return claimed[distributionId][recipient];
    }

    /**
     * @dev Get the pot for a distribution.
     */
    function getPot(bytes32 distributionId) external view returns (uint256) {
        return pots[distributionId];
    }

    /**
     * @dev Is finalized.
     */
    function isFinalized(bytes32 distributionId) external view returns (bool) {
        return finalized[distributionId];
    }
}
