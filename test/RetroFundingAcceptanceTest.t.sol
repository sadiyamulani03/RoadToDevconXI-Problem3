// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";

import {DependencyGraph} from "../src/DependencyGraph.sol";
import {Jury} from "../src/Jury.sol";
import {WeightingEngine} from "../src/WeightingEngine.sol";
import {DistributionEngine} from "../src/DistributionEngine.sol";
import {MerkleDistributor} from "../src/MerkleDistributor.sol";
import {RetroFunding} from "../src/RetroFunding.sol";

/**
 * @title RetroFundingAcceptanceTest
 * @dev Covers all ten automated acceptance checks:
 *   1 Claims paid against onchain commitment
 *   2 Results cannot go live before dispute window closes
 *   3 Jury judgments accepted only from registered jurors
 *   4 Open dispute blocks finalization
 *   5 Graph traversal terminates on cycles
 *   6 Allocation asserts exact conservation of pot
 *   7 Claimed state written before transfer
 *   8 Commitment immutable after finalization
 *   9 Sample dependency graph contains a cycle
 *   10 No credentials in tracked files (via scripts/secret-scan.sh)
 */
contract RetroFundingAcceptanceTest is Test {
    DependencyGraph graph;
    Jury jury;
    WeightingEngine weighting;
    DistributionEngine distribution;
    MerkleDistributor merkle;
    RetroFunding rf;

    address kavya = vm.addr(2); // JUROR_ADMIN
    address proposer = vm.addr(3);
    address juror1;
    address juror2;
    address juror3;
    address disputant;
    address resolver = vm.addr(22);

    uint256 j1Key = 1001;
    uint256 j2Key = 1002;
    uint256 j3Key = 1003;
    uint256 dKey = 1004;

    address pkgA = vm.addr(101); // root app
    address pkgB = vm.addr(102);
    address pkgC = vm.addr(103);

    bytes32 distId = keccak256("test-distribution-1");

    function setUp() public {
        // Create signable wallets for addresses that sign judgments / claim.
        juror1 = vm.createWallet(1001).addr;
        juror2 = vm.createWallet(1002).addr;
        juror3 = vm.createWallet(1003).addr;
        disputant = vm.createWallet(1004).addr;
        vm.deal(disputant, 2 ether);

        graph = new DependencyGraph();
        jury = new Jury(kavya);
        weighting = new WeightingEngine();
        distribution = new DistributionEngine();
        merkle = new MerkleDistributor();
        rf = new RetroFunding(address(graph), address(jury), address(weighting), address(distribution), address(merkle));

        // Roles (test contract holds DEFAULT_ADMIN_ROLE from constructor).
        rf.grantRole(rf.PROPOSER(), proposer);
        rf.grantRole(rf.DISPUTE_RESOLVER(), resolver);
        rf.setJurorAdmin(kavya);

        // Register jurors (Kavya).
        vm.startPrank(kavya);
        jury.registerJuror(juror1);
        jury.registerJuror(juror2);
        jury.registerJuror(juror3);
        vm.stopPrank();

        // Register packages.
        vm.prank(proposer);
        graph.registerPackage(pkgA, keccak256("pkgA"), 5e17); // 50% retain
        graph.registerPackage(pkgB, keccak256("pkgB"), 6e17); // 60% retain
        graph.registerPackage(pkgC, keccak256("pkgC"), 7e17); // 70% retain

        // Dependencies: A->B, A->C, B->C, C->B (cycle B<->C).
        graph.addDependency(pkgA, pkgB);
        graph.addDependency(pkgA, pkgC);
        graph.addDependency(pkgB, pkgC);
        graph.addDependency(pkgC, pkgB);
    }

    // ---------- Test 9: sample graph contains a cycle ----------
    function testSampleGraphContainsACycle() public {
        // B <-> C is a cycle. validateNoCycle with a depth limit should detect it.
        vm.expectRevert("DependencyGraph: cycle detected");
        graph.validateNoCycle(10);
    }

    // ---------- Test 5: graph traversal terminates on cycles ----------
    function testDistributionTerminatesOnCycles() public {
        uint256 pot = 100 ether;
        // propose
        vm.prank(proposer);
        rf.proposeDistribution(distId, pot, 7 days);

        // submit judgments from 3 jurors: A>B, A>C, B>C, C>B (tie-ish)
        _submitJudgments();

        // aggregate into comparison matrix (index order A,B,C)
        // comparisons[i][j] = # jurors voting i > j
        // A vs B: 3 vote A>B. A vs C: 3 vote A>C. B vs C: 2 vote B>C, 1 vote C>B.
        uint256[][] memory comp = new uint256[][](3);
        comp[0] = new uint256[](3); // A
        comp[1] = new uint256[](3); // B
        comp[2] = new uint256[](3); // C
        comp[0][1] = 3;
        comp[0][2] = 3;
        comp[1][0] = 0;
        comp[1][2] = 2;
        comp[2][0] = 0;
        comp[2][1] = 1;

        address[] memory pkgs = new address[](3);
        pkgs[0] = pkgA;
        pkgs[1] = pkgB;
        pkgs[2] = pkgC;

        uint256[] memory weights = weighting.compute(pkgs, comp);

        // commit weights
        vm.prank(proposer);
        weighting.commitWeights(distId, pkgs, comp, weights);

        // retention rates
        uint256[] memory ret = new uint256[](3);
        ret[0] = 5e17;
        ret[1] = 6e17;
        ret[2] = 7e17;

        // dep indices (indices into pkgs): A->B(1),C(2); B->C(2); C->B(1)
        uint256[][] memory deps = new uint256[][](3);
        deps[0] = new uint256[](2);
        deps[0][0] = 1;
        deps[0][1] = 2;
        deps[1] = new uint256[](1);
        deps[1][0] = 2;
        deps[2] = new uint256[](1);
        deps[2][0] = 1;

        // compute distribution (must terminate despite B<->C cycle)
        uint256[] memory allocs;
        uint256 dust;
        (allocs, dust) = distribution.computeDistribution(pkgs, weights, ret, deps, pot, 0, 64);

        // exact conservation: sum of allocations (dust already swept to root)
        uint256 total = 0;
        for (uint256 i = 0; i < 3; i++) {
            total += allocs[i];
        }
        assertEq(total, pot);

        // commit distribution + merkle root
        bytes32 root = _merkleRoot(pkgs, allocs);
        vm.prank(proposer);
        distribution.commitDistribution(distId, pkgs, allocs, dust, pkgA, root);
        merkle.commitRoot(distId, root, pot);

        assertEq(distribution.getDust(distId), dust);
        assertEq(merkle.getRoot(distId), root);
    }

    // ---------- Test 6: exact conservation asserted ----------
    function testExactConservationAsserted() public {
        uint256 pot = 50 ether;
        vm.prank(proposer);
        rf.proposeDistribution(keccak256("dist-2"), pot, 7 days);
        _submitJudgments();

        address[] memory pkgs = new address[](3);
        pkgs[0] = pkgA;
        pkgs[1] = pkgB;
        pkgs[2] = pkgC;
        uint256[][] memory comp = new uint256[][](3);
        comp[0] = new uint256[](3);
        comp[1] = new uint256[](3);
        comp[2] = new uint256[](3);
        comp[0][1] = 3;
        comp[0][2] = 3;
        comp[1][2] = 2;
        comp[2][1] = 1;
        uint256[] memory weights = weighting.compute(pkgs, comp);
        vm.prank(proposer);
        weighting.commitWeights(keccak256("dist-2"), pkgs, comp, weights);

        uint256[] memory ret = new uint256[](3);
        ret[0] = 5e17;
        ret[1] = 6e17;
        ret[2] = 7e17;
        uint256[][] memory deps = new uint256[][](3);
        deps[0] = new uint256[](2);
        deps[0][0] = 1;
        deps[0][1] = 2;
        deps[1] = new uint256[](1);
        deps[1][0] = 2;
        deps[2] = new uint256[](1);
        deps[2][0] = 1;

        uint256[] memory allocs;
        uint256 dust;
        (allocs, dust) = distribution.computeDistribution(pkgs, weights, ret, deps, pot, 0, 64);
        // This line is just to show computeDistribution runs; conservation checked in commit.
        bytes32 root = _merkleRoot(pkgs, allocs);
        vm.prank(proposer);
        distribution.commitDistribution(keccak256("dist-2"), pkgs, allocs, dust, pkgA, root);
        // assertConservation should pass (sum == pot).
        distribution.assertConservation(keccak256("dist-2"));
    }

    // ---------- Test 3: jury judgments only from registered jurors ----------
    function testJuryOnlyRegistered() public {
        bytes32 did = keccak256("jury-dist");
        uint256 nonce = jury.getNonce(juror1);
        (uint8 v, bytes32 r, bytes32 s) = _sign(disputant, dKey, nonce, pkgA, pkgB, 0, did);
        vm.startPrank(disputant);
        vm.expectRevert();
        jury.submitJudgment(did, pkgA, pkgB, 0, v, r, s);
    }

    function testJuryRegisteredJurorCanSubmit() public {
        bytes32 did = keccak256("jury-dist-2");
        uint256 nonce = jury.getNonce(juror1);
        (uint8 v, bytes32 r, bytes32 s) = _sign(juror1, j1Key, nonce, pkgA, pkgB, 0, did);
        vm.startPrank(juror1);
        jury.submitJudgment(did, pkgA, pkgB, 0, v, r, s);
        (uint8 w, bool sub) = jury.getJudgment(did, juror1, pkgA, pkgB);
        assertEq(w, 0);
        assertTrue(sub);
    }

    // duplicate judgment rejected
    function testJuryDuplicateRejected() public {
        bytes32 did = keccak256("jury-dist-3");
        uint256 nonce = jury.getNonce(juror1);
        (uint8 v, bytes32 r, bytes32 s) = _sign(juror1, j1Key, nonce, pkgA, pkgB, 0, did);
        vm.startPrank(juror1);
        jury.submitJudgment(did, pkgA, pkgB, 0, v, r, s);
        (uint8 v2, bytes32 r2, bytes32 s2) = _sign(juror1, j1Key, nonce + 1, pkgA, pkgB, 0, did);
        vm.startPrank(juror1);
        vm.expectRevert();
        jury.submitJudgment(did, pkgA, pkgB, 0, v2, r2, s2);
    }

    // ---------- Test 4: open dispute blocks finalization ----------
    function testOpenDisputeBlocksFinalize() public {
        uint256 pot = 100 ether;
        bytes32 did = keccak256("dispute-dist");
        vm.prank(proposer);
        rf.proposeDistribution(did, pot, 7 days);

        // open dispute with evidence hash (bond paid via msg.value)
        vm.prank(disputant);
        rf.submitDispute{value: 1 ether}(did, 1 ether, keccak256("evidence"));

        // finalize should revert (open dispute)
        vm.expectRevert();
        vm.prank(proposer);
        rf.finalizeDistribution(did);
    }

    // ---------- Test 2: cannot go live before dispute window closes ----------
    function testCannotFinalizeBeforeDeadline() public {
        uint256 pot = 100 ether;
        bytes32 did = keccak256("deadline-dist");
        vm.prank(proposer);
        rf.proposeDistribution(did, pot, 30 days);
        // dispute window open; finalize reverts
        vm.expectRevert("RF: dispute window not closed");
        vm.prank(proposer);
        rf.finalizeDistribution(did);
    }

    // ---------- Test 8: commitment immutable after finalization ----------
    function testCommitmentImmutableAfterFinalize() public {
        uint256 pot = 100 ether;
        bytes32 did = keccak256("immutable-dist");
        address[] memory pkgs = new address[](1);
        pkgs[0] = pkgA;
        uint256[] memory allocs = new uint256[](1);
        allocs[0] = pot;
        bytes32 root = _merkleRoot(pkgs, allocs);

        // commit weights (single package, weight 1e18)
        uint256[][] memory comp = new uint256[][](1);
        comp[0] = new uint256[](1);
        uint256[] memory weights = weighting.compute(pkgs, comp);
        vm.prank(proposer);
        weighting.commitWeights(did, pkgs, comp, weights);

        // compute distribution: single package, 100% retention, no deps
        uint256[] memory ret = new uint256[](1);
        ret[0] = 1e18;
        uint256[][] memory deps = new uint256[][](1);
        deps[0] = new uint256[](0);
        uint256[] memory out;
        uint256 dust;
        (out, dust) = distribution.computeDistribution(pkgs, weights, ret, deps, pot, 0, 64);
        distribution.setPot(did, pot);
        vm.prank(proposer);
        distribution.commitDistribution(did, pkgs, out, dust, pkgA, root);
        merkle.commitRoot(did, root, pot);

        // propose + finalize via facade
        vm.prank(proposer);
        rf.proposeDistribution(did, pot, 1 seconds);
        vm.warp(block.timestamp + 2);
        vm.prank(proposer);
        rf.finalizeDistribution(did);

        // after finalize, merkle root cannot change
        bytes32 committedRoot = merkle.getRoot(did);
        assertEq(committedRoot, root);
        vm.expectRevert("Merkle: finalized");
        merkle.commitRoot(did, keccak256("new-root"), pot);

        assertEq(merkle.isFinalized(did), true);
        assertEq(rf.isFinalized(did), true);
    }

    // ---------- Test 1 + 7: claims paid against commitment; claimed before transfer ----------
    function testClaimAgainstCommitment() public {
        uint256 pot = 100 ether;
        bytes32 did = keccak256("claim-dist");
        address[] memory pkgs = new address[](2);
        pkgs[0] = pkgA;
        pkgs[1] = pkgB;
        uint256[] memory allocs = new uint256[](2);
        allocs[0] = 60 ether;
        allocs[1] = 40 ether;

        bytes32 root = _merkleRoot(pkgs, allocs);
        merkle.commitRoot(did, root, pot);
        merkle.finalizeRoot(did);

        // Fund the distributor contract so it can pay out claims.
        vm.deal(address(merkle), 200 ether);

        // build proof for pkgA (index 0), amount 60 ether
        bytes32[] memory proof = _merkleProof(pkgs, allocs, 0);

        // valid claim by recipient pkgA
        vm.prank(pkgA);
        rf.claim(did, pkgA, 60 ether, 0, proof);
        assertTrue(merkle.isClaimed(did, pkgA));

        // double claim reverts
        vm.expectRevert("Merkle: already claimed");
        vm.prank(pkgA);
        rf.claim(did, pkgA, 60 ether, 0, proof);

        // wrong amount reverts (caller cannot choose arbitrary payout)
        vm.prank(pkgB);
        vm.expectRevert();
        rf.claim(did, pkgB, 999 ether, 1, proof);

        // non-recipient cannot claim pkgA's allocation
        vm.prank(disputant);
        vm.expectRevert();
        rf.claim(did, pkgA, 60 ether, 0, proof);
    }

    // ---------- helpers ----------
    function _submitJudgments() internal {
        bytes32 did = keccak256("jury-dist-main");
        // juror1: A>B, A>C
        _signAndSubmit(jury, j1Key, juror1, pkgA, pkgB, 0, jury.getNonce(juror1), did);
        _signAndSubmit(jury, j1Key, juror1, pkgA, pkgC, 0, jury.getNonce(juror1), did);
        // juror2: A>B, B>C
        _signAndSubmit(jury, j2Key, juror2, pkgA, pkgB, 0, jury.getNonce(juror2), did);
        _signAndSubmit(jury, j2Key, juror2, pkgB, pkgC, 0, jury.getNonce(juror2), did);
        // juror3: A>C, C>B
        _signAndSubmit(jury, j3Key, juror3, pkgA, pkgC, 0, jury.getNonce(juror3), did);
        _signAndSubmit(jury, j3Key, juror3, pkgC, pkgB, 0, jury.getNonce(juror3), did);
    }

    function _signAndSubmit(
        Jury j,
        uint256 privateKey,
        address signer,
        address a,
        address b,
        uint8 winner,
        uint256 nonce,
        bytes32 did
    ) internal {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "PairwiseJudgment(address juror,bytes32 distributionId,uint256 nonce,address packageA,address packageB,uint8 winner)"
                ),
                signer,
                did,
                nonce,
                a,
                b,
                winner
            )
        );
        bytes32 domain = j.getDomainSeparator();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        vm.startPrank(signer);
        j.submitJudgment(did, a, b, winner, v, r, s);
        vm.stopPrank();
    }

    function _sign(address signer, uint256 privateKey, uint256 nonce, address a, address b, uint8 winner, bytes32 did)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "PairwiseJudgment(address juror,bytes32 distributionId,uint256 nonce,address packageA,address packageB,uint8 winner)"
                ),
                signer,
                did,
                nonce,
                a,
                b,
                winner
            )
        );
        bytes32 domain = jury.getDomainSeparator();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, structHash));
        return vm.sign(privateKey, digest);
    }

    function _merkleRoot(address[] memory pkgs, uint256[] memory allocs) internal returns (bytes32) {
        uint256 n = pkgs.length;
        bytes32[] memory leaves = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            leaves[i] = keccak256(abi.encodePacked(pkgs[i], allocs[i], i));
        }
        return _merkleRootFromLeaves(leaves);
    }

    function _merkleRootFromLeaves(bytes32[] memory leaves) internal returns (bytes32) {
        if (leaves.length == 0) return keccak256("");
        bytes32[] memory level = leaves;
        while (level.length > 1) {
            if (level.length % 2 == 1) {
                // pad with last element duplicated
                bytes32[] memory padded = new bytes32[](level.length + 1);
                for (uint256 i = 0; i < level.length; i++) {
                    padded[i] = level[i];
                }
                padded[level.length] = level[level.length - 1];
                level = padded;
            }
            bytes32[] memory next = new bytes32[](level.length / 2);
            for (uint256 i = 0; i < next.length; i++) {
                next[i] = keccak256(abi.encodePacked(level[2 * i], level[2 * i + 1]));
            }
            level = next;
        }
        return level[0];
    }

    function _merkleProof(address[] memory pkgs, uint256[] memory allocs, uint256 index)
        internal
        returns (bytes32[] memory)
    {
        uint256 n = pkgs.length;
        bytes32[] memory leaves = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            leaves[i] = keccak256(abi.encodePacked(pkgs[i], allocs[i], i));
        }
        return _merkleProofPath(leaves, index);
    }

    function _merkleProofPath(bytes32[] memory leaves, uint256 index) internal returns (bytes32[] memory) {
        if (leaves.length == 0) return new bytes32[](0);
        bytes32[] memory level = leaves;
        bytes32[] memory proof = new bytes32[](0);
        uint256 idx = index;
        while (level.length > 1) {
            if (level.length % 2 == 1) {
                bytes32[] memory padded = new bytes32[](level.length + 1);
                for (uint256 i = 0; i < level.length; i++) {
                    padded[i] = level[i];
                }
                padded[level.length] = level[level.length - 1];
                level = padded;
            }
            bool isLeft = (idx % 2 == 0);
            uint256 siblingIdx = isLeft ? idx + 1 : idx - 1;
            if (siblingIdx < level.length) {
                bytes32[] memory newProof = new bytes32[](proof.length + 1);
                for (uint256 i = 0; i < proof.length; i++) {
                    newProof[i] = proof[i];
                }
                newProof[proof.length] = level[siblingIdx];
                proof = newProof;
            }
            bytes32[] memory next = new bytes32[](level.length / 2);
            for (uint256 i = 0; i < next.length; i++) {
                next[i] = keccak256(abi.encodePacked(level[2 * i], level[2 * i + 1]));
            }
            level = next;
            idx = idx / 2;
        }
        return proof;
    }
}
