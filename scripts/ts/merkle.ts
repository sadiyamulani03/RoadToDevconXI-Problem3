import { keccak256Hex } from "./keccak.ts";

function hashPair(left: string, right: string): string {
  const a = Buffer.from(left.replace(/^0x/, ""), "hex");
  const b = Buffer.from(right.replace(/^0x/, ""), "hex");
  return keccak256Hex(Buffer.concat([a, b]));
}

/**
 * Merkle tree matching Solidity MerkleDistributor.
 * Leaf = keccak256(abi.encodePacked(recipient, allocation, leafIndex)).
 * Tree: leaves sorted by recipient, binary Merkle, odd levels duplicate last leaf.
 * Index-based verification (deterministic left/right).
 */

export function leaf(recipient: string, allocation: bigint, index: number): string {
  return solidityKeccakPacked(recipient, allocation, BigInt(index));
}

export function solidityKeccakPacked(recipient: string, allocation: bigint, index: bigint): string {
  // abi.encodePacked(recipient, allocation, index)
  // recipient is address (20 bytes, left-padded), allocation is uint256 (32 bytes), index is uint256 (32 bytes)
  const recHex = recipient.replace(/^0x/, "");
  const recPadded = recHex.padStart(40, "0"); // 20 bytes = 40 hex chars
  const recBuf = Buffer.from(recPadded, "hex");
  if (recBuf.length !== 20) throw new Error("invalid recipient address");
  const allocBuf = Buffer.alloc(32);
  const allocHex = allocation.toString(16).padStart(64, "0");
  Buffer.from(allocHex, "hex").copy(allocBuf);
  const idxBuf = Buffer.alloc(32);
  const idxHex = index.toString(16).padStart(64, "0");
  Buffer.from(idxHex, "hex").copy(idxBuf);
  return keccak256Hex(Buffer.concat([recBuf, allocBuf, idxBuf]));
}

export function buildMerkleTree(
  recipients: string[],
  allocations: bigint[]
): { root: string; leaves: string[] } {
  const n = recipients.length;
  const leaves: string[] = [];
  for (let i = 0; i < n; i++) {
    leaves.push(leaf(recipients[i], allocations[i], i));
  }

  let level = leaves;
  while (level.length > 1) {
    if (level.length % 2 === 1) {
      level = [...level, level[level.length - 1]]; // duplicate last
    }
    const next: string[] = [];
    for (let i = 0; i < level.length / 2; i++) {
      next.push(hashPair(level[2 * i], level[2 * i + 1]));
    }
    level = next;
  }

  return { root: level[0], leaves };
}

export function getProof(
  recipients: string[],
  allocations: bigint[],
  index: number
): { proof: string[]; root: string; leafHash: string } {
  const { root, leaves } = buildMerkleTree(recipients, allocations);
  const leafHash = leaves[index];
  const proof: string[] = [];
  let level = leaves;
  let idx = index;
  while (level.length > 1) {
    if (level.length % 2 === 1) {
      level = [...level, level[level.length - 1]];
    }
    const isLeft = (idx & 1) === 0;
    const sibIdx = isLeft ? idx + 1 : idx - 1;
    if (sibIdx < level.length) {
      proof.push(level[sibIdx]);
    }
    const next: string[] = [];
    for (let i = 0; i < level.length / 2; i++) {
      next.push(hashPair(level[2 * i], level[2 * i + 1]));
    }
    level = next;
    idx >>= 1;
  }
  return { proof, root, leafHash };
}

export function verifyProof(
  root: string,
  leafHash: string,
  index: number,
  proof: string[]
): boolean {
  let computed = leafHash;
  let idx = index;
  for (const sib of proof) {
    const isLeft = (idx & 1) === 0;
    computed = isLeft ? hashPair(computed, sib) : hashPair(sib, computed);
    idx >>= 1;
  }
  return computed === root;
}
