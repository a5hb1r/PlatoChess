import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculatePvpEloChange,
  constrainEloGain,
  isRatedPvpGameType,
  DIMINISHED_MAX_GAIN,
  ELO_MAX_GAIN_PER_MATCH,
} from "./elo-rating";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { applyPvpRatingUpdate, mergeUpdatedRatingsIntoProfiles } from "./pvp-rating";

describe("elo-rating", () => {
  it("only rates PvP games", () => {
    expect(isRatedPvpGameType("pvp")).toBe(true);
    expect(isRatedPvpGameType("bot")).toBe(false);
    expect(isRatedPvpGameType("engine")).toBe(false);
    expect(isRatedPvpGameType("offline")).toBe(false);
  });

  it("gives exact +/-16 and 0 for equal ratings with K=32", () => {
    expect(calculatePvpEloChange({ whiteRating: 1200, blackRating: 1200, result: "white_win" }))
      .toEqual({ whiteDelta: 16, blackDelta: -16 });
    expect(calculatePvpEloChange({ whiteRating: 1200, blackRating: 1200, result: "black_win" }))
      .toEqual({ whiteDelta: -16, blackDelta: 16 });
    expect(calculatePvpEloChange({ whiteRating: 1200, blackRating: 1200, result: "draw" }))
      .toEqual({ whiteDelta: 0, blackDelta: 0 });
  });

  it("scales deltas by rating difference", () => {
    const upset = calculatePvpEloChange({
      whiteRating: 1200,
      blackRating: 1600,
      result: "white_win",
    });
    const expectedWin = calculatePvpEloChange({
      whiteRating: 1200,
      blackRating: 1600,
      result: "black_win",
    });

    expect(upset.whiteDelta).toBeGreaterThan(16);
    expect(expectedWin.whiteDelta).toBeGreaterThan(-16);
  });
});

describe("constrainEloGain (anti-farming)", () => {
  it("passes losses through unchanged", () => {
    expect(constrainEloGain(800, 1200, -24)).toBe(-24);
  });

  it("caps gains at the global per-match maximum", () => {
    expect(constrainEloGain(800, 1600, 250)).toBe(ELO_MAX_GAIN_PER_MATCH);
  });

  it("applies diminishing returns when far higher-rated (700 vs 400)", () => {
    expect(constrainEloGain(700, 400, 5)).toBe(DIMINISHED_MAX_GAIN);
  });

  it("yields zero against a sub-tier opponent when above the protection tier", () => {
    expect(constrainEloGain(800, 100, 12)).toBe(0);
    expect(constrainEloGain(201, 100, 12)).toBe(0);
  });

  it("keeps standard rules for protected players at or below 200 Elo", () => {
    // 150-rated player beating a 90-rated opponent still earns their full gain.
    expect(constrainEloGain(150, 90, 18)).toBe(18);
    expect(constrainEloGain(200, 90, 18)).toBe(18);
  });
});

describe("calculatePvpEloChange anti-farming integration", () => {
  it("limits a 700 player beating a 400 player to +1 / -1", () => {
    expect(
      calculatePvpEloChange({ whiteRating: 700, blackRating: 400, result: "white_win" })
    ).toEqual({ whiteDelta: DIMINISHED_MAX_GAIN, blackDelta: -DIMINISHED_MAX_GAIN });
  });

  it("awards zero when a player above 200 beats a sub-100 opponent", () => {
    expect(
      calculatePvpEloChange({ whiteRating: 800, blackRating: 90, result: "white_win" })
    ).toEqual({ whiteDelta: 0, blackDelta: 0 });
  });

  it("preserves standard symmetric deltas for evenly matched players", () => {
    expect(
      calculatePvpEloChange({ whiteRating: 1200, blackRating: 1200, result: "white_win" })
    ).toEqual({ whiteDelta: 16, blackDelta: -16 });
  });
});

describe("applyPvpRatingUpdate", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("bypasses rating updates for non-PvP game types", async () => {
    const result = await applyPvpRatingUpdate({
      matchId: "match-1",
      gameType: "engine",
      whiteUserId: "white-user",
      blackUserId: "black-user",
      result: "white_win",
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("non_pvp_game");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("executes one RPC call and maps the response", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          applied: true,
          reason: "applied",
          white_user_id: "white-user",
          black_user_id: "black-user",
          white_rating_before: 1000,
          black_rating_before: 1000,
          white_rating_after: 1016,
          black_rating_after: 984,
          white_delta: 16,
          black_delta: -16,
        },
      ],
      error: null,
    });

    const result = await applyPvpRatingUpdate({
      matchId: "match-2",
      gameType: "pvp",
      whiteUserId: "white-user",
      blackUserId: "black-user",
      result: "white_win",
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      applied: true,
      whiteRatingAfter: 1016,
      blackRatingAfter: 984,
      whiteDelta: 16,
      blackDelta: -16,
    });
  });
});

describe("mergeUpdatedRatingsIntoProfiles", () => {
  it("updates player ratings and games played in local state", () => {
    const updated = mergeUpdatedRatingsIntoProfiles(
      [
        { user_id: "white", rating: 1000, games_played: 5 },
        { user_id: "black", rating: 1000, games_played: 7 },
      ],
      {
        applied: true,
        reason: "applied",
        whiteUserId: "white",
        blackUserId: "black",
        whiteRatingBefore: 1000,
        blackRatingBefore: 1000,
        whiteRatingAfter: 1016,
        blackRatingAfter: 984,
        whiteDelta: 16,
        blackDelta: -16,
      }
    );

    expect(updated).toEqual([
      { user_id: "white", rating: 1016, games_played: 6 },
      { user_id: "black", rating: 984, games_played: 8 },
    ]);
  });
});
