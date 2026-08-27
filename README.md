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

## Requirements

- Node 20.11+
- A Chrome-family browser (for recording)
- `ffmpeg` — `npm i -D ffmpeg-static` is the easy path
- An [ElevenLabs](https://elevenlabs.io) key for narration, and an
  [Anthropic](https://platform.claude.com) key for the brief compiler. Both
  optional: everything else works without them.

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
| `npm run sweep` | what this repo would publish: paths, keys, addresses, internal notes |

## Publishing your own trailers repo

Run `npm run sweep` before you make a repo public. Takes and rendered audio are
gitignored by default: they are large, regenerable, and a take contains whatever
was on screen when it was filmed.

## Licence

CC0 1.0 — public domain. Take it, change it, ship it, no attribution required.
