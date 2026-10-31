// Fixed-point arithmetic matching Solidity (1e18 precision), using BigInt.
// All divisions truncate toward zero (Solidity behavior).

const PRECISION = 1000000000000000000n; // 1e18

export function mul(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const c = a * b;
  // Overflow check (Solidity require): c / b == a
  if (c / b !== a) throw new Error("FixedPoint: mul overflow");
  return c / PRECISION;
}

export function mulRound(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const c = a * b;
  if (c / b !== a) throw new Error("FixedPoint: mul overflow");
  return (c + PRECISION / 2n) / PRECISION;
}

export function div(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error("FixedPoint: div by zero");
  if (a > (2n ** 256n - 1n) / PRECISION) throw new Error("FixedPoint: div overflow");
  return (a * PRECISION) / b;
}

export function percent(a: bigint, b: bigint): bigint {
  if (b > PRECISION) throw new Error("FixedPoint: percent > 1");
  return mul(a, b);
}

export function complement(b: bigint): bigint {
  if (b > PRECISION) throw new Error("FixedPoint: complement > 1");
  return PRECISION - b;
}

export function requireFraction(b: bigint): void {
  if (b > PRECISION) throw new Error("FixedPoint: not a fraction");
}

export { PRECISION };
