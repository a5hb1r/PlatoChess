import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculatePvpEloChange, isRatedPvpGameType } from "./elo-rating";

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
