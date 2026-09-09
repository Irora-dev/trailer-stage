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
