# daylight-explorer — storyboard

> status: draft · compiled by scripts/draft.mjs from `briefs/daylight-explorer.md`
> Times are ESTIMATES (14 characters/second, plus 0.6s per direction) until the mix is built.
> Every clip carries its narration anchor, so `npm run trailer -- daylight-explorer --go` renders, builds and re-times everything from the measured audio.

**A painted gentleman explorer walks a golden-hour ridge, reads a token's holder report card, sees ninety one percent bundled supply, and runs: Daylight reads the holders before you buy.**

## Beats

| est. | anchor | you see | you hear |
|---|---|---|---|
| 2.6s | `line:open.start` | Full-bleed painted forest: the explorer walking away up the golden-hour path, snow peaks and a lit cabin behind him. Caption low. | Bed comes up first. Narrator, hushed and delighted: the magnificent dusk opener. |
| 9.9s | `line:open.end-2.5` | Cut to the sun dropping behind the peaks, sky gold to violet, his silhouette still moving along the ridge. No words for a beat. | Bed alone, the pause after the opener. |
| 14.9s | `line:read.start+0.9` | He halts and lifts the card to his monocle; the data report card sits over the shot, gold-edged glass, Moonbag $MBAG, an example token, headline still reading. Slow push-in begins. | Curious: he checks who else is holding this thing. |
| 22.4s | `line:gasp.start` | At bundleHit the headline flips to Bundled supply ninety one percent in red and the top ten holders stat fills in at seventy four percent. Camera easing back out. | The gasp, delighted rather than alarmed. |
| 29.7s | `line:run.start` | Card flung spinning against the sunset, then the whip down to the explorer bolting back along the path, helmet held on. | Dry aside: that is the correct reaction. |
| 34.0s | `line:close.start` | Channel flip to the close: the Daylight mark arrives, wordmark, then the plate line the on-chain survival kit. | Warm and confident, then the chuckle. |
| 40.3s | `line:close.end-1.4` | End card: wordmark, the holders line, chips for AI-generated footage disclosure and the example-token label. Blackout half a second after the last word. | Bed rounds out over the tail. |

## Narration — 5 lines, 507 characters

- **open** (2.6s → 12.4s, est.) [warmly, hushed] Ah... MAGNIFICENT. Golden hour on the chain, and our explorer is out walking the high ridge, quite pleased with himself.
- **read** (14.0s → 22.1s, est.) [curious] He stops. Out comes the report card, up goes the monocle... and he checks who ELSE is holding this thing.
- **gasp** (22.4s → 29.2s, est.) [gasping, delighted] Oh. Oh dear. Ninety one percent of the supply, sitting in BUNDLED wallets.
- **run** (29.7s → 33.4s, est.) [dryly amused] Yes. That... is the correct reaction.
- **close** (34.0s → 41.7s, est.) [confident, warm] Daylight. It reads the holders before you buy. [amused] Do try to look... before you leap.

## Sound

- bed: none (voice only)
- bed 0 dB · duck 6 dB · preroll 2.6s · tail 2.6s
- sfx: none

## On stage

- **Generated world** (world): shotWalk·footage, shotSunset·footage, shotRead·footage, shotRun·footage
- **The report card** (set): reportCard·card, cardNote·text
- **Reveal & close** (close): flip·channelFlip, mark·logoReveal, markUp, wordmark, plate, powered, endcard·endCard
- **Beats** (beats): bundleHit, cardFling
- **Captions** (captions): cap-open·caption, cap-read·caption, cap-gasp·caption, cap-run·caption, cap-close·caption
- **Narration lines** (lines): __line-open, __line-read, __line-gasp, __line-run, __line-close

## Check these on the cue stills

- Bed is a file, not a render: point the mix's bed src at /Users/colbymort/Irora-dev/irora-os/ledger/2026/W31/2026-07-27/1843-daylight-explorer-narrator-sound-effects/outputs/wave4-cheeky/mixes/bed-b-radio.mp3 and leave it with no render block. bed is null here for exactly that reason. No effects, per the brief.
- Five lines, not four: the gasp is split off from the read so the report card's headline flip has its own anchor (bundleHit at line:gasp.start+0.4). Estimated runtime with 2.6s preroll and tail is about twenty three to twenty six seconds.
- Every explorer shot is Seedance 2.0 reference-to-video with the identity image plus a landscape, named in the prompt as @Image1 / @Image2 / @Image3, so the mascot survives the painted style.
- The sunset shot uses bytedance/seedance-2.0/image-to-video with landscape-sunset as the opening image and landscape-dusk as the end image, because the catalogue's Kling v3 Pro entry is text-to-video only and cannot take a first and last frame. If a framed Kling endpoint is available at render time, swap the model and keep the prompt.
- 1080p on Seedance 2.0 is $0.68 per generated second. With seconds auto (span + 1.5s) the four shots are roughly six, six, nine and five seconds, so about seventeen to eighteen dollars for one take of each. Add takes:2 on shotRun only if the comic beat needs auditioning, and expect that to roughly double that shot.
- The report card in his hand is generated blank on purpose and the real card is the data piece over the shot. Once a take is recorded and approved, a second pass can hand shotRead the actual card as refs.images "@still:reportCard+1.2" named @Image4 so the lettering in his hand is the real panel. Not used now because no recorded take exists yet.
- Ninety one percent, seventy four percent, Moonbag and $MBAG are invented. The card sub and the eyebrow both say example, and the end card repeats it. No claim anywhere that Daylight prevents losses.
- One camera arc only: a five second in-and-out on the same centre across the card read. No other movement, so the handheld feel is all inside the generated shots.
- For the 9:16 cut later, keep the explorer and the card off dead centre in reframing; the footage clips are fit cover and will crop from the sides.
- Run npm run footage -- daylight-explorer to price it, then --go after Colby signs off on the figure; shoot a silent draft first with mix null to judge the cut for free.

## Next

```
npm run trailer -- daylight-explorer          # dry run: lists every render it would pay for
npm run trailer -- daylight-explorer --go     # the human click: render, build, re-time, record
```

## The brief, verbatim

```
# Brief — Daylight: the explorer and the report card

## Who is watching, and what they should believe afterwards
Crypto-native people on X and in Daylight's community. Afterwards they should believe: Daylight
reads a token's holders before you buy, and a high bundle percentage is the moment to walk away.

## The one thing to land
The comic beat: he reads the report card, sees the bundle percentage, and runs. That reaction IS
the product pitch. Everything else serves it.

## Length and venue
About 22 to 26 seconds. 16:9, 1080p, an autoplay-with-sound post on X; a 9:16 cut later. It must
be stunning: painted, cinematic, golden-hour light, no cheap-looking frame anywhere.

## The story, in order
1. Golden hour in a painted pine forest. An old-timey gentleman explorer (Daylight's mascot: pith
   helmet, white moustache, monocle, khaki safari jacket with many pockets, wooden cane, sturdy
   boots) makes his way along a forest path toward a ridge. The sun is going down over snow-capped
   mountains behind him; a log cabin with lit windows sits among the pines.
2. The sun sets over the mountains: the sky moves from gold to violet dusk while he walks.
3. He stops, takes out his report card and peers at it through the monocle. The card shows a
   token (an invented example, clearly labelled as an example) with a very high bundle
   percentage: a large share of the supply sitting in bundled wallets.
4. He freaks out: a yelp, he flings the card high into the air, and bolts back down the path the
   way he came. The card spins against the sunset.
5. Close: the Daylight mark, "the on-chain survival kit", and the line.

## Narration
The Daylight narrator (already cast, in the config): amused, theatrical wildlife-documentary
register, confiding, never panicking. Four short lines, roughly: an "ah, magnificent, dusk on the
chain" opener over the walk; a curious "he consults the report card" turning into a gasp at the
bundle figure; a dry "yes, that is the correct reaction" over the run; a close: "Daylight. It
reads the holders before you buy." with a chuckle and a last dry aside. Direct every line with
bracketed performance tags, ellipses and one CAPS word. Spell numbers as words.

## Picture: what is filmed, what is generated, what is data
- Nothing to film: no app on camera in this piece.
- GENERATED FOOTAGE for shots 1 to 4, in the style of the reference landscapes: painted storybook
  realism, matte-painting brushwork, warm rim light, volumetric haze between pine ridges, film
  grain, gentle handheld camera. The explorer must be rendered IN that painted style while keeping
  the mascot's identity (helmet, moustache, monocle, khaki jacket, cane). Use references on every
  explorer shot. No on-screen text in generated shots, no logos, no real or recognisable people.
- The REPORT CARD is DATA: a `card` piece styled as Daylight's report card — a dark, glassy panel
  with a warm gold edge — showing the invented token (use the name "Moonbag" with ticker "$MBAG",
  sub "an example token · Base") and a headline stat "Bundled supply · 91%" in the negative colour,
  with a second stat "Top ten holders · 74%". Show it on the set for the beat where he reads it
  (over the footage, framed like a card in his hand), so the still of it can be handed to the
  footage model as the card in his hand. Label it as an example somewhere on the card.
- One camera move at most. Captions on (most feeds play muted).

## References (files, ready for the render blocks)
- Landscapes (the world): `.footage/daylight-explorer/refs/brand/landscape-golden.png` (golden hour),
  `.footage/daylight-explorer/refs/brand/landscape-sunset.png` (sun on the peak),
  `.footage/daylight-explorer/refs/brand/landscape-dusk.png` (violet dusk, cabin lit).
- The explorer: `.footage/daylight-explorer/refs/brand/explorer-hero.png` (identity),
  `.footage/daylight-explorer/refs/brand/explorer-walking.png`, `.footage/daylight-explorer/refs/brand/explorer-thinking.png`.
- The card look: `.footage/daylight-explorer/refs/brand/card-mountain-glass.png`.
- For the sunset shot use image-to-video with the sunset landscape as the first frame and the dusk
  landscape as the end frame. For explorer shots use Seedance reference-to-video with the explorer
  identity image plus one landscape as references, named in the prompt as @Image1 / @Image2.

## Sound
Bed: reuse the Daylight promo's cheeky radio bed (a file, no render):
`/Users/colbymort/Irora-dev/irora-os/ledger/2026/W31/2026-07-27/1843-daylight-explorer-narrator-sound-effects/outputs/wave4-cheeky/mixes/bed-b-radio.mp3`.
No effects.

## Must never appear
Real token names or tickers, real prices, real people, faces of anyone real, any claim that
Daylight prevents losses. The token is an example and says so.

## Money and sign-off
Colby approves the storyboard and the dollar figure; VideoProdEngine runs the pipeline; Colby
approves the take on the review board. Footage renders at 1080p on Seedance 2.0 (explorer shots,
reference-to-video) and Kling 3.0 Pro (the rest); H3 Max only for drafts.
```
