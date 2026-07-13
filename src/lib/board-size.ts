/**
 * Board size preference — percentage (60–100) of the max board footprint,
 * plus a lock so the size can't be nudged accidentally. Changes broadcast a
 * window event so an open Game page resizes live while the slider drags.
 */
const SIZE_KEY = "platochess:board-size";
const LOCK_KEY = "platochess:board-size-locked";
export const BOARD_SIZE_EVENT = "platochess:board-size-changed";
export const BOARD_SIZE_MIN = 60;
export const BOARD_SIZE_MAX = 100;

export function getBoardSize(): number {
  try {
    const raw = Number(localStorage.getItem(SIZE_KEY));
    if (Number.isFinite(raw) && raw >= BOARD_SIZE_MIN && raw <= BOARD_SIZE_MAX) return raw;
  } catch {
    /* SSR / private mode */
  }
  return BOARD_SIZE_MAX;
}

export function setBoardSize(pct: number): void {
  const clamped = Math.round(Math.min(BOARD_SIZE_MAX, Math.max(BOARD_SIZE_MIN, pct)));
  try {
    localStorage.setItem(SIZE_KEY, String(clamped));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(BOARD_SIZE_EVENT, { detail: clamped }));
}

export function getBoardSizeLocked(): boolean {
  try {
    return localStorage.getItem(LOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBoardSizeLocked(locked: boolean): void {
  try {
    localStorage.setItem(LOCK_KEY, locked ? "1" : "0");
  } catch {
    /* ignore */
  }
}
