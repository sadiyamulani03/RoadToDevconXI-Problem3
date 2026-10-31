# Security — Pay the Wells You Drank From

## Trust Assumptions

| Role | Capability | Limitation |
|------|-----------|------------|
| DEFAULT_ADMIN_ROLE (deployer) | Grant/revoke roles | Cannot alter weights, payouts, or Merkle roots directly |
| JUROR_ADMIN (Kavya) | Register/revoke jurors | **Cannot** forge judgments, alter weights, change payouts, or modify Merkle roots |
| DISPUTE_RESOLVER | Adjudicate disputes (valid/invalid) | **Cannot** unilaterally rewrite allocations or replace Merkle root |
| PROPOSER | Propose distributions | Bound by dispute window; cannot finalize early |

## Threat Model

### Kavya manipulates weights or payouts
**Mitigation:** Kavya is JUROR_ADMIN only. Weights derive from EIP-712-signed juror judgments. Allocation Merkle root is committed on-chain and immutable after finalize. Kavya has no write access to weights, allocations, or roots.

### Fake or forged jury judgments
**Mitigation:** EIP-712 typed-data signatures verified via `ecrecover` against the registered juror address. Only registered jurors can submit. Per-juror nonces prevent replay.

### Duplicate judgments
**Mitigation:** `(distributionId, packageA, packageB, juror)` mapping prevents double-submission.

### Reentrancy on claim
**Mitigation:** `nonReentrant` modifier on `claim()`. Claimed state set **before** external call (checks-effects-interactions).

### Double claim
**Mitigation:** `claimed[distributionId][recipient]` flag checked and set before transfer.

### Arbitrary payout by caller
**Mitigation:** Claim amount is bound to the committed Merkle leaf (`recipient + amount + index`). Caller cannot choose an arbitrary amount.

### Cycle infinite loop
**Mitigation:** Distribution uses bounded Neumann iterations (fixed 64 rounds). No recursion. Spectral radius < 1 because leaf packages retain 100%.

### Pot inflation / mismatch
**Mitigation:** `assertConservation()` requires `Σallocations == pot` at finalize. Dust swept to root handles rounding.

### Front-running disputes
**Mitigation:** Bond required (`msg.value == bond`), fixed dispute window.

### Merkle proof replay
**Mitigation:** `claimed` flag prevents double claims. Leaf binds recipient + amount + index.

## Known Limitations

1. **Dispute resolver centralization:** A single DISPUTE_RESOLVER adjudicates disputes. Consider multi-sig or DAO governance post-launch.
2. **JUROR_ADMIN centralization:** Kavya controls juror eligibility. Consider multi-sig for juror registration post-launch.
3. **Bond handling:** Bonds are held as ETH in the contract; slashed bonds remain as protocol funds (not transferred to a treasury in current implementation).
4. **Retention rates:** Set at package registration; immutable thereafter. Consider versioned retention policies.
5. **Off-chain reproducibility:** The TypeScript engine matches Solidity arithmetic but must be re-verified if contracts change.

## Disclosure

Report security issues to the repository maintainers. No bug bounty program currently active.