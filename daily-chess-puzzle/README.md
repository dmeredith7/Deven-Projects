# Daily Chess Puzzle

A new checkmate puzzle every day, and everyone gets the same one. It's a static web page with no server and no build step.

## Play

Open `index.html` in a browser. It works straight from the file system, or you can host the folder on any static host (GitHub Pages, Netlify, etc.).

- **One puzzle a day:** the puzzle comes from the calendar date, so everyone playing on the same date gets the same puzzle. It changes at local midnight.
- **Mate in 1 to 3:** find the checkmate. In longer puzzles the opponent replies automatically.
- **Unlimited tries:** a wrong move is taken back and you try again. Tries are counted.
- **Hints:** the first hint highlights the piece to move and the second shows where it goes.
- **Show solution:** plays out the answer if you give up.
- **Share:** copies a result like `🟥💡🟩🟩` so you can compare with friends.
- **Stats and streaks:** saved in your browser (`localStorage`).

To preview another day's puzzle, add `?date=YYYY-MM-DD` to the URL. Previews don't affect your stats.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `style.css`, `app.js` | The game |
| `puzzles.js` | Generated list of puzzles. The order is the daily schedule: 9 Nov 2026 is puzzle #1, and the list loops when it runs out. |
| `vendor/chess.js` | [chess.js](https://github.com/jhlywa/chess.js) 1.4.0 (BSD-2-Clause), used for move legality |
| `tools/` | Scripts that verify the puzzles and build `puzzles.js` |

## Adding puzzles

Puzzles come from three source lists in `tools/`:

- `patterns.json`: classic mating patterns as FEN. Each one is also used mirrored and with the colours swapped.
- `games.json`: famous games and opening traps as move lists.
- `generated.json`: mate-in-2 positions found by a search script.

Every puzzle is checked by a brute-force mate search. The build only keeps a position if it is a forced mate in exactly `n` moves, and it records every first move that forces the mate, so any correct solution is accepted. On the final move, any checkmate counts.

```sh
cd tools
npm install
npm run build    # rewrites ../puzzles.js
```

Rebuilding reshuffles the schedule, so do it before sharing the game, or accept that future days will change.
