# daylight-basement3 — storyboard

> status: draft · compiled by scripts/draft.mjs from `briefs/daylight-basement3.md`
> Times are ESTIMATES (14 characters/second, plus 0.6s per direction) until the mix is built.
> Every clip carries its narration anchor, so `npm run trailer -- daylight-basement3 --go` renders, builds and re-times everything from the measured audio.

**One continuous golden-hour take: a bucket-hatted retail investor scrolls a doomed portfolio on a log, a grizzly reads over his shoulder, he runs still scrolling, then holds up Daylight and the bear pops into confetti.**

## Beats

| est. | anchor | you see | you hear |
|---|---|---|---|
| 3.0s | `line:open.start` | Full-bleed golden-hour pine forest. The bucket-hatted investor hunched on a fallen log, scrolling, energy can beside him, a long sip without looking up. | Bed under. Narrator, warm wildlife-documentary register, over him. |
| 16.8s | `line:roar.start+0.6` | He freezes mid-sip; a huge grizzly rises to full height behind him and leans over his shoulder to read the phone. Camera pushes in gently. | The reused roar effect at minus ten decibels on the line's first word. |
| 21.8s | `line:chase.start+1.2` | He bolts; the handheld camera follows him down the path, still staring at the phone. The ghosted example portfolio card floats upper right among the trunks and flips from green to red. | Dry narration counting the losses; bed ducked. |
| 37.3s | `line:daylight.end-8.4` | He skids to a stop centre-left, holds the phone out like a badge. The example $ACORN read card sits upper right, clear of his face: holders in profit, bundled supply, wallets leaving. | The narrator brightening on the turn. |
| 45.7s | `line:daylight.end` | The bear lunges and bursts into multicoloured paper confetti hanging in the sunbeams; camera in on the pop, then he picks a piece off his hoodie and resumes scrolling. | The reused pop effect at minus six decibels, then two and a half seconds of score alone. |
| 50.4s | `line:close.start+2.1` | Channel flip off the forest into the mark, wordmark DAYLIGHT, plate, powered by Blocktronics, then the end card with both chips. | Confident close, then the dry last sentence over the end card. |

## Narration — 5 lines, 682 characters

- **open** (3.0s → 15.7s, est.) [warmly, a wildlife documentary] Behold the retail investor in his natural habitat. He has done his research... by which we mean he has looked at a green line and FELT something.
- **roar** (16.2s → 20.0s, est.) [mildly interested] Ah. The market would like a WORD.
- **chase** (20.6s → 31.8s, est.) [dry] Observe the technique. Run first, check the portfolio second. Down four percent. Down twelve. Down FORTY. Still holding, though. Tremendously brave.
- **daylight** (32.3s → 45.7s, est.) [brightening] And then... a thought. Quite possibly his first today. He opens Daylight: who holds this thing, who is quietly leaving, what they paid for it. All of it readable BEFORE the forest.
- **close** (48.3s → 55.6s, est.) [confident] Daylight. Understand the market you are walking into. [dry] The bear was never the PROBLEM.

## Sound

- bed: RENDER 56s — "Mock-epic trailer score played completely straight: low staccato strings building under a slow timpani pulse, a single noble horn line, sparse pizzicato, wide cinematic reverb, one lift into a triumphant sting then an easy resolve, instrumental, no vocals"
- bed -1 dB · duck 6 dB · preroll 3s · tail 3.5s
- sfx **roarSfx** at `line:roar.start`: "A single deep close grizzly bear roar, chest-heavy, real animal recording, dry forest air, no music" (3s, -10 dB)
- sfx **popSfx** at `line:daylight.end`: "A confetti cannon pop: soft compressed burst then a long shimmer of paper fluttering down, no music" (2.5s, -6 dB)

## On stage

- **The continuous take** (footage): shot1·footage, shot2·footage, shot3·footage
- **Data over the take** (data): ghostCard·card, readCard·card
- **Reveal & close** (close): flip·channelFlip, mark·logoReveal, markUp, wordmark, plate, powered, endCard·endCard
- **Captions** (captions): cap-open·caption, cap-roar·caption, cap-chase·caption, cap-daylight·caption, cap-close·caption
- **Beats** (beats): bearRise, portfolioDrop, readOpen, confettiPop
- **Narration lines** (lines): __line-open, __line-roar, __line-chase, __line-daylight, __line-close

## Check these on the cue stills

- Sound is REUSED from round two: point mix parts at the existing renders and do not re-render. Bed src: /Users/colbymort/Irora-dev/trailer-stage/.audio/daylight-basement2/daylight-basement2-bed.music.mp3 (the bed prompt here is only the spec of what that file already is). Effects: roarSfx -> .../daylight-basement2-roarSfx.sfx.mp3, popSfx -> .../daylight-basement2-popSfx.sfx.mp3. Line ids and text are byte-identical to round two so every .vo.mp3 on disk is picked up unchanged; a file that exists is never re-rendered.
- Deliberate deviation from the house shot rule, approved in the brief under the character-bible gate: three LONG shots (fifteen, fifteen, twelve seconds) instead of ten to fourteen short ones, because the whole point is one continuous take with no visible cut. Cost is the generated length, so this is about forty-two generated seconds, roughly twenty-nine dollars at 1080p. Nothing renders until a human runs the footage step with --go.
- Shots 2 and 3 are CHAINED on shared frames: their refs.images point at .footage/daylight-basement3/refs/chain/shot1-last.png and shot2-last.png, which the pipeline extracts from the previous shot's master. Render shot 1 first, extract, then shot 2, then shot 3. They are not @still refs because no recorded take exists yet.
- Shot 3 is generated at twelve seconds but cut to roughly nine (daylight.end-4.5 to close.start+2.2); hold is freeze so any re-timing of the daylight line reads as a held beat rather than a black frame. Same for the tails of shots 1 and 2.
- The Daylight read card is anchored off line:daylight.end so it always lands inside shot 2's tail, and sits upper right at leftVw 72 while he stands centre-left. Check the per-cue still: if the read card touches his face or the phone, move topVh to 22 rather than shifting leftVw.
- Every number, the portfolio and the token are labelled as examples in the card subs and again as an end-card chip. The AI-footage disclosure chip is on the end card, as the footage clips require.
- Estimated length is about fifty to fifty-three seconds at the read speeds implied by these lines, a little over the forty-five to forty-eight in the brief. Do not cut the lines (the audio is reused); if it must come down, trim the daylight gap from two point six to two seconds and start the flip at close.start+1.4, then re-run resolve.
- logoReveal takes the mark from the studio config: confirm it points at /local/daylight-logo.svg before recording, since nothing here passes a mark source.
- Shoot a silent draft first (mix null) and read the per-cue stills: the two joins, the ghost card flip on @portfolioDrop, the read card placement, and the confetti pop landing on the daylight line's last word.

## Next

```
npm run trailer -- daylight-basement3          # dry run: lists every render it would pay for
npm run trailer -- daylight-basement3 --go     # the human click: render, build, re-time, record
```

## The brief, verbatim

```
# Brief — Daylight: the basement bull and the bear (round three: the character bible cut)

> Round three under the character bible gate (Colby, 2026-09-08 ~20:30, a strict rule): the approved
> character is **B, the bucket hat** (turnaround: `.footage/basement-char-b/styles/`, approved ~20:50).
> Three long shots instead of seven, each starting from the previous shot's last frame so the film
> plays as one continuous take. Seedance 2.0 only. Estimated spend: 15 + 15 + 12 = 42 generated
> seconds ≈ $29 at 1080p; narration, effects and the score are already rendered from round two and
> are reused unchanged. Colby's recording: `ledger/2026/W37/2026-09-08/1639-daylight-bear-chase-trailer-concept/transcript.md`.

## Who is watching, and what they should believe afterwards
Crypto-native people on X and in Daylight's community. Afterwards they should believe: buying a token
without reading who holds it, who is leaving and what they paid is walking into a forest with a bear
in it, and Daylight is the thing you open BEFORE you walk in. Funny first, useful second.

## The one thing to land
One continuous take: the basement bull on his log scrolling a portfolio that is surely going up; a
bear rises behind him and reads over his shoulder; he runs, still scrolling, the ghost of his
portfolio falling among the trees; he stops and holds the phone out like a badge, opening Daylight;
the bear bursts into confetti; he goes straight back to scrolling. The narrator plays wildlife
documentary: omniscient, dry, faintly exasperated, never winking.

## Length and venue
About 45 to 48 seconds. 16:9, 1080p, autoplay-with-sound on X; a 9:16 cut later. Captions on.

## The shot list
Three generated shots, the two joins on shared frames (shot 2 begins on shot 1's last frame, shot 3 on
shot 2's), so there is no visible cut until the brand. Light continuity in every prompt: late golden
hour in a dense pine forest, the low sun flaring between the trunks from behind and to the left, warm
rim light, dust and pollen in the light.

| # | shot (intent) | camera | length | under lines |
|---|---|---|---|---|
| 1 | THE LOG: he sits hunched on the fallen log beside his can, scrolling; without looking up he takes a long sip and keeps scrolling with a small smirk; a deep roar; he freezes mid-sip, eyes dart; behind him a huge brown grizzly rises to full height and leans over his shoulder to look at the phone too; he keeps scrolling a beat, turns, sees it, drops the can, scrambles off the log and bolts out of frame right, the bear lumbering after | locked-off 35 mm wide, no move | 15 s | open · roar |
| 2 | THE CHASE: continuous from shot 1's last frame; the camera swings to follow as he sprints down the forest path STILL staring at his phone, hat and hoodie flapping, the bear crashing after him; he clips a low branch with his shoulder and keeps going; he skids to a stop, spins to face the bear and holds the phone out at arm's length like a badge, gasping, thumb stabbing the screen; the bear slows, puzzled | handheld, following, then settling | 15 s | chase · daylight (first half) |
| 3 | THE POP: continuous from shot 2's last frame; the bear lunges with a roar and at the instant of the lunge bursts into a dense cloud of bright multicoloured paper confetti; the confetti hangs in the sunbeams and rains down over him; he blinks, lowers the phone, exhales, picks a piece of confetti off his hoodie... and goes straight back to scrolling | static | 12 s | daylight (end) · close |
| 4 | DATA: the ghost portfolio card among the trees during the chase (see Picture) | stage | | chase |
| 5 | DATA: the Daylight read card, small, upper right, OVER the footage of shot 2's tail (never alone on a dark stage: the take must not break) | stage | 3 s | daylight middle |
| 6 | STAGE: channel flip → logo reveal → end card with the chips | stage | 5 s | close |

## Narration
The Daylight narrator is PINNED in the config: The Clipped Newsreel. Five lines with ids, identical
to round two so the rendered audio is reused: bracketed tags, an ellipsis for a pause, ONE word in
CAPS per line, numbers as words, no em dashes.

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

Shot 1 runs under open and roar (the roar effect lands as the bear rises); shot 2 under chase and
the first half of daylight; shot 3 from the middle of daylight through the close; the confetti pop
lands on the end of the daylight line; a 2.6 s pause before the close line gives the payoff air.

## Picture: what is filmed, what is generated, what is data
- **THE CHARACTER IS APPROVED: B, the bucket hat.** Reference set for shot 1:
  `.footage/basement-char-b/styles/seated.png` (@Image1), `.footage/basement-char-b/styles/front.png`
  (@Image2), `.footage/basement-char-b/styles/threeq.png` (@Image3), and the set
  `.footage/daylight-basement-world/styles/empty-log.png` (@Image4). In words in every prompt: "the
  same lime-green bucket hat pulled low, thick black-rimmed glasses, thin doomed moustache, washed-out
  grey hoodie, giant black headphones round his neck, baggy black cargo shorts, long white tube socks
  in black slides, the matte black energy drink can with a plain green stripe, a glittery pink phone".
- **Shots 2 and 3 are CHAINED**: each is generated on `bytedance/seedance-2.0/image-to-video` with
  the previous shot's last frame as its first frame (the pipeline extracts it to
  `.footage/daylight-basement3/refs/chain/`), so the join is a shared frame. Shot 1 is
  `bytedance/seedance-2.0/reference-to-video`. All 1080p, 16:9, `audio: false`.
- **THE LOOK (every prompt):** live-action documentary realism, full-frame cinema camera, natural skin
  and fabric, real dust and pollen in the light, subtle lens flare from the low sun between the
  trunks, fine film grain, true-to-life colour.
- **THE BEAR** is a huge brown grizzly, real fur and mass, comic in behaviour only; never bloody.
- **DATA: the ghost portfolio** is a stage `card`, opacity 0.45, about 34vw × 30vh, upper right
  among the trees (leftVw about 74, topVh about 34), identity "Portfolio" with sub "an example,
  invented for this trailer", headline "$4,812.40" (green) with altText "$2,839.10" (red), stats
  "Today" value "+4.6%" altValue "−41.0%" tone accent; `altAt` early in the chase line; enters shortly
  after shot 2 begins, exits before the read card.
- **DATA: the Daylight read** is a stage `card` OVER the footage: about 40vw × 22vh, upper right
  (leftVw about 72, topVh about 26), opacity 0.95, identity "$ACORN read" with sub "an example
  token, invented for this trailer", headline "Should you touch it? No." in red, stats "Holders in
  profit 91%", "Bundled supply 38%", "Top wallets leaving 6 in the last hour"; explicit height. It
  must never sit on his face: he stands centre-left in shot 2's tail.
- **The end card**: mark, wordmark DAYLIGHT, plate "the on-chain survival kit", line "Understand the
  market you are walking into.", chips "Contains AI-generated footage" and "Example portfolio and
  tokens, not investment advice".
- **Negative prompt on every shot:** "text, logos, brand names, cartoon, animation, illustration,
  CGI look, plastic skin, warped hands, extra limbs, real people, celebrity likeness, blood, gore,
  explorer hat, cuts, jump cuts".

## Sound
- Bed: the round-two render, reused: `/Users/colbymort/Irora-dev/trailer-stage/.audio/daylight-basement2/daylight-basement2-bed.music.mp3`
  (the mock-epic trailer score played straight). Modest gain, ducked under the narration.
- Effects: the round-two renders, reused: the roar `/Users/colbymort/Irora-dev/trailer-stage/.audio/daylight-basement2/daylight-basement2-roarSfx.sfx.mp3`
  at the start of the roar line (minus ten dB) and the pop `/Users/colbymort/Irora-dev/trailer-stage/.audio/daylight-basement2/daylight-basement2-popSfx.sfx.mp3`
  at the end of the daylight line (minus six dB).

## Brand facts
Daylight is the on-chain survival kit. Powered by Blocktronics. It reads who holds a token, who is
quietly leaving, how much of the supply sits in bundled wallets, and what the holder base paid,
before you buy. Mark: `/local/daylight-logo.svg`, wordmark DAYLIGHT, plate "the on-chain survival kit".

## What must never appear
Any character not on the approved sheet; real people or likenesses; real brands or logos; real tokens
as real; on-screen text or logos inside generated shots; blood or gore; a visible cut inside the take.
```
