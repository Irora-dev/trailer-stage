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
