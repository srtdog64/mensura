import { describe, expect, it } from "vitest";
import {
  bitsToFloat32,
  conversionLossF32,
  epsilonF32At,
  float32ToBits,
  lossF32,
  nearlyEqualAbsRel,
  nearlyEqualUlpsF32,
  nextDownF32,
  nextUpF32,
  ulpDiffF32
} from "../src/core/index.js";

describe("float32 ULP helpers", () => {
  it("treats +0 and -0 as equal", () => {
    expect(ulpDiffF32(0, -0)).toBe(0);
    expect(nearlyEqualUlpsF32(0, -0, 0)).toBe(true);
  });

  it("counts adjacent float32 values as one ULP apart", () => {
    const one = Math.fround(1);
    const next = nextUpF32(one);

    expect(ulpDiffF32(one, next)).toBe(1);
    expect(nearlyEqualUlpsF32(one, next, 1)).toBe(true);
    expect(nearlyEqualUlpsF32(one, next, 0)).toBe(false);
  });

  it("steps downward through adjacent float32 values", () => {
    const one = Math.fround(1);
    const down = nextDownF32(one);

    expect(ulpDiffF32(one, down)).toBe(1);
  });

  it("round-trips raw float32 bits", () => {
    const value = Math.fround(13.5);
    const bits = float32ToBits(value);

    expect(bitsToFloat32(bits)).toBe(value);
  });

  it("does not hide NaN equality", () => {
    expect(ulpDiffF32(Number.NaN, 1)).toBe(Number.POSITIVE_INFINITY);
    expect(nearlyEqualUlpsF32(Number.NaN, Number.NaN)).toBe(false);
  });

  it("reports local epsilon at a float32 value", () => {
    const one = Math.fround(1);
    const next = nextUpF32(one);
    const down = nextDownF32(one);

    expect(epsilonF32At(one)).toBe(Math.min(next - one, one - down));
  });

  it("reports conversion loss when a number is rounded to float32", () => {
    const input = 1 + Number.EPSILON;
    const loss = conversionLossF32(input);

    expect(loss.input).toBe(input);
    expect(loss.rounded).toBe(Math.fround(input));
    expect(loss.exact).toBe(false);
    expect(loss.finite).toBe(true);
    expect(loss.absolute).toBe(Math.abs(input - loss.rounded));
    expect(loss.relative).toBe(loss.absolute / Math.abs(input));
    expect(loss.epsilon).toBe(epsilonF32At(loss.rounded));
    expect(loss.ulps).toBe(loss.absolute / loss.epsilon);
  });

  it("exposes lossF32 as a short loss-function alias", () => {
    expect(lossF32(1 + Number.EPSILON)).toEqual(conversionLossF32(1 + Number.EPSILON));
  });

  it("marks exact float32 conversions as lossless", () => {
    const loss = conversionLossF32(Math.fround(2));

    expect(loss.exact).toBe(true);
    expect(loss.absolute).toBe(0);
    expect(loss.relative).toBe(0);
    expect(loss.ulps).toBe(0);
  });
});

describe("absolute and relative tolerance", () => {
  it("accepts small absolute differences", () => {
    expect(nearlyEqualAbsRel(1, 1.000001, { abs: 0.00001, rel: 0 })).toBe(true);
  });

  it("rejects infinities unless they are exactly equal", () => {
    expect(nearlyEqualAbsRel(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(true);
    expect(nearlyEqualAbsRel(Number.POSITIVE_INFINITY, 1)).toBe(false);
  });
});
