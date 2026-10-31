// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, Vm} from "forge-std/Test.sol";

import {DependencyGraph} from "../src/DependencyGraph.sol";
import {Jury} from "../src/Jury.sol";
import {WeightingEngine} from "../src/WeightingEngine.sol";
import {DistributionEngine} from "../src/DistributionEngine.sol";
import {MerkleDistributor} from "../src/MerkleDistributor.sol";
import {RetroFunding} from "../src/RetroFunding.sol";

contract AdditionalTests is Test {
    address admin = address(this);
    address kavya = vm.addr(2);
    address proposer = vm.addr(3);
    address resolver = vm.addr(22);

    address juror1 = vm.addr(11);
    address juror2 = vm.addr(12);
    address disputant = vm.addr(21);
    address zeroAddr = address(0);

    uint256 j1Key = 1001;
    uint256 j2Key = 1002;
    uint256 dKey = 1004;

    address pkgA = vm.addr(101);
    address pkgB = vm.addr(102);
    address pkgC = vm.addr(103);
    address pkgD = vm.addr(104);

    DependencyGraph graph;
    Jury jury;
    WeightingEngine weighting;
    DistributionEngine distribution;
    MerkleDistributor merkle;
    RetroFunding rf;

    bytes32 distId = keccak256("additional-test-dist");

    function setUp() public {
        juror1 = vm.createWallet(j1Key).addr;
        juror2 = vm.createWallet(j2Key).addr;
        disputant = vm.createWallet(dKey).addr;
        vm.deal(disputant, 2 ether);

        graph = new DependencyGraph();
        jury = new Jury(kavya);
        weighting = new WeightingEngine();
        distribution = new DistributionEngine();
        merkle = new MerkleDistributor();
        rf = new RetroFunding(address(graph), address(jury), address(weighting), address(distribution), address(merkle));

        vm.startPrank(admin);
        rf.grantRole(rf.PROPOSER(), proposer);
        rf.grantRole(rf.DISPUTE_RESOLVER(), resolver);
        rf.setJurorAdmin(kavya);
        vm.stopPrank();

        vm.startPrank(kavya);
        jury.registerJuror(juror1);
        jury.registerJuror(juror2);
        vm.stopPrank();

        vm.startPrank(proposer);
        graph.registerPackage(pkgA, keccak256("pkgA"), 5e17);
        graph.registerPackage(pkgB, keccak256("pkgB"), 6e17);
        graph.registerPackage(pkgC, keccak256("pkgC"), 7e17);
        graph.registerPackage(pkgD, keccak256("pkgD"), 1e18); // leaf, 100% retain
        graph.addDependency(pkgA, pkgB);
        graph.addDependency(pkgA, pkgC);
        graph.addDependency(pkgB, pkgD);
        graph.addDependency(pkgC, pkgD); // shared dependency
        vm.stopPrank();
    }

    // ---------- Invalid Merkle proofs ----------
    function testInvalidMerkleProofRejected() public {
        uint256 pot = 100 ether;
        bytes32 did = keccak256("invalid-proof-dist");
        address[] memory pkgs = new address[](2);
        pkgs[0] = pkgA;
        pkgs[1] = pkgB;
        uint256[] memory allocs = new uint256[](2);
        allocs[0] = 60 ether;
        allocs[1] = 40 ether;

        bytes32 root = _merkleRoot(pkgs, allocs);
        vm.startPrank(proposer);
        merkle.commitRoot(did, root, pot);
        merkle.finalizeRoot(did);
        vm.deal(address(merkle), 200 ether);

        // Invalid proof: proof for index 1 used to claim index 0 (wrong leaf binding)
        vm.startPrank(pkgA);
        vm.expectRevert("Merkle: invalid proof");
        rf.claim(did, pkgA, 60 ether, 0, _merkleProof(pkgs, allocs, 1));
    }

    // ---------- Wrong recipient ----------
    function testWrongRecipientRejected() public {
        uint256 pot = 100 ether;
        bytes32 did = keccak256("wrong-recipient-dist");
        address[] memory pkgs = new address[](2);
        pkgs[0] = pkgA;
        pkgs[1] = pkgB;
        uint256[] memory allocs = new uint256[](2);
        allocs[0] = 60 ether;
        allocs[1] = 40 ether;

        bytes32 root = _merkleRoot(pkgs, allocs);
        vm.startPrank(proposer);
        merkle.commitRoot(did, root, pot);
        merkle.finalizeRoot(did);
        vm.deal(address(merkle), 200 ether);

        // Claim pkgB's allocation as pkgA (proof is for index 1, but leaf is pkgA's)
        vm.startPrank(pkgA);
        vm.expectRevert("Merkle: invalid proof");
        rf.claim(did, pkgA, 40 ether, 1, _merkleProof(pkgs, allocs, 1));
    }

    // ---------- Wrong amount ----------
    function testWrongAmountRejected() public {
        uint256 pot = 100 ether;
        bytes32 did = keccak256("wrong-amount-dist");
        address[] memory pkgs = new address[](1);
        pkgs[0] = pkgA;
        uint256[] memory allocs = new uint256[](1);
        allocs[0] = pot;

        bytes32 root = _merkleRoot(pkgs, allocs);
        vm.startPrank(proposer);
        merkle.commitRoot(did, root, pot);
        merkle.finalizeRoot(did);
        vm.deal(address(merkle), 200 ether);

        // Claim wrong amount
        vm.startPrank(pkgA);
        vm.expectRevert("Merkle: invalid proof");
        rf.claim(did, pkgA, 1 wei, 0, _merkleProof(pkgs, allocs, 0));
    }

    // ---------- Double claim ----------
    function testDoubleClaimRejected() public {
        uint256 pot = 100 ether;
        bytes32 did = keccak256("double-claim-dist");
        address[] memory pkgs = new address[](1);
        pkgs[0] = pkgA;
        uint256[] memory allocs = new uint256[](1);
        allocs[0] = pot;

        bytes32 root = _merkleRoot(pkgs, allocs);
        vm.startPrank(proposer);
        merkle.commitRoot(did, root, pot);
        merkle.finalizeRoot(did);
        vm.deal(address(merkle), 200 ether);

        vm.startPrank(pkgA);
        rf.claim(did, pkgA, pot, 0, _merkleProof(pkgs, allocs, 0));
        assertTrue(merkle.isClaimed(did, pkgA));

        vm.startPrank(pkgA);
        vm.expectRevert("Merkle: already claimed");
        rf.claim(did, pkgA, pot, 0, _merkleProof(pkgs, allocs, 0));
    }

    // ---------- Invalid signature ----------
    function testInvalidSignatureRejected() public {
        bytes32 did = keccak256("invalid-sig-dist");
        uint256 nonce = jury.getNonce(juror1);
        vm.startPrank(juror1);
        vm.expectRevert("Jury: invalid signature");
        jury.submitJudgment(did, pkgA, pkgB, 0, uint8(0), bytes32(0), bytes32(0));
    }

    // ---------- Unregistered juror ----------
    function testUnregisteredJurorRejected() public {
        bytes32 did = keccak256("unreg-juror-dist");
        uint256 nonce = jury.getNonce(disputant);
        vm.startPrank(disputant);
        vm.expectRevert("Jury: not a registered juror");
        jury.submitJudgment(did, pkgA, pkgB, 0, uint8(0), bytes32(0), bytes32(0));
    }

    // ---------- Duplicate judgment ----------
    function testDuplicateJudgmentRejected() public {
        bytes32 did = keccak256("duplicate-judgment-dist");
        uint256 nonce = jury.getNonce(juror1);
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "PairwiseJudgment(address juror,bytes32 distributionId,uint256 nonce,address packageA,address packageB,uint8 winner)"
                ),
                juror1,
                did,
                nonce,
                pkgA,
                pkgB,
                0
            )
        );
        bytes32 domain = jury.getDomainSeparator();
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(j1Key, digest);

        vm.startPrank(juror1);
        jury.submitJudgment(did, pkgA, pkgB, 0, v, r, s);

        // Same pair, different nonce -> duplicate
        uint256 nonce2 = jury.getNonce(juror1);
        bytes32 structHash2 = keccak256(
            abi.encode(
                keccak256(
                    "PairwiseJudgment(address juror,bytes32 distributionId,uint256 nonce,address packageA,address packageB,uint8 winner)"
                ),
                juror1,
                did,
                nonce2,
                pkgA,
                pkgB,
                0
            )
        );
        bytes32 digest2 = keccak256(abi.encodePacked("\x19\x01", domain, structHash2));
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(j1Key, digest2);

        vm.expectRevert("Jury: duplicate judgment");
        jury.submitJudgment(did, pkgA, pkgB, 0, v2, r2, s2);
    }

    // ---------- Dispute bypass ----------
    function testDisputeBypassesFinalize() public {
        uint256 pot = 100 ether;
        bytes32 did = keccak256("dispute-bypass-dist");
        vm.startPrank(proposer);
        rf.proposeDistribution(did, pot, 7 days);

        // open dispute
        vm.startPrank(disputant);
        rf.submitDispute{value: 1 ether}(did, 1 ether, keccak256("evidence"));

        // finalize should fail (DISPUTED state)
        vm.startPrank(proposer);
        vm.expectRevert("RF: not in PROPOSED state");
        rf.finalizeDistribution(did);
    }

    // ---------- Invalid finalization ----------
    function testInvalidFinalizationRejected() public {
        uint256 pot = 100 ether;
        bytes32 did = keccak256("invalid-finalize-dist");
        vm.startPrank(proposer);
        rf.proposeDistribution(did, pot, 30 days);

        // finalize before deadline
        vm.startPrank(proposer);
        vm.expectRevert("RF: dispute window not closed");
        rf.finalizeDistribution(did);
    }

    // ---------- Shared dependencies ----------
    function testSharedDependenciesHandled() public {
        // pkgD is a shared dependency of both pkgB and pkgC
        assertTrue(graph.getDependencies(pkgB).length > 0);
        assertTrue(graph.getDependencies(pkgC).length > 0);

        address[] memory bDeps = graph.getDependencies(pkgB);
        address[] memory cDeps = graph.getDependencies(pkgC);
        bool dInB = false;
        bool dInC = false;
        for (uint256 i = 0; i < bDeps.length; i++) {
            if (bDeps[i] == pkgD) dInB = true;
        }
        for (uint256 i = 0; i < cDeps.length; i++) {
            if (cDeps[i] == pkgD) dInC = true;
        }
        assertTrue(dInB, "pkgD should be dependency of pkgB");
        assertTrue(dInC, "pkgD should be dependency of pkgC");
    }

    // ---------- Zero-weight packages ----------
    function testZeroWeightPackages() public {
        address[] memory pkgs = new address[](2);
        pkgs[0] = pkgA;
        pkgs[1] = pkgB;
        uint256[][] memory comp = new uint256[][](2);
        comp[0] = new uint256[](2);
        comp[1] = new uint256[](2);
        comp[0][1] = 0; // no comparisons -> all equal weight after smoothing
        comp[1][0] = 0;

        uint256[] memory weights = weighting.compute(pkgs, comp);
        // With smoothing, both get equal weight
        assertEq(weights[0], weights[1]);
    }

    // ---------- Rounding and dust ----------
    function testRoundingAndDust() public {
        uint256 pot = 1 wei; // tiny pot -> lots of rounding
        address[] memory pkgs = new address[](2);
        pkgs[0] = pkgA;
        pkgs[1] = pkgB;
        uint256[] memory weights = new uint256[](2);
        weights[0] = 1e18;
        weights[1] = 0; // zero weight
        uint256[] memory ret = new uint256[](2);
        ret[0] = 1e18; // 100% retain
        ret[1] = 1e18;
        uint256[][] memory deps = new uint256[][](2);
        deps[0] = new uint256[](0);
        deps[1] = new uint256[](0);

        uint256[] memory allocs;
        uint256 dust;
        (allocs, dust) = distribution.computeDistribution(pkgs, weights, ret, deps, pot, 0, 64);
        // pkgA gets everything (100% weight, 100% retain), pkgB gets 0
        assertEq(allocs[0], pot);
        assertEq(allocs[1], 0);
        assertEq(dust, 0);
        assertEq(allocs[0] + allocs[1] + dust, pot);
    }

    // ---------- Large graph ----------
    function testLargeGraphTerminates() public {
        uint256 n = 100;
        address[] memory pkgs = new address[](n);
        uint256[] memory weights = new uint256[](n);
        uint256[] memory ret = new uint256[](n);
        uint256[][] memory deps = new uint256[][](n);

        // Create a chain: pkg[i] -> pkg[i+1], last is leaf
        for (uint256 i = 0; i < n; i++) {
            pkgs[i] = address(uint160(i));
            weights[i] = i == n - 1 ? 1e18 : 0; // only last has weight
            ret[i] = 1e18; // 100% retain
            if (i < n - 1) {
                deps[i] = new uint256[](1);
                deps[i][0] = i + 1;
            } else {
                deps[i] = new uint256[](0);
            }
        }

        uint256 pot = 1000 ether;
        uint256[] memory allocs;
        uint256 dust;
        (allocs, dust) = distribution.computeDistribution(pkgs, weights, ret, deps, pot, n - 1, 64);
        // Last package gets everything
        assertEq(allocs[n - 1], pot);
        for (uint256 i = 0; i < n - 1; i++) {
            assertEq(allocs[i], 0);
        }
        assertEq(allocs[n - 1] + dust, pot);
    }

    // ---------- Helpers ----------
    function _merkleRoot(address[] memory pkgs, uint256[] memory allocs) internal returns (bytes32) {
        uint256 n = pkgs.length;
        bytes32[] memory leaves = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            leaves[i] = keccak256(abi.encodePacked(pkgs[i], allocs[i], i));
        }
        return _root(leaves);
    }

    function _root(bytes32[] memory leaves) internal returns (bytes32) {
        if (leaves.length == 0) return keccak256("");
        bytes32[] memory level = leaves;
        while (level.length > 1) {
            if (level.length % 2 == 1) {
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
        return _path(leaves, index);
    }

    function _path(bytes32[] memory leaves, uint256 index) internal returns (bytes32[] memory) {
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
            bool isLeft = (idx & 1) == 0;
            uint256 sib = isLeft ? idx + 1 : idx - 1;
            if (sib < level.length) {
                bytes32[] memory np = new bytes32[](proof.length + 1);
                for (uint256 i = 0; i < proof.length; i++) {
                    np[i] = proof[i];
                }
                np[proof.length] = level[sib];
                proof = np;
            }
            bytes32[] memory next = new bytes32[](level.length / 2);
            for (uint256 i = 0; i < next.length; i++) {
                next[i] = keccak256(abi.encodePacked(level[2 * i], level[2 * i + 1]));
            }
            level = next;
            idx >>= 1;
        }
        return proof;
    }
}
