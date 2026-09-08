# Working in this repo (for an AI assistant)

You have been dropped into a **trailer stage**: a system that films a running app,
narrates it, and cuts the result to the voice. Somebody wants a video about their
product. Your job is to get them one they are proud of, without spending their
money or their credibility by accident.

Read this file first. It is written for you, but a human can read it too, and
they should be able to check any claim you make against it.

---

## 1. What this thing actually is

A trailer here is **three text files** in `trailers/`:

| file | what it holds |
|---|---|
| `<name>.timeline.json` | the picture: tracks of clips, each clip a piece on the stage at a time |
| `<name>.mix.json` | the sound: narration lines, gaps, a music bed, effects — as a SPEC, not audio |
| `<name>.storyboard.md` | the human read: beats, lines, what it will cost, what to check |

Nothing is a video until somebody runs the pipeline. That is deliberate: text is
cheap to argue with, and video is not.

Two ideas carry the whole system, and if you understand only two things, make it
these:

**The picture is data.** Every clip names a `piece` (a card, a chart, the app in
a browser frame, a logo reveal) and its knobs. One generic renderer plays any
timeline, so you never write a component to make a trailer — you write JSON.
The vocabulary is documented at the top of `src/lib/pieces.ts`. Read it before
you write a single clip.

**Time comes from the voice.** A clip carries an `anchor` — `"line:hook.end+0.4"`
— saying where its time came from. After the narration is rendered, the mix
builder measures where every word actually landed and `resolve-cues` rewrites
every anchored number. So re-recording one line silently re-times everything
that hangs off it. **You never hand-tune a timestamp.** If you find yourself
nudging numbers to make something line up, you have skipped the anchor and you
are about to create work for whoever edits next.

---

## 2. Before you touch anything

Orient in this order. It takes two minutes and it prevents most bad first moves.

```bash
cat studio.config.json          # the project, the app to film, the theme, the voice
ls trailers/                    # what already exists
npm run dev                     # the stage and the studio (leave it running)
npm run sweep                   # what this repo would publish
```

Then read `src/lib/pieces.ts` (the vocabulary) and `docs/MANUAL.md` (the craft:
the method, the laws, the traps that have cost real takes).

**If `trailers/example.timeline.json` exists, read it.** It is a complete, working
trailer and it will teach you the shape faster than any description.

---

## 3. What to ask the person — before you write anything

This is the part most likely to be skipped and most likely to waste a day. A
trailer is a claim about somebody's product, in their voice, that they will show
to their customers. You cannot infer that from a codebase.

Ask these in one message, grouped, with your own proposed answer next to each so
they can just say "yes, except…". Do not ask them one at a time.

**The story — the only truly required answers**

1. **Who is watching, and what should they do or believe afterwards?** ("a
   developer evaluating us should understand it works with their existing stack")
2. **What is the ONE thing this trailer must land?** If they name three, ask which
   one survives if the other two are cut.
3. **How long, and where does it go?** A 30-second autoplay loop on a landing page
   and a 2-minute explainer for a docs page are different films.
4. **Is there anything that must NOT appear on screen?** Unreleased features,
   customer names, real balances or accounts, pricing that is not final, a
   teammate's face in a screenshot. **Ask this every time.** It is the question
   that prevents the unrecoverable mistake.

**The picture**

5. **Can I film the real app?** If yes: what URL is it on, and does it need a
   login, seeded data, or a feature flag? (Set `target.url` and
   `target.storage`.) If it needs a real account or real money to look right, say
   so now — filming a login wall is a waste of everyone's time.
6. **What state should it be in?** A demo account, a fixture mode, a specific
   dataset. Anything on screen that is invented must be visibly labelled as an
   example — see the honesty law below.
7. **Brand:** logo file, wordmark, colours, fonts. Or "read them off the app" — in
   which case put them in `studio.config.json` yourself and show them the result.

**The voice**

8. **Do they have a narrator, or should you audition one?** If auditioning:
   who is talking — warm and plain, dry and precise, big and theatrical? Give
   them two or three sentences of description to react to, not an open question.
9. **Do they want captions?** (Most feeds play muted; captions are a flag on the
   recorder, not a rewrite.)

**The money and the sign-off**

10. **Who approves the cut, and who authorises the spend?** Rendering narration
    and music costs real money on their account. Get an explicit yes before the
    first `--go`, tell them roughly what it will cost, and never re-render
    something that exists.

If they cannot answer something, these defaults are safe: no music bed, no
effects, no camera moves, captions off, the theme from their app, one voice
audition round before committing. These are NOT safe to assume: what may be shown
on screen, whether the numbers are real, and whether they want to spend anything.

---

## 4. The loop you run

```bash
# 1. Compile a brief into a trailer. Text only: nothing renders, nothing spends.
npm run draft -- brief.md --name my-trailer --project ../their-app

# 2. Read the storyboard yourself before showing it. Then show it and get a yes.
cat trailers/my-trailer.storyboard.md

# 3. Dry run: prints every render it would pay for, and stops.
npm run trailer -- my-trailer

# 4. The human's click. Renders, builds the mix, re-times from the measured
#    audio, records, compares against the approved take.
npm run trailer -- my-trailer --go

# 5. Look at the frames. Then let them watch it.
npm run critic -- my-trailer      # optional: a ranked defect list from the stills
npm run review                    # the board: every trailer, newest take, approve button
```

`--project` accepts a directory or a git URL (it clones shallow). It builds a
capped, redacted digest — README, structure, routes — so the trailer talks about
the real product. Run `--print-digest` first if the codebase is sensitive: it
prints exactly what would be sent and exits.

**Editing a cut.** Do not rewrite the timeline by hand.

```bash
npm run draft -- notes.md --edit my-trailer --stills 12
```

The notes can be as loose as "at fourteen seconds the logo lands too early, and
the second line should be warmer". It gets the current files, the measured cue
map and the take's stills, and returns a revised set. **Lines whose words did not
change keep their audio**, so a re-render only pays for what actually changed.

---

## 5. Laws you do not break

**Money.** `--go` is the only thing that spends, and it belongs to the human. A
file that exists is never re-rendered. Never put a render behind a watcher, a
retry loop, or a "while I'm here". If a step failed after the spend, fix the
step — do not re-render to make the error go away. Generated footage (the
`footage` piece) is a spend like narration: the dry run prices every missing shot
in dollars, `--go` renders it under four caps (per run, per shot, per month, and
the age of the price table) after the request has been validated against the
provider's own schema, and each shot leaves a provenance sidecar and a ledger
row. Tell the person the figure before they click. Run `npm run footage:test` and
a `--mock --go` before the first real shot on any new key or endpoint. Closing a
rendered shot into a loop (`npm run loop`) is free and never re-renders: it reads
the master and writes beside it.

**Approval.** You never approve a take. Approval is a button on the review board,
pressed by a person. It writes the golden that every later take is compared
against.

**Publishing.** You do not push, post, deploy or share anything outward. You
prepare it and hand over the command.

**Honesty on screen.** Anything invented must be visibly labelled as an example.
Never show a fabricated number, balance, review, or customer as though it were
real — not "just for the demo". If the brief asks for a screen you cannot produce
honestly, say so and offer the honest version instead. Generated footage depicts
the world around the product, never the product and never a real or recognisable
person; a cut that contains any of it carries the endCard chip "Contains
AI-generated footage" (the compiler's check insists).

**Characters (Colby, 2026-09-08, a strict rule).** No video generation with a character
before its character bible is approved. A "normal-looking" person is re-invented by the
model every shot and is refused by fal's likeness checker as a reference image, as a
first frame and inside a reference video; a DESIGNED character with unmistakable costume
features (the explorer's helmet, moustache and monocle) holds and passes. So: design the
character with three or four unmistakable features, draw a turnaround with an image model
(front, three-quarter, profile, back, the seated pose, the action pose; front first, the
rest referencing it), get the sheet APPROVED by the person, run one probe shot, and only
then the film: as few and as long shots as the story allows (Seedance 2.0 takes 4 to
15 s; a shot never drifts inside itself, every cut is where drift happens), each shot
starting from the previous shot's last frame so the joins are shared frames. A brief that
names a character without a link to its approved sheet is not ready to compile. **Continuity laws
that ride with the gate (Colby, the same evening, after round three):** (1) A chained join carries
the character: the last frame of a shot must show him fully, body and costume, or the next shot has
nothing to hold and he changes build; direct every shot so he is still in frame at its end. (2) One
of each prop, and its state named at the start and the end of every shot; a prop is in hand or set
down in its own clear beat; the set plate must not contain a prop the character holds (the model
spawns a second one); negatives name "a second can, duplicate props, floating objects". (3)
Entrances obey physics: anything that enters walks in from off-frame or from behind cover along a
path; nothing grows, fades or slides into place; negatives name "scaling, morphing, appearing".
(4) Body type is in the bible and in every prompt (build, height, weight). (5) Anything that is
"in the world" on the stage (a portfolio haunting the trees) is chrome-less, blended and blurred
into the scene's depth, never a UI panel; UI chrome only for actual UI. (6) The script is approved
by the person before compile, like the character. **Ten more, enforced (Colby, 2026-09-08, "enforce all
of these"), in `scripts/footage/laws.mjs`:** the compiler refuses a draft that uses two generators
or lacks a shared `footage.look` paragraph copied verbatim into every shot; the builder appends the
standard negative list to every shot (text, logos, real people, celebrity likeness, duplicate props,
floating objects, extra limbs, warped hands, morphing, scaling, appearing, jump cuts); the compiler
warns past one beat every two seconds of a shot; a chained shot (refs/chain/<prev>-last.png) renders
only after the previous shot and its contact sheet exist (the builder writes <clip>.sheet.jpg after
every render; `--sheet <clip>` remakes one); effects and beats anchor to measured events
(`events: { pop: 2.2 }` on the footage clip → the cue `@<clip>.pop`); a 1080p render needs a 480p
probe of the shot first (`--probe`, about 27 cents; `--allow-unprobed` is the explicit override);
every shot but the last carries the `footage.handoff` sentence and every shot the `footage.physics`
paragraph, verbatim; the camera sentence comes first and names one behaviour; and no prompt has
anyone say, shout or mouth a word. The sheet is for the
person's approval and for the WORDS; the generator itself is handed only the face-free angles
(the back view) plus the set plate, because fal's checker refused even a designed character's
front, three-quarter and seated views (hat and glasses on) on 2026-09-08. Identity across the few
shots then rides the costume, so design costume features the model cannot miss.

**Determinism.** No `Date.now()`, no `Math.random()` anywhere in a timeline.
Seeded generators only. If a retake is not the same take, the frame comparison
that proves an edit changed one thing is worthless — and that comparison is the
only thing standing between "I fixed the caption" and "I also broke the chart".

**Look at the frames.** Every recording extracts one labelled still per cue. Read
them before you call a take good. A log cannot see a caption sitting on a logo.
Most defects in this system's history were found in a still and invisible
everywhere else.

---

## 6. When something goes wrong

| symptom | what it actually is |
|---|---|
| the take is mostly static, tiny file | the picture never moved: check the beats have anchors and the clips have `until` |
| a click in the app did nothing | it fired before the app was ready. Actions run in order and poll; a DISABLED control means "not yet", so give it `waitFor` |
| a click hit the wrong thing | `clickText` prefers exact over prefix over substring — pass a longer string, or `within` a container |
| the cut fades before the last word | `blackoutAnchor` / `endAnchor` are missing, so the edges never re-timed |
| a beat drifts after re-rendering a line | that clip has a hard number instead of an anchor |
| "nothing answers at localhost:3000" | start `npm run dev` yourself; the recorder will not start a server (two dev servers on one build cache corrupt it) |
| ffmpeg missing | `npm i -D ffmpeg-static`, or `FFMPEG_PATH=…` |
| no API key | everything except rendering works without one; say so rather than stalling |
| a shot shows a striped plate with a prompt on it | that footage is not rendered yet: `npm run footage -- <n>` prices it, `--go` renders it; a plate in a take is not a defect, it is an unpaid shot |
| a footage shot freezes before its clip ends | by design when the file is shorter than the span; ask for more `seconds`, or accept the freeze as the beat it is |
| a `<shot>.pending.json` sits beside a missing shot | a previous run submitted that render and never fetched it; the next `--go` fetches it without paying again (`--resubmit` pays again on purpose) |
| "another footage builder holds the lock" | two builders on one trailer; wait for the other, or remove `.footage/<n>/.lock` if that process is gone |
| "request rejected by …'s schema" | the render block asks for something the endpoint does not offer (a resolution, a duration, too many references); `--check` prints the conformed request — fix the block, not the schema |
| "the price table is N days old" | prices in this market move monthly; re-verify `scripts/footage/models.mjs` against the providers' pages, or pass `--accept-stale-prices` knowingly |

---

## 7. What to hand back

When you have something to show, give them: **the file path of the take**, the
review board URL, what it cost, what you are unsure about, and the one or two
decisions you had to make on their behalf. Name anything you invented and
anything you could not verify.

If you changed how the system works — a new piece, a new law learned from a
defect — write it down in `docs/MANUAL.md`, in the section it belongs to. Put the
LAW in, not the war story: "a disabled control means not-ready, so poll" helps a
stranger; "this cost us an afternoon on Tuesday" does not.
