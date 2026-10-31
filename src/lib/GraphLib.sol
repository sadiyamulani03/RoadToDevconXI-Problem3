// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GraphLib
 * @dev On-chain dependency graph utilities using plain arrays. Deterministic
 * serialization, duplicate-edge collapsing, cycle detection via bounded
 * iterative DFS, and graph hashing.
 */
library GraphLib {
    struct Package {
        address pkg;
        bytes32 packageId;
        uint256 retentionRate;
        bool active;
    }

    struct Edge {
        address depender;
        address dependency;
    }

    /**
     * @dev Deterministic hash: packages sorted by address; edges deduplicated
     * and sorted by (depender, dependency).
     */
    function hashGraph(Package[] memory packages, Edge[] memory edges) internal pure returns (bytes32) {
        require(packages.length > 0, "GraphLib: empty graph");

        Package[] memory sortedPkgs = packages;
        for (uint256 i = 1; i < sortedPkgs.length; i++) {
            Package memory key = sortedPkgs[i];
            uint256 j = i;
            while (j > 0 && sortedPkgs[j - 1].pkg > key.pkg) {
                sortedPkgs[j] = sortedPkgs[j - 1];
                j--;
            }
            sortedPkgs[j] = key;
        }

        Edge[] memory sortedEdges = edges;
        for (uint256 i = 1; i < sortedEdges.length; i++) {
            Edge memory key = sortedEdges[i];
            uint256 j = i;
            while (j > 0) {
                Edge memory prev = sortedEdges[j - 1];
                bool greater =
                    prev.depender > key.depender || (prev.depender == key.depender && prev.dependency > key.dependency);
                if (!greater) break;
                sortedEdges[j] = sortedEdges[j - 1];
                j--;
            }
            sortedEdges[j] = key;
        }

        uint256 uniqueCount = 0;
        for (uint256 i = 0; i < sortedEdges.length; i++) {
            if (
                i > 0 && sortedEdges[i].depender == sortedEdges[i - 1].depender
                    && sortedEdges[i].dependency == sortedEdges[i - 1].dependency
            ) {
                continue;
            }
            sortedEdges[uniqueCount] = sortedEdges[i];
            uniqueCount++;
        }

        bytes32[] memory parts = new bytes32[](2 + sortedPkgs.length + uniqueCount * 2);
        parts[0] = bytes32(uint256(sortedPkgs.length));
        parts[1] = bytes32(uint256(uniqueCount));
        for (uint256 i = 0; i < sortedPkgs.length; i++) {
            parts[2 + i] = keccak256(abi.encode(sortedPkgs[i].pkg, sortedPkgs[i].packageId));
        }
        uint256 base = 2 + sortedPkgs.length;
        for (uint256 i = 0; i < uniqueCount; i++) {
            parts[base + i * 2] = keccak256(abi.encode(sortedEdges[i].depender, sortedEdges[i].dependency));
        }

        return keccak256(abi.encodePacked(parts));
    }

    /**
     * @dev Detect a cycle reachable from `start`. `nodes` = ordered package
     * addresses; `adj[i]` = dependency indices of nodes[i]. `limit` bounds
     * DFS depth. Returns true if a back edge (cycle) exists.
     */
    function hasCycle(address start, address[] memory nodes, uint256[][] memory adj, uint256 limit)
        internal
        pure
        returns (bool)
    {
        if (limit == 0) return false;
        // Linear search for start index.
        uint256 startIdx = type(uint256).max;
        for (uint256 i = 0; i < nodes.length; i++) {
            if (nodes[i] == start) {
                startIdx = i;
                break;
            }
        }
        if (startIdx == type(uint256).max) return false;
        address[] memory path = new address[](0);
        return _dfsCycle(startIdx, nodes, adj, limit, path);
    }

    function _dfsCycle(
        uint256 nodeIdx,
        address[] memory nodes,
        uint256[][] memory adj,
        uint256 limit,
        address[] memory path
    ) internal pure returns (bool) {
        if (limit == 0) return false;
        address node = nodes[nodeIdx];
        for (uint256 i = 0; i < path.length; i++) {
            if (path[i] == node) return true; // back edge
        }
        address[] memory newPath = new address[](path.length + 1);
        for (uint256 i = 0; i < path.length; i++) {
            newPath[i] = path[i];
        }
        newPath[path.length] = node;

        uint256[] memory deps = adj[nodeIdx];
        for (uint256 i = 0; i < deps.length; i++) {
            if (_dfsCycle(deps[i], nodes, adj, limit - 1, newPath)) return true;
        }
        return false;
    }
}
