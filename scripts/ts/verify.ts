#!/usr/bin/env node
/**
 * Independent reproducibility engine for Pay the Wells You Drank From.
 *
 * Reproduces on-chain results off-chain using identical integer arithmetic,
 * rounding, sorting, and encoding conventions as the Solidity contracts.
 *
 * Usage:
 *   npx ts-node scripts/ts/verify.ts
 *   # or
 *   ts-node scripts/ts/verify.ts
 *
 * Steps:
 *   1. Load sample graph + jury judgments.
 *   2. Recompute graph hash.
 *   3. Build pairwise comparison matrix from judgments.
 *   4. Compute weights (fixed-point power iteration).
 *   5. Compute distribution (Neumann series).
 *   6. Build Merkle tree + proofs.
 *   7. Assert exact pot conservation.
 *   8. Verify each Merkle proof against the root.
 *   9. Write expected outputs to examples/.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { computeWeights } from "./weighting.ts";
import { computeDistribution } from "./distribution.ts";
import { hashGraph } from "./graph.ts";
import type { Edge, Package } from "./graph.ts";
import { buildMerkleTree, getProof, verifyProof, leaf } from "./merkle.ts";
import { PRECISION } from "./fixedpoint.ts";

import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(dirname(__filename), "..", "..");
const ROOT = __dirname;
const EXAMPLES = join(ROOT, "examples");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function bigintToJson(n: bigint): string {
  return n.toString();
}

function jsonToBigint(v: any): bigint {
  return BigInt(v);
}

// ---------------------------------------------------------------------------
// 1. Load sample inputs
// ---------------------------------------------------------------------------
const graphData = readJson<any>(join(EXAMPLES, "devcon-graph.json"));
const judgmentData = readJson<any>(join(EXAMPLES, "jury-judgments.json"));

const packages: string[] = graphData.packages.map((p: any) => p.address);
const packageIds: string[] = graphData.packages.map((p: any) => p.packageId);
const retentions: bigint[] = graphData.packages.map((p: any) => BigInt(p.retentionRate));

// Build edges from graph data.
const edges: Edge[] = [];
const pkgToIndex = new Map<string, number>();
packages.forEach((p, i) => pkgToIndex.set(p, i));

for (const e of graphData.edges) {
  edges.push({ depender: e.from, dependency: e.to });
}

// Build depIndices for distribution.
const depIndices: number[][] = packages.map(() => []);
for (const e of graphData.edges) {
  const di = pkgToIndex.get(e.from);
  const dep = pkgToIndex.get(e.to);
  if (di !== undefined && dep !== undefined) {
    depIndices[di].push(dep);
  }
}

// Build pkg objects for graph hash.
const pkgObjs: Package[] = packages.map((p, i) => ({
  pkg: p,
  packageId: packageIds[i],
  retentionRate: retentions[i],
  active: true,
}));

// ---------------------------------------------------------------------------
// 2. Recompute graph hash
// ---------------------------------------------------------------------------
const graphHash = hashGraph(pkgObjs, edges);
console.log("Graph hash:", graphHash);

// ---------------------------------------------------------------------------
// 3. Build pairwise comparison matrix from judgments
// ---------------------------------------------------------------------------
const n = packages.length;
const comparisons: bigint[][] = Array.from({ length: n }, () => Array(n).fill(0n));

for (const j of judgmentData.judgments) {
  const ai = pkgToIndex.get(j.packageA);
  const bi = pkgToIndex.get(j.packageB);
  if (ai === undefined || bi === undefined) continue;
  const winner = j.winner; // 0 = A, 1 = B, 2 = tie
  if (winner === 0) comparisons[ai][bi] += 1n; // A > B
  else if (winner === 1) comparisons[bi][ai] += 1n; // B > A
  else if (winner === 2) {
    comparisons[ai][bi] += 1n; // tie counts both ways (0.5 each, represented as +1 each side with smoothing)
    comparisons[bi][ai] += 1n;
  }
}

console.log("Comparison matrix:");
for (let i = 0; i < n; i++) {
  console.log(`  ${packages[i]}:`, comparisons[i].map(String));
}

// ---------------------------------------------------------------------------
// 4. Compute weights
// ---------------------------------------------------------------------------
const { weights, iterations } = computeWeights(comparisons);
console.log("\nWeights (fixed-point 1e18):");
let wsum = 0n;
for (let i = 0; i < n; i++) {
  console.log(`  ${packages[i]}: ${weights[i]} (${Number(weights[i]) / Number(PRECISION)})`);
  wsum += weights[i];
}
console.log("Weight sum:", wsum.toString(), "== 1e18:", wsum === PRECISION);

// ---------------------------------------------------------------------------
// 5. Compute distribution
// ---------------------------------------------------------------------------
const pot = BigInt(graphData.pot);
const rootIndex = graphData.rootIndex;

const dist = computeDistribution({
  packages,
  weights,
  retention: retentions,
  depIndices,
  pot,
  rootIndex,
  maxRounds: 64,
});

console.log("\nDistribution:");
let allocSum = 0n;
for (let i = 0; i < n; i++) {
  console.log(
    `  ${packages[i]}: received=${dist.totalReceived[i]} retained=${dist.allocations[i]}`
  );
  allocSum += dist.allocations[i];
}
console.log("Allocation sum:", allocSum.toString());
console.log("Dust:", dist.dust.toString());
console.log("Sum + dust:", (allocSum + dist.dust).toString(), "== pot:", allocSum + dist.dust === pot);

// ---------------------------------------------------------------------------
// 6. Build Merkle tree + proofs
// ---------------------------------------------------------------------------
const sortedIndices = packages
  .map((p, i) => ({ p, i }))
  .sort((a, b) => a.p.toLowerCase() < b.p.toLowerCase() ? -1 : 1)
  .map((x) => x.i);

const sortedRecipients: string[] = [];
const sortedAllocations: bigint[] = [];
for (const idx of sortedIndices) {
  sortedRecipients.push(packages[idx]);
  sortedAllocations.push(dist.allocations[idx]);
}

const merkle = buildMerkleTree(sortedRecipients, sortedAllocations);
console.log("\nMerkle root:", merkle.root);

// Verify all proofs.
let allProofsValid = true;
const proofs: Record<string, { proof: string[]; leafHash: string; index: number }> = {};
for (let i = 0; i < sortedRecipients.length; i++) {
  const { proof, leafHash, root } = getProof(sortedRecipients, sortedAllocations, i);
  const valid = verifyProof(root, leafHash, i, proof);
  if (!valid) allProofsValid = false;
  proofs[sortedRecipients[i]] = { proof, leafHash, index: i };
  console.log(`  Proof ${i} (${sortedRecipients[i]}): valid=${valid}`);
}
console.log("All proofs valid:", allProofsValid);

// ---------------------------------------------------------------------------
// 7. Write expected outputs
// ---------------------------------------------------------------------------
mkdirSync(EXAMPLES, { recursive: true });

const expectedWeights: Record<string, string> = {};
for (let i = 0; i < n; i++) {
  expectedWeights[packages[i]] = weights[i].toString();
}
writeJson(join(EXAMPLES, "expected-weights.json"), {
  distributionId: graphData.distributionId,
  graphHash,
  weights: expectedWeights,
  iterations,
  sum: wsum.toString(),
});

const expectedAllocations: Record<string, any> = {};
for (let i = 0; i < n; i++) {
  expectedAllocations[packages[i]] = {
    allocation: dist.allocations[i].toString(),
    totalReceived: dist.totalReceived[i].toString(),
    retention: retentions[i].toString(),
    retained: dist.allocations[i].toString(),
  };
}
writeJson(join(EXAMPLES, "expected-allocations.json"), {
  distributionId: graphData.distributionId,
  pot: pot.toString(),
  dust: dist.dust.toString(),
  allocations: expectedAllocations,
  conservation: (allocSum + dist.dust).toString(),
  sumEqualsPot: allocSum + dist.dust === pot,
});

const merkleProofs: Record<string, any> = {};
for (const [recipient, info] of Object.entries(proofs)) {
  merkleProofs[recipient] = {
    proof: info.proof,
    leafHash: info.leafHash,
    index: info.index,
    allocation: sortedAllocations[info.index].toString(),
  };
}
writeJson(join(EXAMPLES, "merkle-proofs.json"), {
  distributionId: graphData.distributionId,
  root: merkle.root,
  proofs: merkleProofs,
});

// Distribution report
const report = [
  "# Distribution Report",
  "",
  `Distribution ID: ${graphData.distributionId}`,
  `Funding pot: ${pot} wei (${Number(pot) / Number(PRECISION)} ETH)`,
  `Root package: ${packages[rootIndex]}`,
  `Graph hash: ${graphHash}`,
  `Merkle root: ${merkle.root}`,
  `Neumann iterations: 64`,
  `Weighting iterations: ${iterations}`,
  "",
  "## Package Allocations",
  "",
  "| Package | Weight | Total Received | Retention | Retained | Redistributed | Final Allocation |",
  "|---------|--------|----------------|-----------|----------|---------------|------------------|",
];
for (let i = 0; i < n; i++) {
  const received = dist.totalReceived[i];
  const retained = dist.allocations[i];
  const redistributed = received - retained;
  report.push(
    `| ${packages[i]} | ${weights[i]} | ${received} | ${retentions[i]} | ${retained} | ${redistributed} | ${dist.allocations[i]} |`
  );
}
report.push("");
report.push(`| **Total** | | | | | | **${allocSum}** |`);
report.push(`| **Dust (to root)** | | | | | | **${dist.dust}** |`);
report.push(`| **Grand Total** | | | | | | **${allocSum + dist.dust}** |`);
report.push("");
report.push(`Conservation: ${allocSum + dist.dust === pot ? "PASS" : "FAIL"}`);
report.push(`Merkle proofs valid: ${allProofsValid ? "PASS" : "FAIL"}`);

writeFileSync(join(EXAMPLES, "distribution-report.md"), report.join("\n") + "\n");

console.log("\n=== REPRODUCIBILITY CHECK ===");
console.log("Graph hash:", graphHash);
console.log("Weight sum == 1e18:", wsum === PRECISION);
console.log("Alloc sum + dust == pot:", allocSum + dist.dust === pot);
console.log("All Merkle proofs valid:", allProofsValid);
console.log("\nExpected outputs written to examples/");