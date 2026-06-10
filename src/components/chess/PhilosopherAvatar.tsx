/**
 * PhilosopherAvatar — animated SVG busts of the philosopher bots, styled after
 * their classical depictions (Socrates' bald crown and broad beard, Plato's
 * headband, Hypatia's braided updo…). The eyes blink on a loop and the mouth
 * animates while the bot is speaking.
 */
import { memo } from "react";

type Hairstyle = "bald" | "short" | "long" | "updo" | "wild" | "balding";
type BeardStyle = "none" | "short" | "full" | "long";
type Accessory = "none" | "laurel" | "headband";

interface AvatarConfig {
  skin: string;
  hair: string;
  hairstyle: Hairstyle;
  beard: BeardStyle;
  accessory: Accessory;
  robe: string;
}

/** Visual identities based on the surviving busts and paintings. */
const AVATARS: Record<string, AvatarConfig> = {
  // Centaur tutor of heroes — long hair and a leafy laurel.
  chiron: { skin: "#c98a5b", hair: "#5d4023", hairstyle: "long", beard: "short", accessory: "laurel", robe: "#3f6212" },
  // The famous bust: bald crown, side fringe, broad nose, big beard.
  socrates: { skin: "#d9a06b", hair: "#cfcfc6", hairstyle: "bald", beard: "full", accessory: "none", robe: "#6b7280" },
  // Short curly hair, neat trimmed beard.
  aristotle: { skin: "#d9a06b", hair: "#7c5a35", hairstyle: "short", beard: "short", accessory: "none", robe: "#92400e" },
  // The mystic: long hair, long beard, fillet headband.
  pythagoras: { skin: "#d8a173", hair: "#e7e2d8", hairstyle: "long", beard: "long", accessory: "headband", robe: "#7e22ce" },
  // Wild-haired inventor mid-eureka.
  archimedes: { skin: "#d9a06b", hair: "#9ca3af", hairstyle: "wild", beard: "full", accessory: "none", robe: "#0e7490" },
  // Receding hair, tidy beard — the geometer.
  euclid: { skin: "#d8a173", hair: "#a8a29e", hairstyle: "balding", beard: "full", accessory: "none", robe: "#1e40af" },
  // Scholar of Alexandria: braided updo, philosopher's fillet, no beard.
  hypatia: { skin: "#dcab7c", hair: "#3f2c1e", hairstyle: "updo", beard: "none", accessory: "headband", robe: "#9d174d" },
  // Broad shoulders ("Platon"), full beard, classical taenia band.
  plato: { skin: "#d9a06b", hair: "#d6d3d1", hairstyle: "long", beard: "full", accessory: "headband", robe: "#b45309" },
};

const FALLBACK: AvatarConfig = {
  skin: "#d9a06b", hair: "#8b7355", hairstyle: "short", beard: "short", accessory: "none", robe: "#475569",
};

function Hair({ style, color }: { style: Hairstyle; color: string }) {
  switch (style) {
    case "bald":
      // Side fringe only — the Socrates crown stays bare.
      return (
        <g fill={color}>
          <path d="M14 34 q-3 8 0 16 q3 2 5 0 q-2 -8 -1 -15 z" />
          <path d="M50 34 q3 8 0 16 q-3 2 -5 0 q2 -8 1 -15 z" />
        </g>
      );
    case "short":
      return <path d="M13 34 q-2 -18 19 -19 q21 1 19 19 q-1 -8 -7 -10 q-12 -5 -24 0 q-6 2 -7 10 z" fill={color} />;
    case "balding":
      return (
        <g fill={color}>
          <path d="M13 33 q0 -8 8 -12 q-4 6 -3 12 q-2 4 -5 0 z" />
          <path d="M51 33 q0 -8 -8 -12 q4 6 3 12 q2 4 5 0 z" />
        </g>
      );
    case "long":
      return (
        <g fill={color}>
          <path d="M13 32 q-2 -17 19 -18 q21 1 19 18 q-1 -7 -7 -9 q-12 -5 -24 0 q-6 2 -7 9 z" />
          <path d="M12 32 q-3 12 -1 22 q3 4 6 1 q-2 -12 -1 -21 z" />
          <path d="M52 32 q3 12 1 22 q-3 4 -6 1 q2 -12 1 -21 z" />
        </g>
      );
    case "wild":
      return (
        <g fill={color}>
          <path d="M13 33 q-4 -16 19 -19 q23 3 19 19 q-2 -6 -6 -8 q1 -4 -3 -5 q-2 3 -5 1 q-1 -4 -5 -3 q-2 3 -5 1 q-4 -1 -4 3 q-5 0 -4 4 q-4 1 -6 7 z" />
          <path d="M11 34 q-3 6 -1 12 q3 3 5 0 q-2 -6 -1 -11 z" />
          <path d="M53 34 q3 6 1 12 q-3 3 -5 0 q2 -6 1 -11 z" />
        </g>
      );
    case "updo":
      return (
        <g fill={color}>
          <path d="M13 33 q-2 -17 19 -18 q21 1 19 18 q-1 -7 -7 -9 q-12 -5 -24 0 q-6 2 -7 9 z" />
          <ellipse cx="32" cy="13" rx="9" ry="5.5" />
          <path d="M12 33 q-2 8 0 14 q3 3 5 0 q-2 -7 -1 -13 z" />
          <path d="M52 33 q2 8 0 14 q-3 3 -5 0 q2 -7 1 -13 z" />
        </g>
      );
  }
}

function Beard({ style, color }: { style: BeardStyle; color: string }) {
  switch (style) {
    case "none":
      return null;
    case "short":
      return <path d="M19 50 q1 9 13 10 q12 -1 13 -10 q-2 6 -13 6 q-11 0 -13 -6 z" fill={color} />;
    case "full":
      return <path d="M18 48 q-1 16 14 17 q15 -1 14 -17 q-3 8 -14 8 q-11 0 -14 -8 z" fill={color} />;
    case "long":
      return <path d="M18 48 q-2 22 14 24 q16 -2 14 -24 q-3 9 -14 9 q-11 0 -14 -9 z" fill={color} />;
  }
}

function AccessoryLayer({ type }: { type: Accessory }) {
  switch (type) {
    case "none":
      return null;
    case "laurel":
      return (
        <g fill="#65a30d">
          <ellipse cx="17" cy="26" rx="4" ry="2" transform="rotate(-30 17 26)" />
          <ellipse cx="22" cy="21" rx="4" ry="2" transform="rotate(-18 22 21)" />
          <ellipse cx="47" cy="26" rx="4" ry="2" transform="rotate(30 47 26)" />
          <ellipse cx="42" cy="21" rx="4" ry="2" transform="rotate(18 42 21)" />
        </g>
      );
    case "headband":
      return <rect x="14" y="23" width="36" height="4" rx="2" fill="#f5f5f4" opacity="0.92" />;
  }
}

export interface PhilosopherAvatarProps {
  botId: string;
  speaking?: boolean;
  size?: number;
  className?: string;
}

export const PhilosopherAvatar = memo(function PhilosopherAvatar({
  botId,
  speaking = false,
  size = 48,
  className,
}: PhilosopherAvatarProps) {
  const cfg = AVATARS[botId] ?? FALLBACK;

  return (
    <svg
      viewBox="0 0 64 84"
      width={size}
      height={(size * 84) / 64}
      className={className}
      role="img"
      aria-label={`${botId} avatar`}
      style={{ animation: "plato-avatar-bob 4s ease-in-out infinite" }}
    >
      {/* Shoulders / robe */}
      <path d="M6 84 q2 -18 26 -19 q24 1 26 19 z" fill={cfg.robe} />
      <path d="M26 66 q6 4 12 0 l1 6 q-7 4 -14 0 z" fill={cfg.skin} />

      {/* Head */}
      <ellipse cx="32" cy="40" rx="19" ry="22" fill={cfg.skin} />

      {/* Ears */}
      <ellipse cx="13.5" cy="42" rx="3" ry="4.5" fill={cfg.skin} />
      <ellipse cx="50.5" cy="42" rx="3" ry="4.5" fill={cfg.skin} />

      {/* Hair behind accessories */}
      <Hair style={cfg.hairstyle} color={cfg.hair} />
      <AccessoryLayer type={cfg.accessory} />

      {/* Beard sits under the facial features so the mouth stays visible */}
      <Beard style={cfg.beard} color={cfg.hair} />

      {/* Brows */}
      <rect x="20" y="33.5" width="9" height="2" rx="1" fill={cfg.hair} />
      <rect x="35" y="33.5" width="9" height="2" rx="1" fill={cfg.hair} />

      {/* Eyes — blink loop */}
      <g style={{ animation: "plato-avatar-blink 4.6s infinite", transformOrigin: "32px 39px" }}>
        <ellipse cx="24.5" cy="39" rx="2.4" ry="3" fill="#1c1917" />
        <ellipse cx="39.5" cy="39" rx="2.4" ry="3" fill="#1c1917" />
        <circle cx="25.2" cy="38" r="0.8" fill="#fafaf9" />
        <circle cx="40.2" cy="38" r="0.8" fill="#fafaf9" />
      </g>

      {/* Nose */}
      <path d="M32 41 q-2.5 6 -1 8 q1.5 1.5 3 0" fill="none" stroke="#00000022" strokeWidth="1.6" strokeLinecap="round" />

      {/* Mouth — animates while speaking */}
      {speaking ? (
        <ellipse
          cx="32"
          cy="55"
          rx="4.5"
          ry="2.6"
          fill="#7f1d1d"
          style={{ animation: "plato-avatar-talk 0.34s ease-in-out infinite", transformOrigin: "32px 55px" }}
        />
      ) : (
        <path d="M27 55 q5 3 10 0" fill="none" stroke="#7f1d1d" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
});
