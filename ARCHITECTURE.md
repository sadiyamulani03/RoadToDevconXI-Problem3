# Architecture — Pay the Wells You Drank From

## Overview

A deterministic, on-chain verifiable retroactive funding protocol. Funding flows through an open-source dependency graph where packages retain a portion and redistribute the rest to dependencies. Jury pairwise judgments determine importance weights; allocations are committed via Merkle root; recipients claim with proofs.

## Components

### DependencyGraph
- Package registration with `packageId = keccak256(metadataURI)`
- Dependency edges with set semantics (duplicates collapsed)
- Graph versioning: `graphVersion` increments on mutation
- `graphHash = keccak256(sorted packages + sorted deduped edges)`
- Cycle detection via bounded DFS (configurable depth limit)

### Jury
- Juror registration by `JUROR_ADMIN` (Kavya)
- EIP-712 `PairwiseJudgment` typed-data signatures
- `ecrecover` verification against registered juror
- Per-juror nonce replay protection
- Duplicate judgment prevention via `(distributionId, packageA, packageB, juror)` mapping
- Judgment count tracking for quorum

### WeightingEngine
- Fixed-point power iteration (principal eigenvector)
- Smoothing: `+1` per cell → positive/primitive matrix → unique principal eigenvector (Perron-Frobenius)
- Fixed 64 iterations, deterministic
- L1 normalization to `1e18` each round
- Residual assigned to max-weight package → weights sum to exactly `1e18`
- `WEIGHTING_VERSION = 1`

### DistributionEngine
- Neumann series: `total = base + M·base + M²·base + ...`
- Bounded 64 rounds → terminates on cyclic graphs
- Base allocation: `pot × weight / 1e18`, remainder to root
- Redistribution: `(1 − retention) × total_received` split to deps by weight
- Final: `allocation = retention × total_received`
- Dust = `pot − Σallocations` swept to root
- **Exact conservation**: `Σallocations == pot` asserted at finalize

### MerkleDistributor
- Leaf: `keccak256(abi.encodePacked(recipient, allocation, index))`
- Binary Merkle tree, sorted by recipient, odd levels duplicate last
- Index-based verification (deterministic left/right)
- Claim: recipient = caller, amount must match leaf, claimed-before-transfer, nonReentrant

### RetroFunding (facade)
- Roles: PROPOSER, JUROR_ADMIN, DISPUTE_RESOLVER, DEFAULT_ADMIN_ROLE
- State machine: PROPOSED → DISPUTED → INVALIDATED → PROPOSED → FINALIZED
- Bonded disputes with evidence hash
- Valid dispute → invalidated (requires re-proposal)
- Invalid dispute → bond slashed, return to PROPOSED
- Finalize requires: PROPOSED state, no open dispute, window closed, conservation asserted

## Data Flow

1. Packages registered + edges added → `graphHash`
2. Jurors submit EIP-712 signed judgments
3. Judgments aggregated into comparison matrix
4. Weights computed (fixed-point power iteration)
5. Distribution computed (Neumann series) + Merkle root
6. Distribution proposed → dispute window → finalize (immutable)
7. Recipients claim with Merkle proofs

## Determinism

All consensus-critical math uses `int256`/`uint256` fixed-point at `1e18` precision. No floating point. Fixed iteration counts. Deterministic sorting. Identical inputs → identical outputs on any re-run.