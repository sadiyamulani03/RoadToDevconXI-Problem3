// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {DependencyGraph} from "./DependencyGraph.sol";
import {Jury} from "./Jury.sol";
import {WeightingEngine} from "./WeightingEngine.sol";
import {DistributionEngine} from "./DistributionEngine.sol";
import {MerkleDistributor} from "./MerkleDistributor.sol";

/**
 * @title RetroFunding
 * @dev Facade orchestrating the full retroactive funding lifecycle:
 *
 *   PROPOSED -> (dispute window open) -> DISPUTED -> resolve(valid=false) -> PROPOSED
 *   DISPUTED -> resolve(valid=true) -> INVALIDATED -> (re-propose) -> PROPOSED
 *   PROPOSED -> (window closed, no open dispute) -> finalize -> FINALIZED (immutable)
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE - deployer
 *   PROPOSER - proposes distributions
 *   JUROR_ADMIN (Kavya) - registers jurors ONLY; cannot touch weights/payouts/roots
 *   DISPUTE_RESOLVER - adjudicates disputes (cannot unilaterally rewrite results)
 *
 * Trust assumptions:
 *   - JUROR_ADMIN (Kavya) controls juror eligibility but has no write access to
 *     weights, allocations, Merkle roots, or payouts.
 *   - DISPUTE_RESOLVER adjudicates dispute validity based on submitted evidence
 *     but cannot replace the Merkle root with arbitrary allocations.
 *   - A valid dispute invalidates the proposed result; a corrected result must
 *     go through a brand-new proposal and dispute window.
 */
contract RetroFunding is AccessControl {
    bytes32 public constant PROPOSER = keccak256("PROPOSER");
    bytes32 public constant JUROR_ADMIN = keccak256("JUROR_ADMIN");
    bytes32 public constant DISPUTE_RESOLVER = keccak256("DISPUTE_RESOLVER");

    enum DistributionStatus {
        PROPOSED,
        DISPUTED,
        INVALIDATED,
        FINALIZED
    }

    mapping(bytes32 => DistributionStatus) public status;
    mapping(bytes32 => uint256) public proposalTimestamp;
    mapping(bytes32 => uint256) public disputeDeadline;
    mapping(bytes32 => uint256) public pot;
    mapping(bytes32 => bool) public disputeOpen;
    mapping(bytes32 => uint256) public disputeBond;
    mapping(bytes32 => address) public disputeBondOwner;
    mapping(bytes32 => bytes32) public disputeEvidenceHash;
    mapping(bytes32 => address) public distributionCreator;

    // Component contracts.
    DependencyGraph public graph;
    Jury public jury;
    WeightingEngine public weighting;
    DistributionEngine public distribution;
    MerkleDistributor public merkle;

    event DistributionProposed(bytes32 indexed distributionId, uint256 indexed pot, uint256 deadline);
    event DisputeSubmitted(
        bytes32 indexed distributionId, address indexed disputant, uint256 indexed bond, bytes32 evidenceHash
    );
    event DisputeResolved(bytes32 indexed distributionId, bool indexed valid);
    event DistributionInvalidated(bytes32 indexed distributionId);
    event DistributionFinalized(bytes32 indexed distributionId);
    event BondReturned(bytes32 indexed distributionId, address indexed to, uint256 amount);
    event BondSlashed(bytes32 indexed distributionId, address indexed from, uint256 amount);

    constructor(address _graph, address _jury, address _weighting, address _distribution, address _merkle) {
        graph = DependencyGraph(_graph);
        jury = Jury(_jury);
        weighting = WeightingEngine(_weighting);
        distribution = DistributionEngine(_distribution);
        merkle = MerkleDistributor(_merkle);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PROPOSER, msg.sender);
        _grantRole(DISPUTE_RESOLVER, msg.sender);
    }

    /**
     * @dev Set JUROR_ADMIN (Kavya). Only admin.
     * JUROR_ADMIN can register jurors but CANNOT alter weights, payouts, or roots.
     */
    function setJurorAdmin(address jurorAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(JUROR_ADMIN, jurorAdmin);
    }

    /**
     * @dev Propose a new distribution. Allowed from PROPOSED (re-propose after
     * invalidation) or from scratch. Reverts if already FINALIZED.
     */
    function proposeDistribution(bytes32 distributionId, uint256 _pot, uint256 disputeDuration)
        external
        onlyRole(PROPOSER)
    {
        require(status[distributionId] != DistributionStatus.FINALIZED, "RF: finalized");
        require(_pot > 0, "RF: pot must be > 0");
        require(disputeDuration > 0, "RF: duration must be > 0");

        status[distributionId] = DistributionStatus.PROPOSED;
        pot[distributionId] = _pot;
        proposalTimestamp[distributionId] = block.timestamp;
        disputeDeadline[distributionId] = block.timestamp + disputeDuration;
        disputeOpen[distributionId] = false;
        distributionCreator[distributionId] = msg.sender;

        distribution.setPot(distributionId, _pot);

        emit DistributionProposed(distributionId, _pot, disputeDeadline[distributionId]);
    }

    /**
     * @dev Submit a dispute during the dispute window.
     * Requires a non-zero bond (paid in ETH) and an evidence hash.
     * Bond is held by the contract and returned or slashed on resolution.
     */
    function submitDispute(bytes32 distributionId, uint256 _bond, bytes32 _evidenceHash) external payable {
        require(status[distributionId] == DistributionStatus.PROPOSED, "RF: not disputable");
        require(block.timestamp < disputeDeadline[distributionId], "RF: window closed");
        require(_bond > 0, "RF: bond required");
        require(msg.value == _bond, "RF: bond must equal msg.value");
        require(_evidenceHash != bytes32(0), "RF: evidence hash required");

        disputeOpen[distributionId] = true;
        disputeBond[distributionId] = _bond;
        disputeBondOwner[distributionId] = msg.sender;
        disputeEvidenceHash[distributionId] = _evidenceHash;
        status[distributionId] = DistributionStatus.DISPUTED;

        emit DisputeSubmitted(distributionId, msg.sender, _bond, _evidenceHash);
    }

    /**
     * @dev Resolve a dispute. Only DISPUTE_RESOLVER.
     *
     * valid = true: dispute upheld. The proposed result is INVALIDATED.
     *   - Bond returned to disputant.
     *   - Distribution must be re-proposed with corrected inputs before it can
     *     be finalized.
     *   - Resolver CANNOT rewrite the Merkle root or allocations.
     *
     * valid = false: dispute rejected. Bond slashed. Returns to PROPOSED.
     */
    function resolveDispute(bytes32 distributionId, bool valid) external onlyRole(DISPUTE_RESOLVER) {
        require(status[distributionId] == DistributionStatus.DISPUTED, "RF: not disputed");

        uint256 bond = disputeBond[distributionId];
        address bondOwner = disputeBondOwner[distributionId];

        if (valid) {
            // Dispute upheld: invalidate the proposed result.
            status[distributionId] = DistributionStatus.INVALIDATED;
            disputeOpen[distributionId] = false;

            // Return bond to disputant.
            if (bond > 0) {
                (bool sent,) = payable(bondOwner).call{value: bond}("");
                require(sent, "RF: bond return failed");
            }

            emit DisputeResolved(distributionId, true);
            emit DistributionInvalidated(distributionId);
            emit BondReturned(distributionId, bondOwner, bond);
        } else {
            // Dispute rejected: slash bond, return to PROPOSED.
            disputeOpen[distributionId] = false;
            status[distributionId] = DistributionStatus.PROPOSED;

            // Bond is slashed (retained by contract / treasury). Here we simply
            // do not return it; it remains as protocol funds.
            emit DisputeResolved(distributionId, false);
            emit BondSlashed(distributionId, bondOwner, bond);
        }
    }

    /**
     * @dev Finalize the distribution. Only after dispute deadline and no open
     * dispute. Locks the Merkle root (immutable). Enables claims.
     */
    function finalizeDistribution(bytes32 distributionId) external {
        require(status[distributionId] == DistributionStatus.PROPOSED, "RF: not in PROPOSED state");
        require(!disputeOpen[distributionId], "RF: open dispute blocks finalize");
        require(block.timestamp >= disputeDeadline[distributionId], "RF: dispute window not closed");

        // Assert exact conservation of pot.
        distribution.assertConservation(distributionId);

        // Finalize weights + distribution + merkle root (immutable).
        weighting.finalizeWeights(distributionId);
        distribution.setFinalized(distributionId);
        merkle.finalizeRoot(distributionId);

        status[distributionId] = DistributionStatus.FINALIZED;

        emit DistributionFinalized(distributionId);
    }

    /**
     * @dev Claim an allocation. Delegates to MerkleDistributor.
     */
    function claim(
        bytes32 distributionId,
        address recipient,
        uint256 amount,
        uint256 leafIndex,
        bytes32[] calldata proof
    ) external payable {
        merkle.claim(distributionId, recipient, amount, leafIndex, proof);
    }

    /**
     * @dev Read-only helpers.
     */
    function getStatus(bytes32 distributionId) external view returns (DistributionStatus) {
        return status[distributionId];
    }

    function getPot(bytes32 distributionId) external view returns (uint256) {
        return pot[distributionId];
    }

    function isDisputeOpen(bytes32 distributionId) external view returns (bool) {
        return disputeOpen[distributionId];
    }

    function getDisputeDeadline(bytes32 distributionId) external view returns (uint256) {
        return disputeDeadline[distributionId];
    }

    function isFinalized(bytes32 distributionId) external view returns (bool) {
        return status[distributionId] == DistributionStatus.FINALIZED;
    }

    function getDisputeEvidence(bytes32 distributionId) external view returns (bytes32) {
        return disputeEvidenceHash[distributionId];
    }

    function getBondOwner(bytes32 distributionId) external view returns (address) {
        return disputeBondOwner[distributionId];
    }
}
