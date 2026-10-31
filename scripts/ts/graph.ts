import { keccak256Hex } from "./keccak.ts";

/**
 * Graph hash matching Solidity GraphLib.hashGraph.
 * Deterministic serialization: packages sorted by address; edges deduplicated
 * and sorted by (depender, dependency).
 */

export interface Package {
  pkg: string;           // address
  packageId: string;     // bytes32 hex
  retentionRate: bigint; // fixed point [0, 1e18]
  active: boolean;
}

export interface Edge {
  depender: string; // address
  dependency: string; // address
}

export function hashGraph(packages: Package[], edges: Edge[]): string {
  if (packages.length === 0) throw new Error("GraphLib: empty graph");

  // Sort packages by address.
  const sortedPkgs = [...packages].sort((a, b) =>
    a.pkg.toLowerCase() < b.pkg.toLowerCase() ? -1 : a.pkg.toLowerCase() > b.pkg.toLowerCase() ? 1 : 0
  );

  // Sort edges by (depender, dependency).
  const sortedEdges = [...edges].sort((a, b) => {
    if (a.depender.toLowerCase() !== b.depender.toLowerCase()) {
      return a.depender.toLowerCase() < b.depender.toLowerCase() ? -1 : 1;
    }
    return a.dependency.toLowerCase() < b.dependency.toLowerCase() ? -1 : 1;
  });

  // Deduplicate edges.
  const uniqueEdges: Edge[] = [];
  for (let i = 0; i < sortedEdges.length; i++) {
    if (
      i > 0 &&
      sortedEdges[i].depender.toLowerCase() === sortedEdges[i - 1].depender.toLowerCase() &&
      sortedEdges[i].dependency.toLowerCase() === sortedEdges[i - 1].dependency.toLowerCase()
    ) {
      continue;
    }
    uniqueEdges.push(sortedEdges[i]);
  }

  // Build hash input: [pkgCount, edgeCount, pkgHashes..., edgeHashes...]
  const parts: string[] = [
    BigInt(sortedPkgs.length).toString(),
    BigInt(uniqueEdges.length).toString(),
  ];
  for (const p of sortedPkgs) {
    parts.push(solidityKeccak256(["address", "bytes32"], [p.pkg, p.packageId]));
  }
  for (const e of uniqueEdges) {
    parts.push(solidityKeccak256(["address", "address"], [e.depender, e.dependency]));
  }

  return keccak256Hex(Buffer.concat(parts.map((p) => Buffer.from(p.replace(/^0x/, ""), "hex"))));
}

function solidityKeccak256(types: string[], values: any[]): string {
  // Minimal ABI encoding for address + bytes32.
  let buf = Buffer.alloc(0);
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const v = values[i];
    if (t === "address") {
      const hex = String(v).replace(/^0x/, "");
      const arr = Buffer.alloc(32);
      for (let j = 0; j < 20; j++) arr[12 + j] = parseInt(hex.substring(j * 2, j * 2 + 2), 16);
      buf = Buffer.concat([buf, arr]);
    } else if (t === "bytes32") {
      const hex = String(v).replace(/^0x/, "");
      const arr = Buffer.alloc(32);
      for (let j = 0; j < 32; j++) arr[j] = parseInt(hex.substring(j * 2, j * 2 + 2), 16);
      buf = Buffer.concat([buf, arr]);
    } else {
      throw new Error(`Unsupported type: ${t}`);
    }
  }
  return keccak256Hex(buf);
}
