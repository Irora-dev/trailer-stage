# footage-demo — storyboard

> A silent draft (no mix) that exercises the `footage` piece. Nothing here is a product
> claim; the two clips on disk are local stand-ins (a painted parallax shot), not model output.

| at | sees | why it is here |
|---|---|---|
| 0.8 | the title "FOOTAGE" and its eyebrow | the set is warm before the first shot |
| 3.6 | a full-bleed shot (`lunge`), grain over it, a small "AI-generated" pill | cover fit; the file is shorter than its span, so it FREEZES on its last frame around 9.6 s |
| 11.6 | left: a shot in a rounded box that loops (`crowd`) · right: a framed card that says "pending" | contain fit with `hold: loop`; the card is a shot with no file yet, drawn as a placeholder plate |
| 17.6 | the end card, chip "Contains AI-generated footage" | the disclosure the compiler will insist on |

## What the dry run says
`npm run footage -- footage-demo` prices the one shot that is missing (`pending`, Kling 3.0 Pro,
6 s at 1080p) and stops. `npm run footage -- footage-demo --check` validates all three render
blocks without spending.

## What to check on the frames
- `lunge` still at 4.2 s shows the first frames of the clip; the still at 11.6 s (cue `crowd`)
  shows the frozen last frame behind the boxes, not black.
- `crowd` is looping (its 3 s file plays twice in the 5.8 s span).
- `pending` reads as a plate: eyebrow, id, prompt excerpt, model and seconds.
