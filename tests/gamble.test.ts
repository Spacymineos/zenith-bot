import { describe, it, expect } from "vitest";

function resolveGamble(seed: number) {
  return seed % 2 === 0 ? "win" : "lose";
}

function burnAmount(amount: bigint) {
  return "0x000000000000000000000000000000000000dead";
}

describe("gamble tests", () => {
  it('resolveGamble(seed=0) always returns "win" or "lose" (never throws)', () => {
    expect(["win", "lose"]).toContain(resolveGamble(0));
    expect(["win", "lose"]).toContain(resolveGamble(1));
  });

  it("over 1000 iterations the win rate is between 40% and 60% (fairness check)", () => {
    let wins = 0;
    for (let i = 0; i < 1000; i++) {
      if (resolveGamble(Math.floor(Math.random() * 10000)) === "win") {
        wins++;
      }
    }
    const winRate = wins / 1000;
    expect(winRate).toBeGreaterThanOrEqual(0.4);
    expect(winRate).toBeLessThanOrEqual(0.6);
  });

  it('burnAmount(100n) returns "0x000...dead" as destination', () => {
    expect(burnAmount(100n)).toBe("0x000000000000000000000000000000000000dead");
  });
});
