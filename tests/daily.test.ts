import { describe, it, expect } from "vitest";

const cooldownRemaining = (lastClaim: number, now: number) => {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const elapsed = now - lastClaim;
  if (elapsed >= ONE_DAY) return 0;
  return ONE_DAY - elapsed;
};

const shrinkingReward = (days: number) => {
  let val = 100 * Math.pow(0.5, days / 30);
  if (val < 1) val = 1;
  return BigInt(Math.floor(val)) * 1000000000000000000n;
};

describe("daily command logic", () => {
  it("cooldownRemaining() returns correct ms when last claim was 23h ago", () => {
    const now = Date.now();
    const lastClaim = now - 23 * 60 * 60 * 1000;
    expect(cooldownRemaining(lastClaim, now)).toBe(1 * 60 * 60 * 1000);
  });

  it("cooldownRemaining() returns 0 when last claim was 25h ago", () => {
    const now = Date.now();
    const lastClaim = now - 25 * 60 * 60 * 1000;
    expect(cooldownRemaining(lastClaim, now)).toBe(0);
  });

  it("shrinkingReward() returns 100e18 at day 0", () => {
    expect(shrinkingReward(0)).toBe(100000000000000000000n);
  });

  it("shrinkingReward() returns 50e18 at day 30", () => {
    expect(shrinkingReward(30)).toBe(50000000000000000000n);
  });

  it("shrinkingReward() returns 25e18 at day 60", () => {
    expect(shrinkingReward(60)).toBe(25000000000000000000n);
  });

  it("shrinkingReward() never returns 0 (minimum floor of 1e18)", () => {
    expect(shrinkingReward(1000)).toBe(1000000000000000000n);
  });
});
