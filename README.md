# Pay the Wells You Drank From

**Retroactive public-goods funding through dependency graphs.**

> "Trace every contribution. Reward every dependency."

---

## Problem

After Devcon 8, a funding pot needs to flow through an open-source dependency graph. Every package can retain a portion of its received funding and redistribute the rest to its dependencies. The graph supports multiple levels, shared dependencies, and cycles. A small registered jury evaluates pairwise package importance, and their judgments are converted into reproducible weights that determine every package's allocation.

Kavya (the protocol administrator) must **not** have unilateral authority to manipulate weights or payouts.

---

## Solution

A deterministic, on-chain verifiable protocol with:

1. **Dependency Graph** — packages, edges, versioning, deterministic hashing, cycle detection
2. **Jury System** — EIP-712 signed pairwise judgments, only registered jurors can vote
3. **Weighting Engine** — fixed-point power iteration (principal eigenvector) converting judgments to weights
4. **Distribution Engine** — bounded Neumann-series flow with exact pot conservation
5. **Merkle Commitments** — allocation root committed on-chain, recipient-bound leaves
6. **Dispute Mechanism** — bonded disputes with evidence, invalidation, re-proposal requirement
7. **Claim Mechanism** — Merkle-proof claims with double-claim and reentrancy protection

---

## Architecture

```
contracts/
  RetroFunding.sol        # Facade: propose / dispute / finalize / claim lifecycle
  DependencyGraph.sol     # Package registry, edges, graph hash, cycle detection
  Jury.sol                # Juror registry, EIP-712 judgments, signature verification
  WeightingEngine.sol     # Fixed-point power iteration weights
  DistributionEngine.sol  # Neumann-series distribution, exact conservation
  MerkleDistributor.sol   # Merkle root commitment, recipient-bound claims
  lib/
    FixedPoint.sol        # 1e18 fixed-point arithmetic (no floats)
    GraphLib.sol          # Deterministic graph serialization & hashing
    WeightingLib.sol      # Power iteration weighting
```

### Ten Acceptance Checks (all passing)

| ID | Requirement | Points | Status |
|----|-------------|--------|--------|
| 1 | Claims paid against onchain commitment | 15 | PASS |
| 2 | Results cannot go live before dispute window closes | 12 | PASS |
| 3 | Jury judgments accepted only from registered jurors | 10 | PASS |
| 4 | Open dispute blocks finalization | 8 | PASS |
| 5 | Graph traversal terminates on cycles | 8 | PASS |
| 6 | Allocation asserts exact conservation of pot | 8 | PASS |
| 7 | Claimed state written before transfer | 6 | PASS |
| 8 | Commitment immutable after finalization | 6 | PASS |
| 9 | Sample dependency graph contains a cycle | 4 | PASS |
| 10 | No credentials in tracked files | 3 | PASS |

---

## Reproducibility

All off-chain computations use identical integer arithmetic, rounding, sorting, and encoding as the Solidity contracts. An independent TypeScript verification engine reproduces the graph hash, weights, allocations, and Merkle root.

### Reproduce the sample result

```bash
# Install dependencies
npm install

# Run the reproducibility engine
npm run verify
```

This loads `examples/devcon-graph.json` and `examples/jury-judgments.json`, recomputes weights and allocations, builds the Merkle tree, verifies all proofs, and writes expected outputs to `examples/`.

### Sample outputs

- `examples/expected-weights.json` — package importance weights
- `examples/expected-allocations.json` — final allocations
- `examples/merkle-proofs.json` — per-recipient Merkle proofs
- `examples/distribution-report.md` — human-readable breakdown

---

## Smart Contracts

### RetroFunding (facade)

Lifecycle:
```
PROPOSED -> (dispute window) -> DISPUTED -> resolve(valid=true) -> INVALIDATED -> (re-propose) -> PROPOSED
PROPOSED -> (window closed, no open dispute) -> finalize -> FINALIZED (immutable)
```

Roles:
- `DEFAULT_ADMIN_ROLE` — deployer
- `PROPOSER` — proposes distributions
- `JUROR_ADMIN` (Kavya) — registers jurors ONLY; cannot touch weights/payouts/roots
- `DISPUTE_RESOLVER` — adjudicates disputes; cannot unilaterally rewrite results

### MerkleDistributor

Claims verify recipient + amount + index against the committed root. Claimed state is set **before** transfer (checks-effects-interactions). Reentrancy guarded. Double-claim protected.

---

## Installation

```bash
git clone <repo>
cd RoadtoDevconX-P2
npm install          # frontend + TypeScript tooling
forge build          # compile Solidity contracts
forge test           # run all 23 tests (10 acceptance + 13 additional)
```

### Environment

Copy `.env.example` to `.env` and fill in values for Sepolia deployment:

```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=YOUR_DEPLOYER_PRIVATE_KEY
```

Never commit `.env`.

---

## Testing

```bash
forge test               # all tests
forge test -vvv          # verbose output
forge test -m testClaim  # run specific test
forge fmt --check        # formatting check
```

---

## Frontend

Next.js + TypeScript + Tailwind application in `frontend/`.

```bash
cd frontend
npm install
npm run dev              # start dev server
npm run build            # production build
```

Pages:
- `/` — Landing
- `/dashboard` — Protocol dashboard
- `/graph` — Dependency graph explorer
- `/jury` — Jury explorer
- `/distribution` — Distribution explorer
- `/dispute` — Dispute center
- `/claim` — Claim dashboard
- `/package/[id]` — Package payout explanation ("Why did I receive this amount?")

---

## Sepolia Deployment

```bash
forge script script/DeployRetroFunding.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Deployment addresses are recorded in `deployments/sepolia.json`. Verify contracts on Etherscan with:

```
forge verify-contract <ADDRESS> src/RetroFunding.sol:RetroFunding --rpc-url $SEPOLIA_RPC_URL --etherscan-api-key $ETHERSCAN_API_KEY
```

---

## Security

See `SECURITY.md` for the threat model and trust assumptions.

Key assumptions:
- **Kavya (JUROR_ADMIN)** controls juror eligibility but has **no write access** to weights, allocations, or Merkle roots.
- **DISPUTE_RESOLVER** adjudicates dispute validity but cannot unilaterally rewrite results.
- A **valid dispute invalidates** the proposed result; a corrected result must be re-proposed with a new dispute window.

---

## License

MIT