# The manual

How to make a trailer on this stage: the method, the pieces, and the traps that
have already been paid for. If you learn a new one, it goes **here** — in the
section it belongs to — not into a second document.

---

## The method

**1. Sound first.** A trailer is cut to a voice, so the voice comes first. Write
the narration into `<name>.mix.json` as render parts and build it:

```bash
npm run mix -- my-trailer          # dry run: what it would render
npm run mix -- my-trailer --go     # renders what is missing, then builds
```

The builder splices the lines, mixes the bed under them with a sidechain duck,
and — the important part — writes `<name>.cues.json`: **where every word actually
landed**. That file is the clock everything else runs on.

**2. Anchor the picture to it.** A clip says where its time comes from:

```json
{ "id": "reveal", "at": 24.2, "anchor": "line:close.start+0.4" }
```

`at` is the resolved number the stage reads; `anchor` is the truth it came from.
After any audio change, `npm run resolve -- my-trailer --write` rewrites every
`at` from the new measurements. Re-record a line and the whole cut follows.

**3. Iterate on picture for free.** Set `"mix": null` for a **silent draft**: the
recorder muxes picture only, so you can shoot and judge a cut before spending a
cent on narration.

**4. Record and read the frames.**

```bash
npm run trailer -- my-trailer --go
```

Every take extracts one labelled still per cue. **Read them.** The log cannot see
a clipped subject, a caption on a logo, or a loading state that never resolved.

**5. Approve, and let the machine hold the line.** Approving a take on the review
board writes a golden; every later take is scored against it, worst frame first.
That is how you prove an edit changed only what it meant to.

---

## The pieces

The full vocabulary — every kind and every knob — is the header comment of
`src/lib/pieces.ts`. It is the source of truth; this is the shape of it.

| piece | for |
|---|---|
| `browserFrame` | your actual app, driven like a user: navigate, click, type, scroll |
| `card` | a themed panel with an identity header and live readings |
| `marketTape` / `lineChart` | scripted series drawn progressively on the clock |
| `bento` | a weighted composition as squarified tiles |
| `groupFold` | many items across groups folding into one thing per group |
| `logoReveal` / `endCard` | the brand's arrival, and the close |
| `text` / `caption` / `chipRow` | words on the set |
| `image` / `sprite` / `videoActor` | stills, deterministic animation, an actor on a chart |
| `pin` / `channelFlip` | a marker on a chart, a cut between acts |

Two rules govern all of them:

- **A piece is on while its clip is active.** Give a clip an `until` and it turns
  itself off; no piece needs an "exit" cue.
- **Times inside a piece's params are cue references** (`"@card+0.4"`,
  `"@card.end"`), not seconds. They move when the cue moves.

---

## Filming a real app

This is the difference between a trailer and a slideshow: **take the actual
thing**. A recreated UI drifts from the product the week after you film it, and
viewers can tell.

The app is proxied same-origin under `target.basePath` (see
`studio.config.json`), which is what makes it drivable at all — a browser only
lets a page reach into an iframe when the origins match.

```json
{ "piece": "browserFrame", "startPath": "/", "light": true,
  "storage": { "theme": "light" }, "clearStorage": ["intro-played"],
  "actions": [
    { "at": "line:create.start-2", "do": "nav", "path": "/create" },
    { "at": "line:create.start", "do": "click", "selector": "button[aria-label^=\"Add\"]", "waitFor": 4 },
    { "at": "line:create.start+2", "do": "type", "selector": "input[aria-label=\"Search\"]", "text": "hello", "cps": 14 },
    { "at": "line:create.start+4", "do": "clickText", "text": "Continue" }
  ] }
```

**Laws paid for in footage:**

- **Actions run IN ORDER, each after the previous settled.** `at` is the earliest
  an action may start, never a deadline. A fixed schedule fires clicks into a
  page that is still fetching, and the take looks broken while the log looks fine.
- **A disabled control means "not yet", not "not there".** Apps disable buttons
  while they fetch, and a programmatic click on a disabled button fires nothing.
  Clicks poll for an enabled target up to `waitFor` seconds.
- **`clickText` prefers exact, then prefix, then substring**, among visible
  enabled controls — otherwise a stray card containing the same word wins and
  navigates you somewhere else mid-take.
- **Navigate 2 to 3 seconds before the first click** on a lazily loaded page, and
  scroll its heading to the top right after: content above it may be taller than
  you think.
- **Events must be built with the child window's constructor.** A `PopStateEvent`
  constructed in the parent realm is a different class from the one the app's
  router listens for, so navigation silently does nothing.
- **A plain `.value =` write never reaches a controlled input.** Use the native
  setter from the child realm, then dispatch `input`. (The `type` action does.)
- **Write first-run state before the frame mounts** (`storage`, `clearStorage`) —
  that is how you make an intro play, or a banner stay dismissed.
- **Never film an aggregate you cannot vouch for.** A fixture's totals are not
  real numbers; either film real ones or keep them out of frame.

---

## The voice

**Direct the read.** A model that takes direction and is given none reads flat,
and flat is the most common reason a trailer sounds dead. Bracketed directions
(`[warmly]`, `[curious]`, `[excited]`), ellipses for a real pause, CAPS on the
one word carrying the sentence.

**Audition on the line as it will be performed** — tags and all. A candidate
auditioned on plain text is a different performer once directed, and you learn
that after paying for the whole cut.

**Brief for range if you want range.** "Calm, measured, unhurried" gets you
exactly that. `node scripts/cast.mjs --measure` scores each preview's loudness
range, which is a decent proxy for whether a read moves at all.

**Takes.** `"takes": 3` renders three readings of a line in one spend; `"use": 2`
picks which one the splice uses. Changing `use` later re-splices at zero cost.

**The spend laws:** dry run is the default, `--go` is a human, a file that exists
is never re-rendered.

---

## Sound

- **Preroll** gives the picture a moment before the first word; **tail** lets the
  bed round out after the last one.
- **Ducking** steps the bed back under speech. The sidechain is padded to the full
  length — an unpadded one silently truncates the bed at the last word.
- **A bed shorter than the cut is looped with a crossfade.** A plain trim produces
  a short stream and the mix ends at the last word with no error anywhere.
- **Effects are overlaid after the voice and bed are mixed**, so adding one can
  never move a measured cue. Keep them sparse, −8 to −16 dB.
- The recorder normalises loudness at mux time and verifies the result.

---

## Camera

Camera moves are applied by the recorder **at mux time**, never as DOM
transforms — a transform on an ancestor kills any backdrop-filter beneath it.

Two deliberate in-and-out arcs per cut is plenty: about a five-second round trip,
zoom 1.25 to 1.3. **Each out-move must keep its in-move's centre**, or the window
snaps sideways at the boundary. No ambient drift: it reads as a shaky camera, not
as motion. The pan supersamples before zooming, because zoompan rounds its crop
origin to whole input pixels and rattles at native size.

---

## Traps that are not obvious

- **Centre in the inline transform only.** Utility classes that compile to the
  native `translate` property COMPOSE with a transform rather than replacing it,
  so an element centred twice sits half its size off — while a canvas computing
  the same rect from the viewport still draws it centred.
- **Fix a chart's domain from the whole series up front.** Deriving it from the
  points already on screen makes the opening values tower and then shrink: a
  rescale wobble instead of a climb. Invisible in the code, obvious in the frames.
- **Text that types must reserve its final height**, or the card grows mid-take.
- **A sprite is deterministic; a video is not.** Video playback rides wall time,
  so anything on video makes two identical takes differ — which is the noise that
  makes frame comparison useless. If it must be identical, make it a sprite.
- **Zero captured frames looks like a mux error downstream.** The recorder names
  it instead: if it says the browser produced no frames, the page never painted.
- **Do not run two dev servers against one build cache.** The recorder refuses to
  start one for this reason; start it yourself.
- **Verify the artifact, not the log.** The recorder re-probes the file it wrote
  for streams, duration and loudness, because a plausible-looking video that no
  player will open is a thing that ships silently.

---

## Publishing a trailer repo

If your trailers live in a repo you will make public, run `npm run sweep` first.
It reads what git would actually publish and reports absolute machine paths,
credentials, personal addresses, internal hostnames, and internal narrative left
in comments. It changes nothing — it is a last look before a door closes.

Recorded takes and rendered audio are gitignored by default. They are large,
they are regenerable, and a take contains whatever was on screen when it was
filmed.
