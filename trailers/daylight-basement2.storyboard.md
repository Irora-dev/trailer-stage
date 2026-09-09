# daylight-basement2 — storyboard

> status: draft · compiled by scripts/draft.mjs from `briefs/daylight-basement2.md`
> Times are ESTIMATES (14 characters/second, plus 0.6s per direction) until the mix is built.
> Every clip carries its narration anchor, so `npm run trailer -- daylight-basement2 --go` renders, builds and re-times everything from the measured audio.

**A wildlife documentary about the retail investor: a young man scrolls a green line on a log in a pine forest, a grizzly reads over his shoulder, and the only thing that saves him is opening Daylight before he walked in.**

## Beats

| est. | anchor | you see | you hear |
|---|---|---|---|
| 0.5s | `line:open.start-1.5` | Wide, locked off: the young man hunched on the fallen log in the golden pines, scrolling, reaching for the can without looking up. | Low ominous strings and a slow timpani pulse, then the narrator, warm and documentary. |
| 7.5s | `line:open.start+5.5` | Insert, 85 mm over his shoulder: the phone showing the example portfolio app, green total, green chart, one thumb scroll. | The bed holds under the second half of the open line. |
| 14.6s | `line:roar.start-0.3` | Medium three-quarter: he freezes mid-sip as a grizzly rises behind him and leans over his shoulder to read the phone; he scrolls one more beat, then turns. | A deep grizzly roar at minus ten dB on the line's first word, then a beat of picture with no words. |
| 22.0s | `line:chase.start-0.2` | Lateral track: the can drops, he sprints down the path still staring at the phone, bear crashing behind; the ghost portfolio card fades in among the trees on the right. | Tension riser and driving percussion; the narration dry over the top. |
| 25.4s | `line:chase.start+3.2` | The ghost portfolio flips to its fallen state: total red, today minus forty-one percent. | The word FORTY carries the line. |
| 29.0s | `line:chase.start+6.8` | Running at camera, handheld: he checks the phone, looks back, clips a low branch and keeps going. | Percussion at its hardest. |
| 33.7s | `line:daylight.start-0.3` | He skids to a halt and holds the phone out like a badge; over his shoulder the small screen is the real Daylight home; the bear slows, puzzled. | The score lifts; the narrator brightens. |
| 38.9s | `line:daylight.start+4.9` | Cut to the dark stage: the example $ACORN read banner alone, headline red, three readings arriving. | A held string chord under the list of what Daylight reads. |
| 44.4s | `line:daylight.end-3` | Wide, locked off: the bear lunges and bursts into a cloud of paper confetti raining through the sunbeams; he blinks, picks a piece off his hoodie, resumes scrolling. | A balloon pop and fluttering paper at minus six dB on the last word, then a heroic brass fanfare. |
| 51.6s | `line:close.start+3.4` | Channel flip to the stage: the Daylight mark arrives, wordmark, plate, powered by Blocktronics; one slow push in and back out. | Fanfare resolving into one wry final chord. |
| 54.9s | `line:close.end-0.6` | End card: DAYLIGHT, the on-chain survival kit, the line, and the two chips including the AI-footage disclosure. | The dry last clause, then tail. |

## Narration — 5 lines, 682 characters

- **open** (2.0s → 14.7s, est.) [warmly, a wildlife documentary] Behold the retail investor in his natural habitat. He has done his research... by which we mean he has looked at a green line and FELT something.
- **roar** (14.9s → 18.7s, est.) [mildly interested] Ah. The market would like a WORD.
- **chase** (22.2s → 33.4s, est.) [dry] Observe the technique. Run first, check the portfolio second. Down four percent. Down twelve. Down FORTY. Still holding, though. Tremendously brave.
- **daylight** (34.0s → 47.4s, est.) [brightening] And then... a thought. Quite possibly his first today. He opens Daylight: who holds this thing, who is quietly leaving, what they paid for it. All of it readable BEFORE the forest.
- **close** (48.2s → 55.5s, est.) [confident] Daylight. Understand the market you are walking into. [dry] The bear was never the PROBLEM.

## Sound

- bed: RENDER 55s — "Mock-epic cinematic trailer score played completely straight: low ominous strings and a slow timpani pulse over a hushed opening, a taut tension riser and driving percussion through a chase, a triumphant heroic brass fanfare at the release, then one wry final chord; orchestral, instrumental, no vocals, film-trailer production, clean and spacious"
- bed -1 dB · duck 7 dB · preroll 2s · tail 3s
- sfx **roarSfx** at `line:roar.start`: "a deep grizzly bear roar in a forest, close, natural reverb" (2s, -10 dB)
- sfx **popSfx** at `line:daylight.end`: "a single loud balloon pop followed by fluttering falling paper confetti" (2s, -6 dB)

## On stage

- **Generated shots** (footage): shotLog·footage, shotPhone·footage, shotRoar·footage, shotBolt·footage, shotRun·footage, shotBadge·footage, shotPop·footage
- **Data over the forest** (data): ghost·card, read·card
- **Reveal and close** (close): flip·channelFlip, mark·logoReveal, markUp, wordmark, plate, powered, endcard·endCard
- **Captions** (captions): cap-open·caption, cap-roar·caption, cap-chase·caption, cap-daylight·caption, cap-close·caption
- **Beats** (beats): ghostDrop, confetti
- **Narration lines** (lines): __line-open, __line-roar, __line-chase, __line-daylight, __line-close

## Check these on the cue stills

- Silent draft first: set mix to null, record the cut with footage plates and judge the anchors before any spend.
- No footage prompt may begin with an at-sign reference: the resolver reads a leading @ as a TimeRef. Shot one now opens with 'The location is exactly @Image1'.
- Shot order matters. Render shotLog ALONE and approve it, then copy it to .footage/daylight-basement2/refs/style/kid-live.mp4 as @Video1 before rendering shots two to seven. It defines the face, so nothing else may render first.
- NO FACE IN ANY REFERENCE: @Image1 is the empty log plate, @Image2 is a real app screenshot, @Video1 is the film's own shot one. No photoreal face is ever handed to fal's checker.
- Resolution is 1080p per the brief (stunning live-action realism, hero cut), not the usual 720p; one model only, bytedance/seedance-2.0/reference-to-video. Budget roughly fifty generated seconds across seven shots, about thirty-three dollars, plus narration, two effects and one bed render. Use --parallel 4.
- Every footage clip is generated about one second longer than its span, hold is freeze so a re-timed line reads as a beat rather than a jump.
- Every number on screen is labelled as an example: the ghost portfolio's sub says so, and the read card says an example token, invented for this trailer.
- The endCard carries the Contains AI-generated footage chip; do not remove it, draft --check fails without it.
- Camera: one arc only, on the stage close after the last footage clip ends. No stage camera move over any generated shot.
- Reference paths must exist on disk before --go: .footage/daylight-basement-world/styles/empty-log.png, .footage/daylight-basement/refs/app/portfolio.png, .footage/daylight-basement/refs/app/daylight-home.png.
- The gap after the roar line is deliberately long (three and a half seconds) so the bear-reads-the-phone beat plays in silence; check it after the mix is measured and trim if the shot freezes.

## Next

```
npm run trailer -- daylight-basement2          # dry run: lists every render it would pay for
npm run trailer -- daylight-basement2 --go     # the human click: render, build, re-time, record
```

## The brief, verbatim

```
# Brief — Daylight: the basement bull and the bear (round two)

> Round two after Colby's notes on take 3 (2026-09-08 ~18:45): Seedance only, with NO face in any
> reference (fal's checker refuses a photoreal face as a reference or first frame); fewer and longer
> shots; a funnier, more dramatic score instead of the newsreel bed; a sharper script; broader,
> funnier action. Estimated spend: 7 generated shots, 48 generated seconds ≈ $33 at 1080p on
> Seedance 2.0 reference-to-video, plus narration, two effects and one music render (cents to a few
> dollars). Colby's recording: `ledger/2026/W37/2026-09-08/1639-daylight-bear-chase-trailer-concept/transcript.md`.

## Who is watching, and what they should believe afterwards
Crypto-native people on X and in Daylight's community, most of them closer to the young man in this
film than to the explorer of the last one. Afterwards they should believe: buying a token without
reading who holds it, who is leaving and what they paid is walking into a forest with a bear in it,
and Daylight is the thing you open BEFORE you walk in. Funny first, useful second.

## The one thing to land
The gag: a twenty-two-year-old in a hoodie, energy drink at his side, sits on a log in a forest
scrolling a portfolio that is, he is sure, going up. A bear rises behind him and peers at the phone
too; he does not notice for a beat. He runs, still staring at the phone, while a ghost of the
portfolio in the trees falls with him. He stops, holds the phone out like a badge and opens
Daylight; the bear, mid-lunge, bursts into confetti with a balloon pop; he blinks, picks confetti
off his hoodie... and goes straight back to scrolling. The narrator plays it as a wildlife
documentary about the retail investor: omniscient, dry, faintly exasperated, never winking.

## Length and venue
About 45 to 50 seconds. 16:9, 1080p, an autoplay-with-sound post on X; a 9:16 cut later. Captions
on. Stunning live-action realism; the comedy lives in the staging, the timing and the narration.

## The shot list
Seven generated shots and the brand; each shot holds for 3 to 8 seconds on the cut and is generated
one second longer than its cut. Light continuity in every prompt: late golden hour in a dense pine
forest, the low sun flaring between the trunks from behind and to the left, warm rim light, dust and
pollen in the light, a faint glimpse of snow-capped mountains between the trees.

| # | shot (intent) | camera | on the cut | generate | under line |
|---|---|---|---|---|---|
| 1 | The log: the young man sits hunched on the fallen log beside his can, scrolling with his thumb, utterly absorbed; without looking up he reaches for the can, takes a long sip, puts it back and keeps scrolling with a small satisfied smirk | locked-off 35 mm, no move | 6 s | 7 s | open |
| 2 | Insert over his shoulder: the phone screen shows EXACTLY @Image2 (a generic dark portfolio app, a green total and a green chart); his thumb scrolls; nothing on the screen that is not in @Image2 | 85 mm, shallow focus, static | 3 s | 4 s | open end |
| 3 | The roar: a deep roar off screen; he freezes mid-sip, eyes dart sideways; behind him, between the trunks, a huge brown bear rises to full height and leans over his shoulder to look at the phone too; he keeps scrolling for a beat, then slowly turns his head and sees it | locked-off 50 mm medium, three-quarter | 7 s | 8 s | roar |
| 4 | The bolt: the can drops from his hand to the needles, he scrambles off the log and sprints down the forest path STILL staring at his phone, hoodie flapping, the bear crashing after him through the undergrowth | lateral track alongside, 35 mm | 7 s | 8 s | chase (the ghost portfolio enters among the trees) |
| 5 | Running at camera: arms pumping, he glances at the phone in panic, then over his shoulder; he clips a low branch with his shoulder and keeps going; the bear a huge shape behind him | 50 mm, handheld running backwards | 5 s | 6 s | chase end (the ghost portfolio's numbers have fallen) |
| 6 | The stop: he skids to a halt, spins to face the bear and holds the phone out at arm's length like a badge, gasping, his thumb stabbing the screen; over his shoulder the small screen shows EXACTLY @Image2 (the Daylight app); the bear slows, puzzled | 50 mm, handheld | 5 s | 6 s | daylight |
| 7 | DATA: the Daylight read card, alone on the dark stage (see Picture) | stage | 3 s | | daylight middle |
| 8 | The pop: the bear lunges from two metres with a roar; at the instant of the lunge it bursts into a dense cloud of multicoloured paper confetti; the confetti hangs in the sunbeams and rains down over him; he stands blinking, lowers the phone, exhales, picks a piece of confetti off his hoodie... and goes straight back to scrolling | locked-off 35 mm wide | 8 s | 9 s | daylight end into close |
| 9 | STAGE: channel flip → logo reveal → end card with the chips | stage | 5 s | | close |

Coverage: the log scene has a wide (1), an insert (2) and a medium (3); the chase a wide (4) and a
medium (5); the payoff a medium (6), the card (7), a wide (8). One camera move at most per shot; no
stage camera over footage. Fewer cuts on purpose: every shot plays long enough to land its joke.

## Narration
The Daylight narrator is PINNED in the config: The Clipped Newsreel, a brisk cut-glass 1940s British
newsreel voice, the Stanley Parable x crypto register: omniscient, dry, faintly exasperated, treats
the viewer as a character; the formality IS the joke, never wink at it. Five lines with ids.
Bracketed performance tags, an ellipsis for a real pause, ONE word in CAPS per line, every number as
words, no em dashes anywhere.

- **open** — "[warmly, a wildlife documentary] Behold the retail investor in his natural habitat.
  He has done his research... by which we mean he has looked at a green line and FELT something."
- **roar** — "[mildly interested] Ah. The market would like a WORD."
- **chase** — "[dry] Observe the technique. Run first, check the portfolio second. Down four
  percent. Down twelve. Down FORTY. Still holding, though. Tremendously brave."
- **daylight** — "[brightening] And then... a thought. Quite possibly his first today. He opens
  Daylight: who holds this thing, who is quietly leaving, what they paid for it. All of it readable
  BEFORE the forest."
- **close** — "[confident] Daylight. Understand the market you are walking into. [dry] The bear
  was never the PROBLEM."

Shots 1 and 2 under open; 3 under roar; 4 and 5 under chase; 6 and 7 under daylight; 8 from the
end of daylight into close; 9 under close. The confetti pop lands on the end of the daylight line.

## Picture: what is filmed, what is generated, what is data
- **GENERATED FOOTAGE for shots 1 to 6 and 8.** EVERY shot on `bytedance/seedance-2.0/reference-to-video`,
  1080p, 16:9, `audio: false`, single takes, `seconds` as the shot list says. No other model: Kling
  made round one look soft and stiff.
- **NO FACE IN ANY REFERENCE. THIS IS THE LAW OF THIS PIECE.** fal's checker refuses any photoreal
  human face handed as a reference image or first frame ("likenesses of real people"). So the
  character exists only in words and in the film's own first shot:
  - Every shot names `.footage/daylight-basement-world/styles/empty-log.png` as @Image1: the exact
    log, can, forest and light, with nobody in it.
  - Shot 2 adds `.footage/daylight-basement/refs/app/portfolio.png` as @Image2; shot 6 adds
    `.footage/daylight-basement/refs/app/daylight-home.png` as @Image2 ("the screen shows EXACTLY
    @Image2; nothing on the screen that is not in @Image2"; small in frame, cut fast).
  - Shots 2 to 6 and 8 name `.footage/daylight-basement2/refs/style/kid-live.mp4` as @Video1: the
    film's own shot 1, copied there once it is rendered and approved ("the same young man as in
    @Video1, the same hoodie, hair, headphones, can and light"). Shot 1 is rendered FIRST, alone.
  - **THE CHARACTER, in words, in every prompt:** "a twenty-two-year-old man: pale, unremarkable,
    forgettable face, greasy dark hair falling over his eyes, faint stubble, an oversized black
    hoodie, big black headphones round his neck, baggy grey joggers, scuffed white sneakers; beside
    him a matte black energy drink can with a plain green stripe, no logo".
- **THE LOOK (copied into every prompt):** live-action documentary realism, shot on a full-frame
  cinema camera, 35 mm for wides, 50 mm for mediums, 85 mm for the insert, handheld where named,
  natural skin and fabric, real dust and pollen in the light, subtle lens flare from the low sun
  between the trunks, fine film grain, true-to-life colour. Late golden hour in a dense pine forest,
  the sun behind and to the left, warm rim light, a faint glimpse of snow-capped mountains.
- **THE BEAR** is a huge brown grizzly, real fur and mass, comic in behaviour only (it peers at the
  phone, it lollops, it looks puzzled, it lunges, it pops); never bloody, never touching him.
- **DIRECT BROAD ACTIONS ONLY.** The can is on the log or in his hand for a whole shot, or dropped in
  its own clear beat (shot 4). The phone stays in his hand from shot 3 onward. Broad slapstick only:
  the sip without looking, the bear reading over his shoulder, running while scrolling, clipping a
  branch, the badge pose, the confetti, the return to scrolling.
- **DATA: the ghost portfolio** is a stage `card`, never generated: opacity 0.45 (a translucent
  ghost, a little bolder than round one), about 34vw × 30vh, centred among the trees on the right
  (leftVw about 74, topVh about 34), header identity "Portfolio" with sub "an example, invented for
  this trailer", headline "$4,812.40" (green) with altText "$2,839.10" (red), stats "Today" value
  "+4.6%" altValue "−41.0%" tone accent; `altAt` early in the chase line; enters on shot 4, exits
  before shot 6.
- **DATA: the Daylight read** (shot 7) is a stage `card` alone on the dark stage: a banner about
  66vw × 26vh centred, identity "$ACORN read" with sub "an example token, invented for this
  trailer", headline "Should you touch it? No." in red, stats "Holders in profit 91%", "Bundled
  supply 38%", "Top wallets leaving 6 in the last hour". Give it an explicit height.
- **The end card** (shot 9): the Daylight mark, wordmark DAYLIGHT, plate "the on-chain survival
  kit", the line "Understand the market you are walking into.", chips "Contains AI-generated
  footage" and "Example portfolio and tokens, not investment advice".
- **Negative prompt on every shot:** "text, logos, brand names, cartoon, animation, illustration,
  CGI look, plastic skin, warped hands, extra limbs, real people, celebrity likeness, blood, gore,
  explorer hat, moustache".

## Sound
- **Bed: RENDER, not the newsreel file.** A mock-epic cinematic trailer score played completely
  straight, so the comedy comes from the excess of seriousness against the snark: low ominous
  strings and a slow timpani pulse under the log scene, a taut tension riser and driving
  percussion through the chase, a triumphant heroic brass fanfare at the release, a wry final
  chord; instrumental, no vocals, film-trailer production, clean and spacious, about fifty seconds.
  Bed gain modest, ducked under the narration.
- Two effects only: a deep grizzly bear roar at the start of the roar line (render prompt "a deep
  grizzly bear roar in a forest, close, natural reverb", about 2 s, minus ten dB) and a single
  balloon pop with a soft paper flutter at the end of the daylight line, on the confetti (render
  prompt "a single loud balloon pop followed by fluttering falling paper confetti", about 2 s,
  minus six dB).

## Brand facts
Daylight is the on-chain survival kit. Powered by Blocktronics. It reads who holds a token, who is
quietly leaving, how much of the supply sits in bundled wallets, and what the holder base paid,
before you buy. Mark: `/local/daylight-logo.svg`, wordmark DAYLIGHT, plate "the on-chain survival
kit". Footer truth in the app: "your wallet signs everything · not financial advice".

## What must never appear
A photoreal face in any reference (the checker); real people or recognisable likenesses; real brand
names or logos (the energy drink is generic, the portfolio is an invented example); real tokens as
real; unreleased features; on-screen text or logos inside generated shots (the only exception is
the real app screenshots handed as references); blood or gore; the explorer or his hat and moustache.
```
