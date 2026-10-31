// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {GraphLib} from "./lib/GraphLib.sol";

/**
 * @title DependencyGraph
 * @dev Manages the dependency graph: package registration, dependency edges,
 * graph versioning, deterministic hashing, and cycle validation.
 *
 * Package identity is an `address`. `packageId = keccak256(metadataURI)`.
 * Edges use set semantics (duplicates collapsed). Graph is versioned; every
 * mutation increments `graphVersion` and recomputes `graphHash`.
 */
contract DependencyGraph {
    event PackageRegistered(address indexed pkg, bytes32 packageId, uint256 retentionRate);
    event DependencyAdded(address indexed depender, address indexed dependency);
    event GraphVersioned(uint256 indexed version, bytes32 graphHash);

    // Packages registered in the graph.
    address[] public packages;
    mapping(address => bool) public isPackage;
    mapping(address => GraphLib.Package) public packageData;
    mapping(address => bytes32) public packageIdOf;

    // Adjacency list: depender -> list of dependencies.
    mapping(address => address[]) public dependencies;

    // Graph state.
    uint256 public graphVersion;
    bytes32 public graphHash;

    // Total packages count.
    uint256 public packageCount;

    /**
     * @dev Register a new package. Only callable by the RetroFunding facade
     * (access control enforced there). Returns false if already registered.
     */
    function registerPackage(address pkg, bytes32 packageId, uint256 retentionRate) external returns (bool) {
        require(!isPackage[pkg], "DependencyGraph: package exists");
        require(retentionRate <= 1e18, "DependencyGraph: invalid retention");

        isPackage[pkg] = true;
        packages.push(pkg);
        packageCount++;

        packageData[pkg] =
            GraphLib.Package({pkg: pkg, packageId: packageId, retentionRate: retentionRate, active: true});
        packageIdOf[pkg] = packageId;
        dependencies[pkg] = new address[](0);

        _recomputeHash();

        emit PackageRegistered(pkg, packageId, retentionRate);
        return true;
    }

    /**
     * @dev Add a dependency edge (depender depends on dependency). Set semantics:
     * duplicate edges are ignored. Both packages must be registered.
     */
    function addDependency(address depender, address dependency) external {
        require(isPackage[depender], "DependencyGraph: depender not registered");
        require(isPackage[dependency], "DependencyGraph: dependency not registered");
        require(depender != dependency, "DependencyGraph: self-dependency");

        address[] memory deps = dependencies[depender];
        for (uint256 i = 0; i < deps.length; i++) {
            if (deps[i] == dependency) return; // duplicate edge, ignore
        }

        dependencies[depender].push(dependency);

        _recomputeHash();
        emit DependencyAdded(depender, dependency);
    }

    /**
     * @dev Validate that the graph has no cycles up to `depthLimit`.
     * Reverts if a cycle is detected. Call with depthLimit = 0 to skip
     * (cycles are allowed in the data model; the distribution engine handles
     * them iteratively).
     */
    function validateNoCycle(uint256 depthLimit) external view {
        if (depthLimit == 0) return;
        address[] memory nodes = packages;
        uint256[][] memory adj = new uint256[][](packages.length);
        for (uint256 i = 0; i < packages.length; i++) {
            address[] memory deps = dependencies[packages[i]];
            uint256[] memory idx = new uint256[](deps.length);
            for (uint256 j = 0; j < deps.length; j++) {
                // Linear find index of dep in nodes.
                uint256 k = 0;
                for (; k < packages.length; k++) {
                    if (packages[k] == deps[j]) {
                        idx[j] = k;
                        break;
                    }
                }
                require(k < packages.length, "DependencyGraph: dep not in nodes");
            }
            adj[i] = idx;
        }
        for (uint256 i = 0; i < packages.length; i++) {
            if (GraphLib.hasCycle(packages[i], nodes, adj, depthLimit)) {
                revert("DependencyGraph: cycle detected");
            }
        }
    }

    /**
     * @dev Get all packages.
     */
    function getPackages() external view returns (address[] memory) {
        return packages;
    }

    /**
     * @dev Get dependencies of a package.
     */
    function getDependencies(address pkg) external view returns (address[] memory) {
        return dependencies[pkg];
    }

    /**
     * @dev Get retention rate of a package.
     */
    function getRetention(address pkg) external view returns (uint256) {
        return packageData[pkg].retentionRate;
    }

    function _recomputeHash() internal {
        GraphLib.Package[] memory pkgs = new GraphLib.Package[](packages.length);
        GraphLib.Edge[] memory edges = new GraphLib.Edge[](0);
        uint256 edgeCount = 0;
        // Count edges.
        for (uint256 i = 0; i < packages.length; i++) {
            edgeCount += dependencies[packages[i]].length;
        }
        edges = new GraphLib.Edge[](edgeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < packages.length; i++) {
            pkgs[i] = packageData[packages[i]];
            address[] memory deps = dependencies[packages[i]];
            for (uint256 j = 0; j < deps.length; j++) {
                edges[idx] = GraphLib.Edge({depender: packages[i], dependency: deps[j]});
                idx++;
            }
        }
        graphHash = GraphLib.hashGraph(pkgs, edges);
        graphVersion++;
    }
}
