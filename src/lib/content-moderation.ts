// Profanity / explicit-content guard for user-supplied display names and usernames.
// Uses a curated regex pattern covering common slurs, sexual terms, and hate speech.
// This is a first line of defense — not a guarantee.

const EXPLICIT_PATTERNS: RegExp[] = [
  // Sexual terms
  /\b(fuck|f+u+c+k+|fuk|phuck|fuq|fck|f_ck)\b/i,
  /\b(shit|sh!t|sht|shyt)\b/i,
  /\b(cunt|c+u+n+t+|kunt)\b/i,
  /\b(cock|c0ck|d[i1]ck|d1ck)\b/i,
  /\b(pussy|puss[yi]|pu55y)\b/i,
  /\b(ass|a55|@ss)\b/i,
  /\b(bitch|b!tch|b1tch|bi7ch)\b/i,
  /\b(whore|wh0re|h0e)\b/i,
  /\b(slut|sl+u+t+)\b/i,
  /\b(penis|p3n[i1]s|peni5)\b/i,
  /\b(vagina|vag[i1]na)\b/i,
  /\b(sex|s3x|s[e3]xy|sexu)\b/i,
  /\b(porn|p0rn|pr0n)\b/i,
  /\b(nude|nud[e3]|n[u0]de)\b/i,
  /\b(boob|b00b|tit|t[i1]t)\b/i,
  /\b(anal|@nal)\b/i,
  /\b(cum|c[u0]m|jizz|ji[z5]+)\b/i,
  /\b(masturbat)\b/i,
  /\b(dildo|vibrat)\b/i,
  /\b(erect|erection)\b/i,
  /\b(rape|r[a@]pe)\b/i,
  /\b(molestat|molest)\b/i,
  // Racial slurs
  /\bn[i1][g9][g9][e3]r\b/i,
  /\bn[i1]g+[ae]\b/i,
  /\bc[h#][i1]nk\b/i,
  /\bsp[i1][ck]\b/i,
  /\bk[i1]ke\b/i,
  /\bw[e3]tb[a@]ck\b/i,
  /\bg[o0][o0]k\b/i,
  /\bch[i1]nk\b/i,
  /\bbeaner\b/i,
  /\bcr[a@]cker\b/i,
  /\bj[e3]w[s]?\b/i, // when used as a slur in combination
  // Hate speech / extremism
  /\b(nazi|n[a@]z[i1])\b/i,
  /\b(hitler|h[i1]tler)\b/i,
  /\b(kkk|ku\s?klux)\b/i,
  /\b(fa[g9]+[o0]t|f[a@]g)\b/i,
  /\bd[yi]ke\b/i,
  /\btr[a@]nny\b/i,
  // Violence / self-harm
  /\b(kill\s*yourself|kys)\b/i,
  /\b(suicide|suicid)\b/i,
  // Admin impersonation
  /\b(admin|moderator|support|official|platochess\s*staff)\b/i,
];

/**
 * Returns true if the text contains explicit or disallowed content.
 * Used before saving display names and usernames.
 */
export function containsExplicitContent(text: string): boolean {
  return EXPLICIT_PATTERNS.some((re) => re.test(text));
}

/**
 * Returns a human-readable reason string if invalid, or null if clean.
 */
export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null; // empty is allowed (clears the name)
  if (trimmed.length > 50) return "Display name must be 50 characters or fewer.";
  if (containsExplicitContent(trimmed))
    return "That name isn't allowed. Please choose a different one.";
  return null;
}

export function validateUsername(username: string): string | null {
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < 3) return "Username must be at least 3 characters.";
  if (trimmed.length > 30) return "Username must be 30 characters or fewer.";
  if (!/^[a-z0-9_]+$/.test(trimmed))
    return "Username can only contain letters, numbers, and underscores.";
  if (containsExplicitContent(trimmed))
    return "That username isn't allowed. Please choose a different one.";
  return null;
}
