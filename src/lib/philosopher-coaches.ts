export type CoachId = "plato" | "marcus" | "seneca" | "nietzsche" | "confucius" | "none";

export const COACHES: Record<
  Exclude<CoachId, "none">,
  { name: string; epithet: string; era: string }
> = {
  plato: { name: "Plato", epithet: "of the Academy", era: "428-348 BCE" },
  marcus: { name: "Marcus Aurelius", epithet: "Emperor & Stoic", era: "121-180 CE" },
  seneca: { name: "Seneca", epithet: "the Younger", era: "4 BCE-65 CE" },
  nietzsche: { name: "Nietzsche", epithet: "Beyond good & evil", era: "1844-1900" },
  confucius: { name: "Confucius", epithet: "Master Kong", era: "551-479 BCE" },
};

const COACH_ORDER: Exclude<CoachId, "none">[] = ["plato", "marcus", "seneca", "nietzsche", "confucius"];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

type Bucket = "brilliant" | "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";

function bucketFromLabel(ratingLabel: string): Bucket {
  const r = ratingLabel.toLowerCase();
  if (r.includes("brilliant")) return "brilliant";
  if (r.includes("blunder")) return "blunder";
  if (r.includes("mistake")) return "mistake";
  if (r.includes("inaccuracy")) return "inaccuracy";
  if (r.includes("excellent")) return "excellent";
  if (r.includes("good")) return "good";
  if (r.includes("best")) return "best";
  return "good";
}

const MOVE_LINES: Record<Exclude<CoachId, "none">, Record<Bucket, string[]>> = {
  plato: {
    brilliant: [
      `You played {san} as if tracing a form in the good-sacrifice and order coincide.`,
      `{san}: a flash of higher intuition; the Idea of the attack appears.`,
    ],
    best: [
      `{san} moves your camp toward justice; the form of the position improves.`,
      `As with dialectic, {san} asks a sharper question of the opponent.`,
    ],
    excellent: [
      `{san} is measured; refine the next step as if polishing a definition.`,
      `A worthy thesis in {san}; anticipate the antithesis on the next file.`,
    ],
    good: [
      `{san} is plausible; ask whether a more perfect development still waits.`,
      `The shadow of {san} is acceptable-seek the true line beyond the cave wall.`,
    ],
    inaccuracy: [
      `{san} tilts the soul of the position; recollect which principle weakened.`,
      `Small asymmetry in {san}; geometry remembers every compromise.`,
    ],
    mistake: [
      `{san} fractures harmony; the refutation may already breathe in the tactics.`,
      `Here the many voices confused the one good plan-return to calculation.`,
    ],
    blunder: [
      `{san} is a fall from form-begin again from first principles, calmly.`,
      `The dialectic turned; silence noise and seek the saving idea after {san}.`,
    ],
  },
  marcus: {
    brilliant: [
      `{san}: courage and clarity met-treat the result with equanimity.`,
      `The board is indifferent; {san} is your assent to what reason demanded.`,
    ],
    best: [
      `{san} does what the position asked without drama-that is strength.`,
      `Disciplined appetite: {san} neither clings nor panics.`,
    ],
    excellent: [
      `{san} keeps the inner citadel intact; well ordered.`,
      `Attention held through {san}; continue without self-praise.`,
    ],
    good: [
      `{san} suffices; notice if fear or haste nudged the tempo.`,
      `Steady work in {san}; the obstacle is practice.`,
    ],
    inaccuracy: [
      `{san} cost a little clarity-what story rushed the hand?`,
      `Return to the present square; {san} was a drift from attention.`,
    ],
    mistake: [
      `{san} is heavy; name the passion, then play the next move coldly.`,
      `Fortune turned-your will remains yours after {san}.`,
    ],
    blunder: [
      `{san} is a wave on the rock-begin again, unbruised in intention.`,
      `Train on this; the board teaches without cruelty if you listen.`,
    ],
  },
  seneca: {
    brilliant: [
      `{san}-brief and complete, like virtue expressed in one act.`,
      `Audacity seen clearly: {san} wastes no words.`,
    ],
    best: [
      `{san} is preparation speaking; fortune favors the prepared mind.`,
      `No wasted motion in {san}; that is economy of spirit.`,
    ],
    excellent: [
      `{san} compresses long practice into one tempo-good.`,
      `Duty chosen once: {san}, cleanly played.`,
    ],
    good: [
      `{san} is tolerable; ask if time still allows a sharper virtue.`,
      `Enough for the hour; {san} neither clings nor flees.`,
    ],
    inaccuracy: [
      `{san} is a stumble of attention-shorten your horizon to forcing moves.`,
      `A small debt to the position after {san}; repay with patience.`,
    ],
    mistake: [
      `{san} borrowed trouble; simplify before the next storm.`,
      `Study why {san} hurt the structure-anger at oneself is wasted fire.`,
    ],
    blunder: [
      `{san} lets water in; bail with calm, forbid panic.`,
      `Even here, philosophy: accept the fact, forbid the habit.`,
    ],
  },
  nietzsche: {
    brilliant: [
      `{san}: a lightning yes over the mediocre maybe.`,
      `You became what you are-{san} is not the herd's pattern.`,
    ],
    best: [
      `The position asked for a creator; {san} answered.`,
      `{san} is style-say yes to the fight you chose.`,
    ],
    excellent: [
      `Strong spirits play {san} without needing applause.`,
      `{san} without decadence; will to power in one tempo.`,
    ],
    good: [
      `{san} is honest work; now overcome the comfort it brings.`,
      `Backbone in {san}; dare a deeper line if the abyss winks.`,
    ],
    inaccuracy: [
      `{san}-a small no to your own strength; rise to sharper tension.`,
      `Resentment against complexity? {san} was too tame.`,
    ],
    mistake: [
      `{san} is a descent-will you call it punishment or fertilizer?`,
      `The board is cruel; {san} is teacher if you listen.`,
    ],
    blunder: [
      `{san} broke an idol of certainty-build a truer plan from rubble.`,
      `What does not destroy the lesson makes you stranger; begin again.`,
    ],
  },
  confucius: {
    brilliant: [
      `{san} harmonizes risk and rite-exemplary courage.`,
      `The Way shows through {san}: bold, yet proportioned.`,
    ],
    best: [
      `{san} rectifies the center; names and ranks align.`,
      `Order in {san}; the gentleman studies the next relation.`,
    ],
    excellent: [
      `{san} is proper measure between speed and care.`,
      `Well named: {san} fits the file and the moment.`,
    ],
    good: [
      `{san} maintains li-acceptable if you refine the follow-up.`,
      `Harmony leans on {san}; listen for dissonance in the pawn structure.`,
    ],
    inaccuracy: [
      `{san} disturbs proportion; return study to essentials.`,
      `A small lapse in {san}; correct with steady heart.`,
    ],
    mistake: [
      `{san} breaks ritual flow; simplify to recover benevolence toward your position.`,
      `The family of pieces quarrels after {san}; restore the ruler's clarity.`,
    ],
    blunder: [
      `{san} is shameful only if you refuse to learn; renew sincerity.`,
      `Fallen from the Way in {san}; stand up, rename your plan, proceed.`,
    ],
  },
};

/** After a rated move (vs engine). */
export function coachOnMoveRating(
  coach: Exclude<CoachId, "none">,
  ratingLabel: string,
  san: string,
  seed = 0
): string {
  const b = bucketFromLabel(ratingLabel);
  const lines = MOVE_LINES[coach][b];
  const tmpl = pick(lines, seed + san.charCodeAt(0) + ratingLabel.length);
  return tmpl.replace(/\{san\}/g, san);
}

/** Analysis / stepping: comment on eval (white POV). */
export function coachOnEval(
  coach: Exclude<CoachId, "none">,
  evalCp: number,
  mate: number | null,
  lastSan: string | null,
  seed = 0
): string {
  const m = lastSan ? `After ${lastSan}, ` : "";
  const e =
    mate !== null
      ? mate > 0
        ? `white has a forced mate sequence (mate in ${mate}).`
        : `black threatens mate in ${Math.abs(mate)}-seek defense with clarity.`
      : evalCp > 150
        ? `white stands clearly better (about ${(evalCp / 100).toFixed(1)} pawns).`
        : evalCp < -150
          ? `black is pressing; white is down roughly ${(Math.abs(evalCp) / 100).toFixed(1)} pawns.`
          : `the position is roughly level (a${(evalCp / 100).toFixed(1)}).`;

  const plato = [
    `${m}${e} Seek the form behind the tactics.`,
    `${m}${e} What definition of advantage are you defending?`,
  ];
  const marcus = [
    `${m}${e} Return to the breath; play the next move as duty.`,
    `${m}${e} The eval is external; attention is yours.`,
  ];
  const seneca = [
    `${m}${e} Shorten your plan to what you can execute clearly.`,
    `${m}${e} Fortune shows this number; virtue is your reply.`,
  ];
  const nietzsche = [
    `${m}${e} Make meaning from tension-do not flee to comfort.`,
    `${m}${e} The number is a mask; what do you will underneath?`,
  ];
  const confucius = [
    `${m}${e} Rectify names: see which pieces truly matter.`,
    `${m}${e} Harmony lives in orderly relations-study the files.`,
  ];

  const all = { plato, marcus, seneca, nietzsche, confucius };
  return pick(all[coach], seed);
}

export function listCoaches(): { id: Exclude<CoachId, "none">; meta: (typeof COACHES)["plato"] }[] {
  return COACH_ORDER.map((id) => ({ id, meta: COACHES[id] }));
}
