// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FixedPoint
 * @dev Fixed-point arithmetic with 18 decimal precision (1e18 = 1.0).
 * All consensus-critical calculations use integers only. No floating point.
 */
library FixedPoint {
    uint256 internal constant PRECISION = 1e18;

    /**
     * @dev MulDiv: (a * b) / PRECISION with rounding toward zero.
     * Reverts on overflow or division by zero.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0 || b == 0) return 0;
        uint256 c = a * b;
        require(c / b == a, "FixedPoint: mul overflow");
        return c / PRECISION;
    }

    /**
     * @dev MulDivRound: (a * b + PRECISION/2) / PRECISION, rounding to nearest.
     */
    function mulRound(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0 || b == 0) return 0;
        uint256 c = a * b;
        require(c / b == a, "FixedPoint: mul overflow");
        return (c + PRECISION / 2) / PRECISION;
    }

    /**
     * @dev div: a / b with precision scaling: (a * PRECISION) / b.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "FixedPoint: div by zero");
        require(a <= type(uint256).max / PRECISION, "FixedPoint: div overflow");
        return (a * PRECISION) / b;
    }

    /**
     * @dev percent: a * b / 1e18 where b is a fraction in [0, 1e18].
     */
    function percent(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= PRECISION, "FixedPoint: percent > 1");
        return mul(a, b);
    }

    /**
     * @dev complement: PRECISION - b (the portion not retained).
     */
    function complement(uint256 b) internal pure returns (uint256) {
        require(b <= PRECISION, "FixedPoint: complement > 1");
        return PRECISION - b;
    }

    /**
     * @dev requires value within [0, PRECISION].
     */
    function requireFraction(uint256 b) internal pure {
        require(b <= PRECISION, "FixedPoint: not a fraction");
    }
}
