# Light and prisms development build

Branch: `claude/pensive-hawking-lrmts2` in `prism-path-claude`.
Baseline: imported browser version 36 (`9f6e8d7` in this repository).
Plan: the *Prism Path Improvement Proposal* (October 3, 2026). The codes below (G1, V1, A1, X1 and so on) are its section numbers.

This build replaces the puzzle engine, the content, the play screen, progression and audio. It is a browser development build. The `prism-path` repository, the published site and the Swift Playgrounds edition are unchanged.

## Gameplay

| Code | Proposal | In this build |
| --- | --- | --- |
| G1 | A real prism: split, filter, mix | `lib/optics.ts` traces amber, mint and violet light separately. A prism splits white light that enters its flat back: amber turns left, mint goes straight, violet turns right. Mirrors turn light, bridges let two beams cross, filters pass only their colours, and receivers need exactly their mix. Light that runs into a wall or off the board is a leak. |
| G2 | One optical idea per constellation | In order: channels, fixed tiles, bridges, mirrors, prisms, mixing, two inlets, filters, then everything together. Each puzzle shows a one-line lesson. |
| G3 | A "no leaks" third star | One star for lighting every target. A second for solving without automatic turns. A third for a radiant board, where every tile is lit and no light escapes. *Perfect* means three stars in the fewest possible turns. |
| G4 | Two-way turns, free undo, gentler hints | Tap turns clockwise. Hold, right-click, two-finger tap, Shift+Enter or Q turns back. Undo is free and unlimited. Hints come in three steps: first where the light stops, then which tile to fix and why, then an optional automatic turn. Only that automatic turn costs a star. |
| G5 | A solver-designed difficulty curve | `lib/solver.ts` proves that each campaign puzzle has exactly one radiant arrangement, and grades it by the reasoning it takes. `scripts/generate-content.ts` lays out a sawtooth curve and drops boards that need deep guessing. Puzzles 1–3 are hand-made. |
| G6 | A weekday daily, share card and streak freeze | Monday is gentlest and each day adds an idea. Sunday brings everything together. There are 53 puzzles per weekday, 371 in all. Average grades from Sunday to Saturday are 25.4, 12.0, 12.0, 15.2, 17.9, 17.9 and 18.5. Results rank by fewest automatic turns, then fewest turns, never by time. The share text shows stars, turns and a light curve, never the route. One missed day in any seven is covered automatically. |
| G7 | Pulse as an opt-in mode | Three minutes on this week's shared boards, scoring 100 per board plus up to 50 for using few turns. The server replays every submitted board before ranking it. |
| G8 | Relax becomes Drift | Endless boards with no score. The beam leaves one board and enters the next on the same row, and finished paths collect as a ribbon. |

## Visuals

| Code | Proposal | In this build |
| --- | --- | --- |
| V1 | Ship the concept art | Glass tiles and thread-like beams on a canvas renderer (`app/board/render.ts`), following `docs/design`. The constellation art and star-map panorama now appear in the sky, re-encoded as WebP: 530 KB instead of 6 MB. |
| V2 | Travelling light | After each turn, light moves outward one tile every 62 ms from where it was. |
| V3 | Colour glyphs and palettes | Each colour has a glyph: ▲ amber, ● mint, ■ violet and ✦ white. Optional light patterns make amber dotted and violet dashed. A high-contrast beam set is also available. |
| V4 | Player solutions draw the sky | Each solved route becomes the line between two stars in its constellation. |
| V5 | Chapter atmospheres | Each constellation tints the sky behind its puzzles. |
| V6 | Calm game feel | Turns ease in with a small overshoot. Pinned tiles give a short nudge, and solved boards bloom. *Still light* turns all motion off; on a first visit it follows the system's reduced-motion setting. |

## Audio

| Code | Proposal | In this build |
| --- | --- | --- |
| A1 | Each route plays a melody | Each newly lit tile plays a note in the constellation's pentatonic key as the light reaches it, at least 70 ms apart. When a puzzle is solved, the whole route plays back over the constellation's chord. |
| A2 | Instruments and adaptive layers | Felt piano is free. Crystal chimes, kalimba and bowed glass are Stardust unlocks. All four are synthesised in the browser. Background music plays through a filter that opens as the board fills with light, and a shimmer pad fades in with it. |
| A3 | Haptics only where supported | Uses Capacitor's Haptics plugin inside a native shell, and `navigator.vibrate` elsewhere. The setting is hidden where neither exists, such as iOS Safari. |

## Experience

| Code | Proposal | In this build |
| --- | --- | --- |
| X1 | Board first | A first visit opens straight into puzzle 1. The board fills the screen and the tools sit under the thumb. |
| X2 | Progressive disclosure | The sky appears after the first solve, the shop after ten solves, and Drift and Pulse after the first constellation. Returning version-2 players see everything at once. |
| X3 | One currency | Stardust only. Points, energy and the old score currency are gone. |
| X4 | Full Sky purchase, no ads, cosmetic Stardust | Advertisements are removed. Constellations 1–3, the daily and Drift are free. Full Sky (constellations 4–9) shows a planned one-time price of $3.99 and offers a session preview; no payment is taken. Stardust buys sounds and music only. Palettes are earned by restoring constellations: Sunset with the third, Aurora with the ninth. |
| X5 | Accessibility | Every tile is a button with a spoken description. Arrow keys move between tiles; Enter, Q and E turn; U undoes; H asks for a hint; N moves on. Glyphs and patterns carry each colour, and all text meets WCAG AA contrast. |
| X6 | The sky as hub, plus story | The star map is home. Choose a constellation, read its story line once it is restored, or start the daily, Drift or Pulse. |
| X7 | Social | Friend codes, friends' daily results, and public boards for stars, the daily and Pulse. |
| X8 | One codebase with Capacitor | **Not done.** The web build has the hooks a native shell needs (haptics and safe areas), but no Capacitor project was created or built. That needs Apple and Android tooling. |
| X9 | Anonymous analytics and "How did that feel?" | Each puzzle keeps daily counts of starts, connections, solves, radiant and perfect results, quits, hints, undos, reversed turns and lit tiles. No account, device ID or address is sent, and Settings can switch it off. One optional question follows each restored constellation. |

## Compatibility

- **Saves.** Version-2 stars carry over by puzzle number, so restored constellations, palettes and unlocks are kept. Old unfinished boards are not restored, because every board has changed. Drift starts fresh.
- **Settings.** Music on or off, volume and calm motion carry over.
- **Server.** Results and guest Stardust receipts recorded under version 2 are still verified with the version-2 rules in `lib/legacy`. Stardust balances and owned unlocks are unchanged. An owned `pack` opens Full Sky.
- **Database.** Apply `drizzle/0002_light_and_prisms.sql` before deploying. It adds friends, Pulse runs and statistics, radiant and perfect flags, a result version, and friend codes.
- **Local development.** The database `pnpm dev` creates starts empty, so player routes answer 503 at first. Run `node scripts/local-db.mjs` once after starting the dev server to apply the migrations.
- **Agents.** The WebMCP tools `read_prism_puzzle` and `rotate_prism_tiles` work on the new boards, and `rotate_prism_tiles` can now turn tiles in either direction.

## Verification

- 39 automated tests pass (`node --experimental-strip-types --test scripts/*.test.ts`):
  - optics rules and solver uniqueness
  - generated content and progression
  - Stardust rules and receipts
  - server SQL, run against SQLite with the migrations applied
  - version-2 compatibility
  - audio files and synthesis
  - sign-in
- A separate check during development compared the solver with an exhaustive search on 825 small generated boards. Every count matched. That check is not part of the test suite.
- TypeScript (`pnpm exec tsc --noEmit`) and the production build (`pnpm build`) pass.
- Lint reports 24 errors. All are in files this build did not touch, such as `components/ui` and `SignInProviders.tsx`; the baseline had 142.
- Browser checks used Chromium at 390×844, 820×1180, 1280×720 and 1440×900:
  - The whole board is visible on load for puzzles 1, 45 (6×5) and 90 (7×7), the daily, Drift and Pulse.
  - No page scrolls sideways and no page errors appeared.
- Scripted end-to-end flows passed:
  - the whole first constellation, with its story line and feel prompt
  - the three hint steps, undo and reset
  - keyboard play
  - the daily and its share text
  - a Drift board flowing into the next
  - Pulse scoring
  - statistics reaching the local database
- **Not tested:**
  - real iPhone, iPad or Android devices
  - VoiceOver or TalkBack
  - listening tests of the synthesised instruments
  - signed-in synchronisation end to end, because sign-in providers are not configured locally
  - the Capacitor shell
  - payments, which do not exist yet

## Still to do

- Playtest the difficulty curve with real players. The grades come from the solver, not from people.
- Commission recorded instruments if the synthesised voices fall short in listening tests.
- Build the Capacitor shell (X8) and connect real purchases for Full Sky.
- Device and accessibility passes, following [PLAYTEST.md](PLAYTEST.md).
