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
