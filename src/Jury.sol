// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Jury
 * @dev Manages registered jurors and EIP-712 signed pairwise judgments.
 * Only registered jurors may submit judgments. Signatures are verified via
 * ecrecover against the typed-data hash. Duplicate judgments are rejected.
 * Kavya (JUROR_ADMIN) registers jurors but cannot forge or alter judgments.
 */
contract Jury {
    event JurorRegistered(address indexed juror);
    event JurorRevoked(address indexed juror);
    event JudgmentSubmitted(
        bytes32 indexed distributionId, address indexed juror, address packageA, address packageB, uint8 winner
    );

    // Roles.
    address public immutable JUROR_ADMIN;

    // Registered jurors.
    mapping(address => bool) public isJuror;
    address[] public jurors;
    uint256 public jurorCount;

    // Nonce per juror (replay protection).
    mapping(address => uint256) public nonces;

    // Judgments: distributionId -> packageA -> packageB -> juror -> winner
    // Stored as packed: winner in low bits, a flag bit for "submitted".
    mapping(bytes32 => mapping(address => mapping(address => mapping(address => uint8)))) public judgments;

    // Duplicate prevention: (distributionId, packageA, packageB, juror) -> submitted
    mapping(bytes32 => mapping(address => mapping(address => mapping(address => bool)))) public judgmentSubmitted;

    // Count of judgments per pair per distribution (for quorum).
    mapping(bytes32 => mapping(address => mapping(address => uint256))) public pairJudgmentCount;

    // EIP-712 domain separator.
    bytes32 public constant DOMAIN_TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant JUDGMENT_TYPE_HASH = keccak256(
        "PairwiseJudgment(address juror,bytes32 distributionId,uint256 nonce,address packageA,address packageB,uint8 winner)"
    );

    bytes32 internal domainSeparator;

    constructor(address jurorAdmin) {
        JUROR_ADMIN = jurorAdmin;
        domainSeparator = keccak256(
            abi.encode(DOMAIN_TYPE_HASH, keccak256("RetroFundingJury"), keccak256("1"), block.chainid, address(this))
        );
        // Register the admin as a juror by default? No. Admin is separate role.
    }

    /**
     * @dev Register a juror. Only JUROR_ADMIN.
     */
    function registerJuror(address juror) external {
        require(msg.sender == JUROR_ADMIN, "Jury: only admin");
        require(!isJuror[juror], "Jury: already registered");
        isJuror[juror] = true;
        jurors.push(juror);
        jurorCount++;
        emit JurorRegistered(juror);
    }

    /**
     * @dev Revoke a juror. Only JUROR_ADMIN.
     */
    function revokeJuror(address juror) external {
        require(msg.sender == JUROR_ADMIN, "Jury: only admin");
        require(isJuror[juror], "Jury: not a juror");
        isJuror[juror] = false;
        emit JurorRevoked(juror);
    }

    /**
     * @dev Submit a signed pairwise judgment. Verifies EIP-712 signature.
     * `winner`: 0 = packageA more important, 1 = packageB, 2 = tie.
     */
    function submitJudgment(
        bytes32 distributionId,
        address packageA,
        address packageB,
        uint8 winner,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(isJuror[msg.sender], "Jury: not a registered juror");
        require(winner <= 2, "Jury: invalid winner");
        require(packageA != packageB, "Jury: same package");

        // Use the current nonce for this juror.
        uint256 nonce = nonces[msg.sender];

        bytes32 structHash =
            keccak256(abi.encode(JUDGMENT_TYPE_HASH, msg.sender, distributionId, nonce, packageA, packageB, winner));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        address recovered = ecrecover(digest, v, r, s);
        require(recovered == msg.sender, "Jury: invalid signature");
        require(recovered != address(0), "Jury: invalid signature");

        // Duplicate prevention.
        require(!judgmentSubmitted[distributionId][packageA][packageB][msg.sender], "Jury: duplicate judgment");

        nonces[msg.sender] = nonce + 1;
        judgmentSubmitted[distributionId][packageA][packageB][msg.sender] = true;
        judgments[distributionId][packageA][packageB][msg.sender] = winner;

        pairJudgmentCount[distributionId][packageA][packageB]++;

        emit JudgmentSubmitted(distributionId, msg.sender, packageA, packageB, winner);
    }

    /**
     * @dev Get the judgment a juror gave for a pair (default distribution).
     */
    function getJudgment(bytes32 distributionId, address juror, address packageA, address packageB)
        external
        view
        returns (uint8 winner, bool submitted)
    {
        submitted = judgmentSubmitted[distributionId][packageA][packageB][juror];
        winner = judgments[distributionId][packageA][packageB][juror];
        return (winner, submitted);
    }

    /**
     * @dev Check if an address is a registered juror.
     */
    function isRegisteredJuror(address juror) external view returns (bool) {
        return isJuror[juror];
    }

    /**
     * @dev Get the EIP-712 domain separator.
     */
    function getDomainSeparator() external view returns (bytes32) {
        return domainSeparator;
    }

    /**
     * @dev Get the next nonce for a juror (off-chain signature construction).
     */
    function getNonce(address juror) external view returns (uint256) {
        return nonces[juror];
    }
}
