# PlatoChess Sound Files

Drop your chess audio files here. The sound engine loads these files on the first
user gesture and caches them in memory. If a file is missing or fails to load,
the built-in Web Audio synthesiser plays automatically as a fallback — so the
game always has sound even without these files.

## Required filenames

| File | Trigger |
|------|---------|
| `move.mp3` | Standard pawn/piece move |
| `capture.mp3` | Any piece capture |
| `check.mp3` | Giving check |
| `castle.mp3` | Castling (king-side or queen-side) |
| `game-over.mp3` | Checkmate, stalemate, or draw |
| `promote.mp3` | Pawn promotion |
| `brilliant.mp3` | Brilliant move (`!!`) classification |
| `blunder.mp3` | Blunder (`??`) classification |
| `illegal.mp3` | Attempted illegal move |

## Recommended sources

- **Chess.com sounds** — exported via browser devtools (network tab) while playing
- **Lichess sounds** — open-source, MIT licensed: https://github.com/lichess-org/lila/tree/master/public/sound
- **Freesound.org** — royalty-free SFX (search "chess piece wood")

## Format notes

- MP3 (preferred) or OGG both work — just keep the `.mp3` extension in the filename
- Keep files short: 0.05–0.5 s for move/capture, up to ~1 s for game-over
- Normalise to -6 dBFS so pieces don't clip
