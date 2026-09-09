# daylight-bear — storyboard

> status: draft · compiled by scripts/draft.mjs from `briefs/daylight-bear.md`
> Times are ESTIMATES (14 characters/second, plus 0.6s per direction) until the mix is built.
> Every clip carries its narration anchor, so `npm run trailer -- daylight-bear --go` renders, builds and re-times everything from the measured audio.

**A painted golden-hour forest, a pleased gentleman explorer, and a profit chart that says the holder base is up ninety percent. A newcomer buys. A bear comes out of the trees. The bear is the sell pressure.**

## Beats

| est. | anchor | you see | you hear |
|---|---|---|---|
| 1.5s | `line:stroll.start-1.5` | Full-bleed painted golden-hour pine forest; the gentleman explorer strolls the path, cane tapping, cabin windows lit below, snow peaks behind. | Warm strings and plucked guitar under a pleased opening line. |
| 13.4s | `line:chart.start-0.3` | A dark Daylight chart panel slides in on the right: Value climbing steeply in gold, Total cost creeping along dotted below, labelled as an invented example token. | The two lines explained in one breath. |
| 27.4s | `line:ninety.start+0.5` | The explorer stops in a sunny clearing, hand on hip; the chart pins the widest gap, Holders up 90%. | Amused note that a newcomer buys at exactly this moment; the score thins. |
| 35.7s | `line:ninety.end+0.2` | Chart exits. Behind him a great brown bear rises to full height out of the dark pines; he turns, eyes wide, moustache up. | A single deep growl under the last word. |
| 35.9s | `line:chase.start-0.2` | He drops the cane and bolts, helmet held on, bear lolloping after; the chart returns and Value collapses back to Total cost, pin reads You bought here. | Comic scramble in the low strings, boots on dirt. |
| 43.7s | `line:close.start` | Channel flip to the Daylight mark, wordmark, plate the on-chain survival kit, then the end card with its chips. | One warm sustained chord under the close and the dry aside. |

## Narration — 5 lines, 636 characters

- **stroll** (3.0s → 13.0s, est.) [warmly] A fine afternoon on the chain. Our man walks the ridge, cane in hand, pleased with himself... and entirely UNTROUBLED by the market.
- **chart** (13.7s → 26.2s, est.) [matter-of-fact] Two lines, then. What the holder base PAID for it, and what it is worth today. The gap between them is profit, and every penny of it belongs to somebody else.
- **ninety** (26.9s → 35.5s, est.) [amused] Holders are up ninety percent on what they paid. And a newcomer, bless him, chooses THIS precise moment to buy.
- **chase** (36.1s → 43.0s, est.) [dry] This... is what buying from people in profit looks like. The gentleman is fine. PROBABLY.
- **close** (43.7s → 50.9s, est.) [confident] Daylight. It reads what the holders paid, before you buy. [amused] Do try to look behind you.

## Sound

- bed: RENDER 45s — "Painted adventure score for a storybook forest film: warm strings and soft horn over gentle plucked guitar, unhurried and golden at first, then a light comic scramble in the low strings and timpani for a chase, resolving to one warm sustained chord; instrumental, no vocals, cinematic, clean"
- bed 1 dB · duck 5 dB · preroll 3s · tail 3s
- sfx **sfxBear** at `line:ninety.end+0.2`: "A single deep brown bear growl rising to a short roar, close, dry forest air, no music" (3s, -11 dB)
- sfx **sfxRun** at `line:chase.start-0.2`: "Fast boots scrambling on a dirt forest path, breaking twigs and rustling ferns, receding, no music" (4s, -14 dB)

## On stage

- **Generated shots** (footage): fStroll·footage, fClearing·footage, fBear·footage, fChase·footage
- **Cost basis vs market value** (chart): chartA·lineChart, chartNote·text, chartB·lineChart, chartNoteB·text
- **Reveal & close** (close): flip·channelFlip, mark·logoReveal, markUp, wordmark, plate, powered, endcard·endCard
- **Captions** (captions): cap1·caption, cap2·caption, cap3·caption, cap4·caption, cap5·caption
- **Beats** (beats): buyMoment, bearRises, collapse
- **Narration lines** (lines): __line-stroll, __line-chart, __line-ninety, __line-chase, __line-close

## Check these on the cue stills

- Nothing renders until a human runs the pipeline with --go: four footage shots at 1080p on bytedance/seedance-2.0/reference-to-video, five narration lines, one bed, two effects. Price the shots with npm run footage before approving.
- All four shots carry the same five references (clip-one.mp4 as @Video1; walk-4s, walk-7s, react-face, landscape-golden as @Image1 to @Image4) so one character and one painted look walk through the whole cut. Those files must exist on disk before --go.
- Disclosure is in place: every footage clip is labelled AI-generated and the endCard chip says Contains AI-generated footage, plus Example token, not investment advice.
- $ACORN, the ninety percent figure and every value on the chart are invented for this trailer and labelled as such on the chart itself. No real token, no real number.
- lineChart size and placement keys (width, height, leftVw, topVh) should be checked against src/lib/pieces.ts before the first record; if the piece ignores them, the chart needs an explicit box some other way, because the brief requires it never sit over the explorer's face.
- The chart exits at line:ninety.end so the bear beat is full frame, and returns for the collapse during the chase.
- Camera is two arcs only, each out-move on its in-move's centre: a push on the bear reveal, a push on the chase.
- Silent draft first: set mix to null, shoot the cut with footage plates, read the per-cue stills, then spend.

## Next

```
npm run trailer -- daylight-bear          # dry run: lists every render it would pay for
npm run trailer -- daylight-bear --go     # the human click: render, build, re-time, record
```

## The brief, verbatim

```
# Brief — Daylight: the explorer, the profit chart and the bear

## Who is watching, and what they should believe afterwards
Crypto-native people on X and in Daylight's community. Afterwards they should believe: Daylight
shows you what the holder base PAID for a token against what it is WORTH right now, and when the
whole base is already sitting on a fat profit, buying is walking into a bear.

## The one thing to land
The gag: everything is lovely, the profit chart climbs, the narrator notes that holders are up
ninety percent on what they paid, a newcomer buys at exactly that moment, and a bear comes out of
the trees. The bear IS the sell pressure. The chart falls while the explorer is chased. Funny,
not gory: a comic chase, the explorer is fine, probably.

## Length and venue
About 28 to 34 seconds. 16:9, 1080p, an autoplay-with-sound post on X; a 9:16 cut later. It must
be stunning: painted, cinematic, golden-hour light, no cheap-looking frame anywhere.

## The story, in order
1. Golden hour in the painted pine forest. The gentleman explorer (Daylight's mascot: pith helmet,
   white walrus moustache, a single monocle on a chain, many-pocketed khaki safari jacket,
   leather satchel, wooden cane, sturdy boots) strolls along the forest path, pleased with
   himself, cane tapping the ground, the log cabin with lit windows below among the pines,
   snow-capped mountains behind.
2. A chart appears on the set, Daylight's two lines: VALUE (what the token is worth, the market
   value of the holder base) climbing steeply away from TOTAL COST (what the holder base paid
   for it, its cost basis). The gap between the two lines is the profit everyone is sitting on.
   The narrator explains the two lines in plain words.
3. The explorer reaches a sunny clearing and admires the view, hand on hip. A pin on the chart
   marks the moment: holders up ninety percent on what they paid. The narrator observes that a
   newcomer, bless him, chooses this exact moment to buy.
4. Behind the explorer, from the dark of the pines, a great brown bear rises to its full height.
   The explorer turns and sees it. His face: wide eyes, moustache lifting, mouth open.
5. The bear charges; the explorer bolts away down the path, helmet held on with one hand, the
   bear lolloping after him. While they run, the VALUE line on the chart collapses back down to
   the TOTAL COST line. The pin now reads: you bought here.
6. Close: the Daylight mark, "the on-chain survival kit", and the line. Daylight reads what the
   holders paid before you buy.

## Narration
The Daylight narrator is PINNED in the config: The Clipped Newsreel, a brisk cut-glass 1940s
British newsreel voice, the Stanley Parable x crypto register: omniscient, faintly exasperated,
treats the viewer as a character and a rug pull as a matter of national importance. The
formality IS the joke; never wink at it. Five short lines, roughly: a pleased opener over the
stroll ("a fine afternoon on the chain"); the two lines of the chart explained in one breath
(what the base paid, what it is worth, the gap is profit); the ninety percent observation and
the newcomer who buys; a dry line over the chase ("this is what buying from people in profit
looks like"); the close ("Daylight. It reads what the holders paid before you buy.") with one
last dry aside. Direct every line with bracketed performance tags, ellipses and ONE CAPS word.
Spell every number as words. No em dashes anywhere in the text.

## Picture: what is filmed, what is generated, what is data
- Nothing to film: no app on camera in this piece.
- GENERATED FOOTAGE for beats 1, 3, 4 and 5 (four shots; beat 2 plays over the tail of the
  stroll). EVERY shot on `bytedance/seedance-2.0/reference-to-video`, 1080p, 16:9, `audio: false`,
  single takes. No other model and no image-to-video from a painting: a shot from a different
  generator reads as a different film (a soft Kling sunset stood out against crisp Seedance shots
  on 2026-09-07).
- THE LOOK is the approved first shot of the previous trailer, and every shot must carry it:
  painted storybook realism, soft painterly shading, matte-painting brushwork, cinematic shallow
  depth of field, warm rim light, volumetric haze between the pine ridges, fine film grain. NOT a
  flat cartoon: no thick black outlines, no cel-shading, no vector look. Hand every shot the same
  references and name them in the prompt: `.footage/daylight-bear/refs/style/clip-one.mp4` as
  @Video1 (the explorer and the world in motion), `.footage/daylight-bear/refs/style/walk-4s.png`
  and `.footage/daylight-bear/refs/style/walk-7s.png` as the first two images (the look), and
  `.footage/daylight-bear/refs/style/react-face.png` as the explorer's FACE for any shot that shows
  it (a single monocle, white walrus moustache, pith helmet). The world:
  `.footage/daylight-bear/refs/brand/landscape-golden.png` (golden hour). Never hand the model a
  flat mascot drawing as a style reference; the face frame above is the identity.
- DIRECT BROAD ACTIONS ONLY. Models fumble fiddly business: no monocle popping, no card flung and
  caught, no prop changing hands. The cane is either in his hand for the whole shot or dropped on
  purpose in one clear beat ("he drops the cane and runs"). The bear is a big brown bear, drawn
  in the same painted style, comic, never bloody.
- THE CHART IS DATA: a `lineChart` piece on the set, Daylight-styled (dark panel, warm gold line),
  two series: "Value" (an area, climbing steeply) and "Total cost" (a dotted line, climbing
  slowly). A pin when the gap is widest: "Holders up 90%". At the bear beat the Value series
  falls back to the Total cost line and the pin becomes "You bought here". The token is an
  invented example: name it "Acorn", ticker "$ACORN", and label it "an example token, invented
  for this trailer" on the chart itself. Keep the chart out of the explorer's face in any close
  shot (a lower-third or a side panel; it exits before the bear fills the frame). Give it an
  explicit height.
- One camera move at most per shot. Captions on (most feeds play muted). The end card carries the
  chip "Contains AI-generated footage" and "Example token, not investment advice".

## Brand facts
Daylight is the on-chain survival kit. Powered by Blocktronics. The card the product shows is
"Cost basis vs market value": Total cost is the holder base's aggregate cost basis (realized
cap); Value is the market value; holders above cost carry ready sell pressure into any rally.
Mark: `/local/daylight-logo.svg`, wordmark DAYLIGHT, plate "the on-chain survival kit".
```
