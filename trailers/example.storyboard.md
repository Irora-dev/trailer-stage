# example — storyboard

> status: the repo's worked example · a trailer about the trailer stage itself
> It uses no private assets and no configured app, so it records on a fresh
> clone. Times below are estimates until the mix is built.

**A stage that films your app, narrates it, and cuts itself to the voice.**

## Beats

| est. | anchor | you see | you hear |
|---|---|---|---|
| 1.2s | — | the wordmark on the ground, then its plate | (the bed alone) |
| 4.4s | `line:open.start+0.4` | a card, and a scripted chart drawing itself inside it | "This is a trailer stage…" |
| 16.3s | `line:pieces.start+4.2` | the card gives way to weighted tiles, one per piece kind | "Everything you see is a JSON file…" |
| 22.2s | `line:timing.start+0.4` | the anchor idea, written out as the line of JSON it is | "And every beat is anchored…" |
| 29.5s | `line:close.start` | a cut, then the reveal: mark, wordmark, plate | "Write a brief. Get a trailer." |

## What it demonstrates

- **`text`** at three weights (display, eyebrow, mono) on the themed ground
- **`card`** with an identity header whose numbers read live from a chart
- **`marketTape`** — a seeded series drawn on the clock, identical on every take
- **`bento`** — a squarified, weighted composition
- **`channelFlip`** and **`logoReveal`** — the cut and the arrival
- **`caption`** — one per line, off unless the recorder is asked for them
- **anchors** — every beat carries the narration boundary it came from

## Honesty

The card is labelled *"an example · every number here is invented"*, and the
chart is a seeded series, not data. That labelling is a rule of the house, not a
courtesy: anything invented on screen says so.

## Try it

```bash
npm run dev
open http://localhost:3000/stage/example?autostart     # watch it in the browser
npm run trailer -- example --no-record                 # what it would cost
npm run trailer -- example                             # record it silent, no key needed
npm run trailer -- example --go                        # with a voice key: render, build, re-time, record
```
