# Prism Path device playtest

Updated October 3, 2026 for the light-and-prisms build. This is a test plan, not a record of completed tests.

For each session, record the device, OS, browser, orientation, puzzle and any steps to reproduce a problem.

## First session, without coaching

- Hand over the game on a fresh browser. Puzzle 1 opens with no menu. Note how long the player takes to make the first turn, and whether they read the caption.
- Watch puzzles 1–10. Do players find turning back (hold, right-click or two-finger tap) on their own, or only after reading the controls in Settings?
- After the first solve, does the player notice the sky button? After ten, the shop?
- Ask what the third star means. Players should be able to explain dark tiles and leaks in their own words.

## Ideas and difficulty

- Play the first puzzle of each constellation cold:
  - 21: bridges
  - 31: mirrors
  - 41: prisms
  - 51: mixing
  - 61: two inlets
  - 71: filters
- Note whether the lesson line and the tile art are enough. The prism rule (amber left, mint straight, violet right) is the one most likely to need help.
- Rate each tenth puzzle for difficulty from 1 to 5, and compare with the solver grades in `lib/content/puzzles-v3.json`. Flag any puzzle that felt like guessing.
- Play a week of dailies. Monday should feel easiest and Sunday hardest.

## Hints, undo and stars

- Use all three hint steps on one puzzle. Do players understand that only "Turn it for me" costs a star? Does "Try again" feel fair?
- Undo many times in a row, then reset. Check that stars already earned are never lost.

## Modes

- Drift: does the beam visibly carry on into the next board? Is "Another path" clear? Reload in the middle of a board and check it resumes.
- Pulse: does the timer feel optional and fair? Is the scoring clear from the intro? Post a score with a test account.

## Sound and touch

- Listen to each instrument for at least two minutes across three constellations, at a comfortable speaker volume and on headphones. Note harsh notes, clicks or fatigue.
- Test the following:
  - the first tap starting audio
  - the music switch, effects switch and volume
  - switching apps and an interruption such as a phone call
  - the iPhone silent switch
- On Android, check that vibration follows the setting. On iPhone, check that the setting is hidden.

## Accessibility

- With VoiceOver (iOS and macOS) and TalkBack (Android), solve puzzle 1 and a prism puzzle using only the tile descriptions.
- Play a mixing puzzle with a keyboard only.
- Play with high-contrast colours and light patterns, ideally with colour-blind players.
- Turn on Still light and reduced motion. Nothing should animate, and nothing should be lost.
- At 200% text size, landscape on a phone and narrow widths, check that the caption, targets, results card and panels don't overlap or clip.

## Accounts and Stardust

- Earn Stardust as a guest, then connect a dedicated test account. Check that it is credited once, becomes spendable and survives a reload. Interrupt the network during the sync and retry.
- Replay old puzzles and confirm that replaying never grants first-clear or constellation Stardust twice.
- Open the game with a version-2 save from the published site. Stars, palettes and unlocks should carry over, and the sky, shop and modes should all be visible.
- Add a friend by code. Check that their daily result appears and the boards rank by fewest turns.

## Native build prerequisite

This Linux environment has neither Xcode nor Swift, and no Capacitor shell has been built (proposal item X8). On an Apple build environment, create the shell, then compile and run it on iPhone and iPad before treating native support as verified. Haptics then use Capacitor's plugin.

Full Sky purchases need a real StoreKit product and receipt validation; the browser only shows the planned price. Keep the existing native editions intact, and apply browser-approved changes on a separate development branch.
