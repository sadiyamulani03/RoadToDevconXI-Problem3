// Pure-JS keccak256 implementation (no external dependencies).
// Matches Ethereum's keccak256 (SHA-3 variant with c=1088, r=1600-1088=512? No: keccak[r=1360, c=240]).
// Output: 32-byte hex string with 0x prefix.

const KECCAK_ROUNDS = 24;

// Rotation constants for keccak-f[1600].
const ROT = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

// Round constants (keccak-f[1600]).
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
  0x8000000000008080n, 0x000000000000800bn, 0x0000000000008081n,
  0x8000000000008009n, 0x000000000000008an, 0x0000000000000088n,
  0x0000000000008009n, 0x00000000000080a3n, 0x80000000000080bfn,
  0x800000000000800bn, 0x000000000000800bn, 0x000000000000800bn,
  0x000000000000800bn, 0x000000000000800bn, 0x800000000000800bn,
  0x8000000000008000n, 0x8000000000008000n, 0x8000000000008000n,
  0x8000000000008000n, 0x8000000000008000n, 0x8000000000008000n,
];

function rotl64(x: bigint, n: number): bigint {
  return (x << BigInt(n)) | (x >> (BigInt(64) - BigInt(n)));
}

function keccakf1600(state: bigint[]): void {
  for (let round = 0; round < KECCAK_ROUNDS; round++) {
    // Theta
    const c = [
      state[0] ^ state[5] ^ state[10] ^ state[15] ^ state[20],
      state[1] ^ state[6] ^ state[11] ^ state[16] ^ state[21],
      state[2] ^ state[7] ^ state[12] ^ state[17] ^ state[22],
      state[3] ^ state[8] ^ state[13] ^ state[18] ^ state[23],
      state[4] ^ state[9] ^ state[14] ^ state[19] ^ state[24],
    ];
    const d = [
      c[4] ^ rotl64(c[1], 1),
      c[0] ^ rotl64(c[2], 1),
      c[1] ^ rotl64(c[3], 1),
      c[2] ^ rotl64(c[4], 1),
      c[3] ^ rotl64(c[0], 1),
    ];
    for (let i = 0; i < 25; i++) state[i] ^= d[i % 5];

    // Rho and Pi
    let x = 1, y = 0;
    let current = state[1];
    for (let t = 0; t < 24; t++) {
      const [xnew, ynew] = [y, (2 * x + 3 * y) % 5];
      const rot = ROT[x][y];
      const tmp = state[5 * xnew + ynew];
      state[5 * xnew + ynew] = rotl64(current, rot);
      current = tmp;
      x = xnew;
      y = ynew;
    }

    // Chi
    for (let i = 0; i < 5; i++) {
      const row = [state[5 * i], state[5 * i + 1], state[5 * i + 2], state[5 * i + 3], state[5 * i + 4]];
      for (let j = 0; j < 5; j++) {
        state[5 * i + j] = row[j] ^ (~row[(j + 1) % 5] & row[(j + 2) % 5]);
      }
    }

    // Iota
    state[0] ^= RC[round];
  }
}

function keccak256(data: Uint8Array): Uint8Array {
  const rate = 136; // bytes (1088 bits)
  const paddedLen = Math.ceil((data.length + 1) / rate) * rate;
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[data.length] = 0x01;
  padded[paddedLen - 1] |= 0x80;

  const state = new Array(25).fill(0n);
  const wordsPerBlock = rate / 8; // 17 uint64s per rate block

  for (let blockStart = 0; blockStart < paddedLen; blockStart += rate) {
    for (let j = 0; j < wordsPerBlock; j++) {
      let word = 0n;
      const base = blockStart + j * 8;
      for (let k = 0; k < 8; k++) {
        if (base + k < paddedLen) {
          word |= BigInt(padded[base + k]) << BigInt(8 * k);
        }
      }
      state[j] ^= word;
    }
    keccakf1600(state);
  }

  const out = new Uint8Array(32);
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  for (let i = 0; i < 4; i++) {
    dv.setBigUint64(i * 8, state[i], true);
  }
  return out;
}

export function keccak256Hex(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = keccak256(bytes);
  let hex = "0x";
  for (const b of hash) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export function keccak256Bytes(data: Uint8Array): Uint8Array {
  return keccak256(data);
}

export function solidityKeccak256(types: string[], values: any[]): string {
  // Minimal ABI encoding for uint256, address, bytes32, bytes.
  const parts: Uint8Array[] = [];
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const v = values[i];
    if (t === "uint256") {
      const n = BigInt(v);
      const arr = new Uint8Array(32);
      for (let j = 0; j < 32; j++) arr[31 - j] = Number((n >> BigInt(8 * j)) & 0xffn);
      parts.push(arr);
    } else if (t === "address") {
      const hex = String(v).replace(/^0x/, "");
      const arr = new Uint8Array(32);
      for (let j = 0; j < 20; j++) arr[12 + j] = parseInt(hex.substring(j * 2, j * 2 + 2), 16);
      parts.push(arr);
    } else if (t === "bytes32") {
      const hex = String(v).replace(/^0x/, "");
      const arr = new Uint8Array(32);
      for (let j = 0; j < 32; j++) arr[j] = parseInt(hex.substring(j * 2, j * 2 + 2), 16);
      parts.push(arr);
    } else if (t === "bytes") {
      const arr = typeof v === "string" ? new TextEncoder().encode(v) : v;
      parts.push(arr);
    } else if (t === "uint8") {
      const arr = new Uint8Array(32);
      arr[31] = Number(v);
      parts.push(arr);
    } else {
      throw new Error(`Unsupported type: ${t}`);
    }
  }
  const total = parts.reduce((a, b) => a + b.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { buf.set(p, off); off += p.length; }
  return keccak256Hex(buf);
}
