# daylight-basement — storyboard

> status: draft · compiled by scripts/draft.mjs from `briefs/daylight-basement.md`
> Times are ESTIMATES (14 characters/second, plus 0.6s per direction) until the mix is built.
> Every clip carries its narration anchor, so `npm run trailer -- daylight-basement --go` renders, builds and re-times everything from the measured audio.

**A young man checks his portfolio on a log in a pine forest, a grizzly introduces itself, and the only thing that stops the chase is opening Daylight before you walk in.**

## Beats

| est. | anchor | you see | you hear |
|---|---|---|---|
| 2.5s | `line:open.start` | Wide 35 mm: the young man hunched on a fallen log in a golden-hour pine forest, thumb scrolling, the plain can beside him. Cut to a 50 mm medium of the sip and the smirk, then an 85 mm insert of the phone showing the real portfolio screenshot handed as a reference. | Bed comes up under the first line; the narrator introduces him like a nature documentary. |
| 16.4s | `line:roar.start` | 85 mm close: he freezes mid-sip, eyes sideways, the can lowering. Then a locked 35 mm wide as the grizzly rises to full height in the sunbeams behind him. | A deep grizzly roar lands just under the line at minus ten dB; the narrator is merely mildly interested. |
| 20.7s | `line:chase.start` | Handheld 50 mm: the can drops, he bolts. Wide lateral track of the sprint, and the ghosted Daylight-styled portfolio card fades in among the trees at right, an invented example. Insert of the bear's paws, then a 50 mm medium of him running at camera as the ghost card's numbers turn red. | Bed pushes; the narration counts the fall, four, twelve, forty. |
| 35.8s | `line:daylight.start` | Handheld 50 mm: he skids, yanks the phone up, thumb on the gold button (real Daylight screenshot as reference). 85 mm insert of the read of the token filling the frame. Then a locked wide: the lunge, and the bear bursts into confetti. | A balloon pop and fluttering paper on the burst at minus six dB, landing at the end of the line. |
| 48.1s | `line:close.start` | 85 mm close: confetti falling, one disbelieving laugh. Channel flip into the Daylight mark, wordmark, plate and powered line, then the end card with the two chips. | The close, dry and certain, then the bed rounds out over the end card. |

## Narration — 5 lines, 709 characters

- **open** (2.5s → 15.9s, est.) [warmly] Behold... a young man in his natural habitat. A forest, a log, an energy drink, and a portfolio he has checked eleven times since breakfast. All of it, he assures us, is going UP.
- **roar** (16.4s → 20.1s, est.) [mildly interested] Ah. That... would be the MARKET.
- **chase** (20.7s → 35.3s, est.) [dry] Observe the portfolio keeping him company as he runs. Down four percent. Down twelve. Down FORTY. He has not looked at it once, which is, in fairness, the first sensible thing he has done all day.
- **daylight** (35.8s → 47.6s, est.) [brightening] And then... an idea. He opens Daylight. Who holds this token. Who is quietly leaving. What they paid for it. Everything he might have read BEFORE the forest.
- **close** (48.1s → 54.7s, est.) [confident] Daylight. Understand the market you are walking into... BEFORE it introduces itself.

## Sound

- bed: RENDER 45s — "Cheeky vintage newsreel underscore, warm radio-band character: plucked upright bass, brushed kit, a sly muted trumpet motif, light orchestral swell under the payoff, unhurried then quietly urgent, instrumental, no vocals, clean and spacious"
- bed 1.5 dB · duck 5 dB · preroll 2.5s · tail 3s
- sfx **roarSfx** at `line:roar.start-0.3`: "a deep grizzly bear roar in a forest, close, natural reverb" (2s, -10 dB)
- sfx **popSfx** at `line:daylight.end-0.9`: "a single loud balloon pop followed by fluttering falling paper confetti" (2s, -6 dB)

## On stage

- **Generated shots** (footage): s1Wide·footage, s2Sip·footage, s3Screen·footage, s4Freeze·footage, s5Bear·footage, s6Bolt·footage, s7Run·footage, s8Paws·footage, s9AtCam·footage, s10Open·footage, s11Read·footage, s12Pop·footage, s13Laugh·footage
- **Ghost portfolio** (data): ghost·card
- **Reveal & close** (close): flip·channelFlip, mark·logoReveal, markUp, wordmark, plate, powered, endcard·endCard
- **Captions** (captions): cap1·caption, cap2·caption, cap3·caption, cap4·caption, cap5·caption
- **Beats** (beats): canDrop, ghostFall, confettiPop
- **Narration lines** (lines): __line-open, __line-roar, __line-chase, __line-daylight, __line-close

## Check these on the cue stills

- Spend: thirteen Seedance 2.0 reference-to-video shots at 1080p, sixty-one generated seconds in total, roughly forty-one dollars, plus five narration lines and two effects. Nothing renders until a human runs the pipeline with --go.
- Shoot shot one FIRST and check it. Once approved, the pipeline should add its frames and the shot itself to the reference set of every later shot as identity and light; the brief names @Image1 (kid.png) on all thirteen so the cut is renderable as written.
- Real screenshots are references, never generated text: refs/app/portfolio.png (shot three), daylight-home.png (shot ten), daylight-read.png (shot eleven). Each prompt says the screen shows EXACTLY @Image2 and nothing that is not in it.
- No stage camera moves: every frame under the narration is footage, and a zoompan over generated video reads as a wobble. Camera array is deliberately empty.
- The bed in the brief is an existing file (ledger W31 wave4-cheeky bed-b-radio.mp3). The prompt here describes the same character in case a fresh render is preferred; point the mix at the file to spend nothing.
- Every invented number is labelled: the ghost card's sub reads 'an example, invented for this trailer' and the end card carries 'Example portfolio and tokens, not investment advice'.
- Disclosure chip 'Contains AI-generated footage' is on the end card, as the draft check requires.
- Timing is estimated from word counts. After the mix is built, run resolve --write; the footage spans will re-time and each shot is generated with margin, so a fraction of freeze at the tail of a shot reads as a beat.
- Plan the 9:16 cut from the same anchors: the ghost card at leftVw seventy-four will need moving to about fifty and lower in frame.

## Next

```
npm run trailer -- daylight-basement          # dry run: lists every render it would pay for
npm run trailer -- daylight-basement --go     # the human click: render, build, re-time, record
```

## The brief, verbatim

```
# Brief — Daylight: the basement bull and the bear

> Estimated spend: 13 generated shots × about 4.6 s ≈ 60 s ≈ $41 at 1080p on Seedance 2.0, plus
> narration and two sound effects (cents). Live action, one generator, one look. Colby's recording:
> `ledger/2026/W37/2026-09-08/1639-daylight-bear-chase-trailer-concept/transcript.md`.

## Who is watching, and what they should believe afterwards
Crypto-native people on X and in Daylight's community, most of them closer to the young man in
this film than to the explorer of the last one. Afterwards they should believe: buying a token
without reading who holds it, who is leaving and what they paid is walking into a forest with a
bear in it, and Daylight is the thing you open BEFORE you walk in. Funny first, useful second.

## The one thing to land
The gag: a twenty-two-year-old in a hoodie, energy drink at his side, sits on a log in a forest
scrolling a portfolio that is, he is sure, going up. A bear roars. He runs, and as he runs a faint
ghost of his portfolio hangs among the trees behind him, the number and the percentage falling as
the bear gains. He stops, opens Daylight, sees everything about the token he was about to buy,
and the bear, mid-lunge, bursts into confetti with a balloon pop. The narrator is the Stanley
Parable register: omniscient, snarky, faintly exasperated, treating the viewer as the character.
The close turns the joke into the product: understand the market you are walking into.

## Length and venue
About 32 to 36 seconds. 16:9, 1080p, an autoplay-with-sound post on X; a 9:16 cut later. Captions
on. Stunning live-action realism with no cheap frame anywhere; the comedy is in the timing and the
narration, never in the picture looking silly.

## The shot list
Every shot is generated footage unless marked STAGE or DATA. Generated at 4 to 6 s, used for the
span its anchor gives it (2 to 4 s). Lens and camera named per shot; light continuity in every
prompt: late golden hour in a dense pine forest, the low sun flaring between the trunks from behind
and to the left, warm rim light, dust and pollen in the light, a faint glimpse of snow-capped
mountains between the trees.

| # | shot (intent) | camera | on the cut | under line |
|---|---|---|---|---|
| 1 | Wide: the young man (@Image1: the same person, hoodie, hair, face, the plain energy drink can on the log beside him) sits hunched on a fallen log in the forest, thumb scrolling his phone, absorbed | locked-off 35 mm, no move | 3 s | open |
| 2 | Medium, front three-quarter: he sips from the can without looking up and keeps scrolling; a small satisfied smirk | 50 mm, slow push | 3 s | open |
| 3 | Insert over his shoulder: the phone screen shows EXACTLY @Image2 (a generic dark portfolio app, a green total and a green chart); his thumb scrolls; nothing on the screen that is not in @Image2 | 85 mm, shallow focus, static | 2 s | open |
| 4 | Close, three-quarter on his face: a deep roar off screen; he freezes mid-sip, eyes dart sideways, the can lowers slowly | 85 mm, static | 2 s | roar |
| 5 | Wide: behind him, between the dark trunks, a huge brown bear steps into the shafts of sunset light and rises to full height; he is only half turned | locked-off 35 mm | 3 s | roar |
| 6 | Medium, handheld: he sees it; the can drops from his hand to the needles (its own beat); he scrambles off the log and bolts | 50 mm, handheld | 3 s | chase start |
| 7 | Wide: he sprints down the forest path, hoodie flapping, phone clutched in one hand; the bear crashes after him through the undergrowth | lateral track alongside, 35 mm | 3 s | chase; DATA: the ghost portfolio card enters among the trees (see Picture) |
| 8 | Insert: bear paws pounding the path, pine needles and dust flying, the sunset flaring behind | low 50 mm, tracking | 2 s | chase |
| 9 | Medium from the front: he runs at camera, arms pumping, mouth open, glancing back; the bear a huge shape behind him | 50 mm, handheld running backwards | 3 s | chase; the ghost card's value and percentage have fallen |
| 10 | Medium: he skids to a stop, gasping, and yanks the phone up in front of him; over his shoulder the screen shows EXACTLY @Image2 for this shot (the Daylight app, dark with gold accents); his thumb hits the bright gold button once, hard | 50 mm, handheld, shallow focus | 3 s | daylight |
| 11 | Insert: the screen fills the frame, showing EXACTLY @Image2 for this shot (Daylight's read of the token: who holds it, who is leaving, what they paid); his eyes reflected faintly in the glass | 85 mm, static | 2 s | daylight |
| 12 | Wide: he turns, phone raised, as the bear lunges from two metres with a roar; at the instant of the lunge the bear bursts into a dense cloud of multicoloured paper confetti; the confetti hangs in the sunbeams and rains down over him | locked-off 35 mm | 4 s | daylight end into close |
| 13 | Close: he stands blinking under the falling confetti, lowers the phone, exhales, one disbelieving laugh, picks a piece of confetti off his hoodie | 85 mm, static | 2 s | close |
| 14 | STAGE: channel flip → logo reveal → end card with the chips | stage | 5 s | close |

Coverage: the log scene has a wide (1), a medium (2), an insert (3) and a close (4); the chase has
a wide (7), an insert (8) and a medium (9); the payoff has a medium (10), an insert (11), a wide
(12) and a close (13). One camera move at most per shot. No stage camera over footage.

## Narration
The Daylight narrator is PINNED in the config: The Clipped Newsreel, a brisk cut-glass 1940s British
newsreel voice, the Stanley Parable x crypto register: omniscient, snarky but warm, faintly
exasperated, treats the viewer as a character. The formality IS the joke; never wink at it. Five
lines with ids. Bracketed performance tags, an ellipsis for a real pause, ONE word in CAPS per line,
every number as words, no em dashes anywhere.

- **open** — "[warmly] Behold... a young man in his natural habitat. A forest, a log, an energy
  drink, and a portfolio he has checked eleven times since breakfast. All of it, he assures us, is
  going UP."
- **roar** — "[mildly interested] Ah. That... would be the MARKET."
- **chase** — "[dry] Observe the portfolio keeping him company as he runs. Down four percent. Down
  twelve. Down FORTY. He has not looked at it once, which is, in fairness, the first sensible thing
  he has done all day."
- **daylight** — "[brightening] And then... an idea. He opens Daylight. Who holds this token. Who is
  quietly leaving. What they paid for it. Everything he might have read BEFORE the forest."
- **close** — "[confident] Daylight. Understand the market you are walking into... BEFORE it
  introduces itself."

Split a line wherever the picture must change act; the anchors point at line starts and ends.
Shots 1 to 3 under open; 4 and 5 under roar; 6 to 9 under chase; 10 to 12 under daylight; 13 and
14 under close. The confetti pop (shot 12) lands on the end of the daylight line.

## Picture: what is filmed, what is generated, what is data
- **Filmed (real screens, handed as references, never rendered as text):**
  `.footage/daylight-basement/refs/app/portfolio.png` (shot 3: a generic portfolio app, an
  invented example, green total and chart) ·
  `.footage/daylight-basement/refs/app/daylight-home.png` (shot 10: the Daylight app with the bright
  gold button) · `.footage/daylight-basement/refs/app/daylight-read.png` (shot 11: Daylight's read
  of a token). In the prompt: "the screen shows EXACTLY @ImageN; nothing on the screen that is not
  in @ImageN". Keep the screen small in frame except in shot 11, and cut fast.
- **GENERATED FOOTAGE for shots 1 to 13.** EVERY shot on `bytedance/seedance-2.0/reference-to-video`,
  1080p, 16:9, `audio: false` (the mix carries the sound), single takes, `seconds` 4 to 6 as the
  shot list says. No other model.
- **THE LOOK (copied into every prompt):** live-action documentary realism, shot on a full-frame
  cinema camera, 35 mm for wides, 50 mm for mediums, 85 mm for faces, handheld where named, natural
  skin and fabric, real dust and pollen in the light, subtle lens flare from the low sun between
  the trunks, fine film grain, true-to-life colour. Late golden hour in a dense pine forest, the sun
  behind and to the left, warm rim light, a faint glimpse of snow-capped mountains between the
  trees.
- **THE CHARACTER is @Image1 on every shot:** `.footage/daylight-basement/refs/char/kid.png`, a
  twenty-two-year-old in a hoodie, the plain energy drink can (matte black with a plain green
  stripe, no logo, no words), the same face, hair and clothes in every shot, named in the prompt as
  "the same young man as @Image1, the same hoodie, hair and face". Shot 1 is rendered FIRST and
  checked; its frames and the shot itself then join the reference set of every later shot as the
  identity and the light (the pipeline hands them over; the brief names @Image1 for all).
- **THE BEAR** is a huge brown grizzly, real fur and mass, comic in behaviour only (it lollops,
  it lunges, it pops); never bloody, never touching him.
- **DIRECT BROAD ACTIONS ONLY.** The can is in his hand or on the log for a whole shot, or dropped
  in its own clear beat (shot 6). The phone stays in his hand from shot 6 onward. No prop changes
  hands. No fiddly business.
- **DATA: the ghost portfolio** is a stage `card`, never generated: a Daylight-styled panel with
  `opacity` 0.35 (a translucent ghost), about 32vw × 30vh, centred among the trees on the right
  (leftVw about 74, topVh about 36, off his face in every shot it shares), header identity
  "Portfolio" with sub "an example, invented for this trailer", headline "$4,812.40" (color
  green) with altText "$2,839.10" (altColor red), stats "Today" value "+4.6%" altValue "−41.0%"
  tone accent; `altAt` early in the chase line so the numbers fall while he runs; enters on shot 7,
  exits before shot 10. Give it an explicit height. No other data piece.
- **The end card** (shot 14): the Daylight mark, wordmark DAYLIGHT, plate "the on-chain survival
  kit", the line "Understand the market you are walking into.", chips "Contains AI-generated
  footage" and "Example portfolio and tokens, not investment advice".
- **Negative prompt on every shot:** "text, logos, brand names, cartoon, animation, illustration,
  CGI look, plastic skin, warped hands, extra limbs, real people, celebrity likeness, blood, gore,
  explorer hat, moustache".

## Sound
- Bed: `/Users/colbymort/Irora-dev/irora-os/ledger/2026/W31/2026-07-27/1843-daylight-explorer-narrator-sound-effects/outputs/wave4-cheeky/mixes/bed-b-radio.mp3`,
  ducked under the narration.
- Two effects only: a deep bear roar at the start of the roar line (render prompt "a deep grizzly
  bear roar in a forest, close, natural reverb", about 2 s, minus ten dB) and a single balloon pop
  with a soft paper flutter at the end of the daylight line, on the confetti (render prompt "a
  single loud balloon pop followed by fluttering falling paper confetti", about 2 s, minus six dB).

## Brand facts
Daylight is the on-chain survival kit. Powered by Blocktronics. It reads who holds a token, who is
quietly leaving, how much of the supply sits in bundled wallets, and what the holder base paid,
before you buy. Mark: `/local/daylight-logo.svg`, wordmark DAYLIGHT, plate "the on-chain survival
kit". Footer truth in the app: "your wallet signs everything · not financial advice".

## What must never appear
Real people or recognisable likenesses; real brand names or logos (the energy drink is generic, the
portfolio is an invented example); real tokens presented as real; unreleased features; on-screen
text or logos inside generated shots (the only exception is the real app screenshots handed as
references); blood or gore; the explorer or his hat and moustache.
```
