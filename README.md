# Trailer Stage

**Write a brief. Get a trailer.**

A programmable stage that films your own running app, narrates it, and cuts
itself to the voice. A trailer here is three text files, not a video project —
so it can be reviewed in a pull request, edited by a person or an assistant, and
re-rendered when the product changes.

Built to be handed to an AI assistant along with your codebase: see
[AGENTS.md](./AGENTS.md), which tells one what this is, how to run it, and — the
part that matters — **what to ask you before it starts**.

---

## What it does

- **Films the real thing.** Your app runs behind a dev proxy and is driven like a
  user: navigate, click, type, scroll. Not a mock-up that will drift from the
  product next week.
- **Cuts to the voice.** Narration is rendered, then *measured*: every beat in the
  picture anchors to a line ("half a second after the hook ends"), so re-recording
  a line re-times the whole cut. You never hand-tune a timestamp.
- **Costs nothing until you say so.** Rendering is the only step that spends, and
  it happens behind one explicit `--go`. Everything else — writing, arranging,
  shooting a silent draft — is free.
- **Proves its own edits.** Each take extracts a labelled still per cue and scores
  them against your approved take, worst frame first. You see what changed.
- **Generates the shots it cannot film.** A `footage` clip names a model, a prompt
  and its references; the dry run prices every missing shot in dollars, `--go`
  renders it (fal.ai or the Gemini API), and the stage plays it against its own
  clock. Until then the shot is a labelled plate, so a silent draft costs nothing.

## Requirements

- Node 20.11+
- A Chrome-family browser (for recording)
- `ffmpeg` — `npm i -D ffmpeg-static` is the easy path
- An [ElevenLabs](https://elevenlabs.io) key for narration, and an
  [Anthropic](https://platform.claude.com) key for the brief compiler. Both
  optional: everything else works without them.
- For generated footage, a [fal.ai](https://fal.ai) key and/or a paid-tier
  [Gemini API](https://ai.google.dev) key. Optional too: shots without a file
  record as placeholder plates.

## Quick start

```bash
npm install
cp studio.config.json studio.config.local.json   # your machine's settings
npm run dev                                       # http://localhost:3000
```

Point it at your app by setting `target.url` in `studio.config.local.json`, then:

```bash
# 1. compile a brief — text only, nothing renders, nothing spends
npm run draft -- my-brief.md --name launch --project ../my-app

# 2. read it
cat trailers/launch.storyboard.md
open http://localhost:3000/studio/launch      # drag beats around if you like

# 3. see what it would cost
npm run trailer -- launch

# 4. render, build, re-time, record
npm run trailer -- launch --go

# 5. watch it, approve it
npm run review                                 # http://localhost:4600
```

A brief can be two sentences or a dictated transcript. `--project` accepts a
directory or a git URL, and builds a capped, redacted digest of the codebase so
the trailer talks about your actual product. `--print-digest` shows you exactly
what would be sent, before it is sent.

## The shape of a trailer

```jsonc
// trailers/launch.timeline.json
{
  "name": "launch",
  "end": 34.2,
  "blackoutAnchor": "line:close.end+0.5",
  "mix": "/…/launch.wav",
  "tracks": [
    { "id": "app", "name": "The app", "kind": "visual", "clips": [
      { "id": "app", "at": 1.2, "until": 22.4,
        "anchor": "line:open.start-2", "anchorUntil": "line:tour.end+0.4",
        "params": { "piece": "browserFrame", "startPath": "/", "actions": [ /* … */ ] } }
    ]},
    { "id": "close", "name": "The close", "kind": "visual", "clips": [
      { "id": "reveal", "at": 24.2, "anchor": "line:close.start",
        "params": { "piece": "logoReveal", "plateText": "ship it" } }
    ]},
    { "id": "captions", "name": "Captions", "kind": "visual", "clips": [ /* … */ ] }
  ]
}
```

Every clip is a cue. Every piece is documented at the top of
`src/lib/pieces.ts`. The craft — how to film an app, direct a voice, move a
camera, and the traps already paid for — is in [docs/MANUAL.md](./docs/MANUAL.md).

## Generated footage

A shot the stage cannot film — a person at a desk, a city at dusk, a metaphor —
is a `footage` clip whose `render` block is the spend spec, exactly as a
narration line's `render` block is:

```jsonc
{ "id": "trader", "at": 2.1, "until": 7.9, "anchor": "line:hook.start-0.4", "anchorUntil": "line:hook.end+0.3",
  "params": { "piece": "footage", "fit": "cover", "hold": "freeze", "label": "AI-generated",
    "render": { "provider": "fal", "model": "bytedance/seedance-2.0/text-to-video",
      "prompt": "Handheld 35mm, night. A trader leans toward a monitor; green candles reflect in their glasses; slow push-in. No text, no logos, no recognisable faces.",
      "negative": "text, logos, real people", "seconds": "auto", "resolution": "720p", "aspect": "16:9", "audio": false } } }
```

`npm run footage -- <name>` prints every shot the timeline still owes and what it
costs (per-second prices, dated); `--go` renders them, normalises them for the
stage, and writes a provenance sidecar beside each file. `npm run trailer -- <name>`
folds the same figure into its dry run and renders footage after the mix has
been measured, so each shot is asked for at its final length. A file that exists
is never re-rendered.

Before anything is paid for, the request is conformed to and validated against
the provider's own published schema, four caps are checked (per run, per shot,
per month from a ledger, and the age of the price table), and a pending marker
makes a crash unable to pay twice. `npm run footage:test` runs the lane's offline
tests, and `--mock --go` runs the whole path on a generated clip for nothing.
The rules of the craft — what a shot may depict, the disclosure every cut with
footage owes — are in the manual's footage chapter.

A **looping** shot (a hero background, an ambient plate) is generated with the
same still as first and last frame (`refs.images: [still, still]` on an
image-to-video endpoint) and closed for free by `npm run loop -- <name> <shot>`,
which trims the duplicate frame, measures the seam against the clip's own motion,
blends it only when it steps, and writes a report and a 3-cycle preview.

## Commands

| command | does |
|---|---|
| `npm run dev` | the stage (`/stage/<name>`) and the studio (`/studio/<name>`) |
| `npm run draft -- <brief> --name <n>` | compile a brief into a trailer (add `--edit <n>` to revise one) |
| `npm run trailer -- <n> [--go]` | the pipeline: render, build, re-time, record, compare |
| `npm run review` | every trailer, newest take, cue contact sheet, approve button |
| `npm run critic -- <n>` | a ranked defect list read off the take's own frames |
| `npm run cast -- --line … --describe …` | audition and cast a narrator |
| `npm run export -- <n>` | the approved cut plus re-recorded social ratios |
| `npm run footage -- <n> [--go\|--check\|--mock --go]` | the shots the picture owes, priced; `--go` renders them; `--check` validates the render blocks against the providers' schemas; `--mock` runs the path for free |
| `npm run footage:test` | the footage lane's offline tests: no key, no network, no spend |
| `npm run loop -- <n> <shot>` | close a shot generated first-frame = last-frame into a seamless loop: duplicate trimmed, seam measured, blended only if it steps, a 3-cycle preview; free |
| `npm run sweep` | what this repo would publish: paths, keys, addresses, internal notes |

## Publishing your own trailers repo

Run `npm run sweep` before you make a repo public. Takes and rendered audio are
gitignored by default: they are large, regenerable, and a take contains whatever
was on screen when it was filmed.

## Licence

CC0 1.0 — public domain. Take it, change it, ship it, no attribution required.
