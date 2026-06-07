/**
 * PlatoChess bot catalog.
 * Each bot maps to a Stockfish skill level + depth and belongs to a subscription tier.
 */

export type BotTier = "free" | "pro" | "master";

export interface Bot {
  id: string;
  name: string;
  title: string;
  emoji: string;
  rating: number;
  ratingLabel: string;
  personality: string;
  quote: string;
  tier: BotTier;
  /** Stockfish skill level 0-20 */
  skill: number;
  /** Stockfish search depth */
  depth: number;
  /** URL param index — matches Game.tsx DIFFICULTY_LEVELS index */
  levelIndex: number;
}

export const BOTS: Bot[] = [
  {
    id: "chiron",
    name: "Chiron",
    title: "The Patient Teacher",
    emoji: "🌿",
    rating: 300,
    ratingLabel: "~300",
    personality: "Kind and forgiving. Makes lots of mistakes so you can learn from them.",
    quote: "Every master was once a beginner.",
    tier: "free",
    skill: 0,
    depth: 2,
    levelIndex: 0,
  },
  {
    id: "socrates",
    name: "Socrates",
    title: "The Questioner",
    emoji: "🗣️",
    rating: 600,
    ratingLabel: "~600",
    personality: "Plays slowly and defensively. Loves to question every move.",
    quote: "I know that I know nothing… about tactics.",
    tier: "free",
    skill: 2,
    depth: 3,
    levelIndex: 1,
  },
  {
    id: "aristotle",
    name: "Aristotle",
    title: "The Methodologist",
    emoji: "📚",
    rating: 900,
    ratingLabel: "~900",
    personality: "Systematic and structured. Plays by the rules of logic.",
    quote: "We are what we repeatedly play.",
    tier: "free",
    skill: 4,
    depth: 5,
    levelIndex: 2,
  },
  {
    id: "pythagoras",
    name: "Pythagoras",
    title: "The Pattern Master",
    emoji: "🔢",
    rating: 1150,
    ratingLabel: "~1150",
    personality: "Finds geometric patterns in pawn structures. Loves diagonal attacks.",
    quote: "Numbers rule the chess board.",
    tier: "pro",
    skill: 6,
    depth: 7,
    levelIndex: 3,
  },
  {
    id: "archimedes",
    name: "Archimedes",
    title: "The Tactician",
    emoji: "⚡",
    rating: 1400,
    ratingLabel: "~1400",
    personality: "Creative and explosive. Will sacrifice material for a brilliant attack.",
    quote: "Give me a lever long enough and I'll checkmate the king.",
    tier: "pro",
    skill: 8,
    depth: 8,
    levelIndex: 3,
  },
  {
    id: "euclid",
    name: "Euclid",
    title: "The Positional Player",
    emoji: "📐",
    rating: 1650,
    ratingLabel: "~1650",
    personality: "Precise and principled. Outplays you slowly with perfect piece placement.",
    quote: "The shortest path to victory is a straight pawn chain.",
    tier: "pro",
    skill: 11,
    depth: 10,
    levelIndex: 4,
  },
  {
    id: "hypatia",
    name: "Hypatia",
    title: "The Endgame Wizard",
    emoji: "🌟",
    rating: 1850,
    ratingLabel: "~1850",
    personality: "Brilliant endgame specialist. She'll slowly grind you down to a loss.",
    quote: "Reserve your strength — the endgame belongs to me.",
    tier: "master",
    skill: 14,
    depth: 12,
    levelIndex: 5,
  },
  {
    id: "plato",
    name: "Plato",
    title: "The Supreme Thinker",
    emoji: "👑",
    rating: 2100,
    ratingLabel: "~2100",
    personality: "The ultimate challenge. Relentless, deep, and nearly perfect.",
    quote: "The measure of a chess player is what they do when they're losing.",
    tier: "master",
    skill: 17,
    depth: 14,
    levelIndex: 5,
  },
];

export function getBotById(id: string): Bot | undefined {
  return BOTS.find((b) => b.id === id);
}

export const BOT_TIER_ORDER: BotTier[] = ["free", "pro", "master"];

export function isBotUnlocked(bot: Bot, isPro: boolean, isMaster: boolean): boolean {
  if (bot.tier === "free") return true;
  if (bot.tier === "pro") return isPro || isMaster;
  if (bot.tier === "master") return isMaster;
  return false;
}
