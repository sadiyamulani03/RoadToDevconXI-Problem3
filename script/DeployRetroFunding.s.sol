// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {DependencyGraph} from "../src/DependencyGraph.sol";
import {Jury} from "../src/Jury.sol";
import {WeightingEngine} from "../src/WeightingEngine.sol";
import {DistributionEngine} from "../src/DistributionEngine.sol";
import {MerkleDistributor} from "../src/MerkleDistributor.sol";
import {RetroFunding} from "../src/RetroFunding.sol";

/**
 * @title DeployRetroFunding
 * @dev Deploys the full RetroFunding protocol in dependency order.
 *
 * Usage:
 *   forge script script/DeployRetroFunding.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast
 */
contract DeployRetroFunding is Script {
    function run() external {
        // 1. DependencyGraph
        DependencyGraph graph = new DependencyGraph();
        emit Log(address(graph));

        // 2. Jury (JUROR_ADMIN must be set separately by deployer)
        Jury jury = new Jury(address(0));
        emit Log(address(jury));

        // 3. WeightingEngine
        WeightingEngine weighting = new WeightingEngine();
        emit Log(address(weighting));

        // 4. DistributionEngine
        DistributionEngine distribution = new DistributionEngine();
        emit Log(address(distribution));

        // 5. MerkleDistributor
        MerkleDistributor merkle = new MerkleDistributor();
        emit Log(address(merkle));

        // 6. RetroFunding facade
        RetroFunding rf =
            new RetroFunding(address(graph), address(jury), address(weighting), address(distribution), address(merkle));
        emit Log(address(rf));

        emit Deployed(
            address(graph), address(jury), address(weighting), address(distribution), address(merkle), address(rf)
        );
    }

    event Log(address indexed a);
    event Deployed(
        address graph, address jury, address weighting, address distribution, address merkle, address retroFunding
    );
}
