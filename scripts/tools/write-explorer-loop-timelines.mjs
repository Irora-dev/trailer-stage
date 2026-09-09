// Writes six loop timelines for Colby's paper-craft explorer on its magenta plate (typed 2026-09-09 ~00:20,
// one image: ~/Downloads/Mothership/Site3/Meshy_AI_daylight-companion-round-mouth-magenta.png): six
// animations, the still as FIRST and LAST frame (refs.images: [still, still]) so each closes into a loop
// (then `npm run loop -- <name> <clip>` re-picks the even-pace cycle and `scripts/tools/key-sprite.sh` keys the
// magenta to alpha). Seedance 2.0 image-to-video, 5 s, 1080p, aspect auto (the still is square), silent.
// Run from ~/Irora-dev/trailer-stage:  node scripts/tools/write-explorer-loop-timelines.mjs
import { writeFileSync } from 'node:fs'

const STILL = '.footage/explorer-paper/refs/companion-magenta.png'
const LOOK =
  'Layered paper cut-out craft animation: every part of the figure is a piece of textured card with visible fibre and clean cut edges, lit by soft studio light from the upper left with gentle paper shadows on the figure only, the figure centred on a flat, pure, even magenta background that never changes.'
const PHYSICS =
  'Physics: the figure stays centred and the same size, the magenta background stays perfectly flat, even and empty with no shadow cast on it, every part stays attached and moves like hinged card, nothing appears except what he takes from his pouch and puts back, and the last frame returns exactly to the pose of the first frame.'
const CAMERA =
  'Static camera, no push, no zoom, no pan, one single unbroken five-second take from this one camera only. Start exactly from the first frame and end exactly on the same frame, one continuous take without any cut; the camera never changes position, height or angle.'
const SCENE =
  'The round paper-craft explorer figure (pith helmet, big round goggles, a smiling face, a khaki card body with a belt and a pouch, a rolled green bedroll on his back, stubby arms and boots) stands centred on the flat magenta plate exactly as in the first frame.'

const anims = {
  binoculars:
    'He unclips a pair of small paper binoculars from the pouch on his belt, raises them to his goggles, scans slowly to the left and then to the right, lowers them, clips them back into the pouch, and settles back into exactly the first frame\'s pose with his arms at his sides.',
  wave:
    'He lifts his right arm and waves at the camera twice with his paper smile widening, tilts his head a touch, lowers the arm, and settles back into exactly the first frame\'s pose.',
  hattip:
    'He lifts his pith helmet an inch with his right hand, tips it politely toward the camera, sets it back on his head with a small adjustment, and settles back into exactly the first frame\'s pose.',
  compass:
    'He takes a round paper compass from the pouch on his belt, holds it flat in front of him, looks down at it, turns his whole body a quarter turn to the left and back as if following the needle, nods once, puts the compass back in the pouch, and settles back into exactly the first frame\'s pose.',
  hop:
    'He bends his knees, does one happy little hop straight up with both arms raised, lands with a soft paper wobble, and settles back into exactly the first frame\'s pose.',
  lookaround:
    'He leans to his left and peers past the edge of the frame, leans to his right and peers the other way, scratches the side of his helmet with one hand, gives a small shrug, and settles back into exactly the first frame\'s pose.',
  idle:
    'He simply stands and breathes: his round body swells very slightly as he breathes in and settles as he breathes out, the hat, the goggles and the arms rising and falling with it by a few millimetres, two slow breaths over the five seconds, his eyes and smile unchanged, his feet planted, nothing else moving at all, and he settles back into exactly the first frame\'s pose.',
  idlea:
    'He barely moves, so little that any single frame looks the same as the first: over the five seconds his head turns a few degrees to his left and back, then a few degrees to his right and back, his arms sway a centimetre with it, his body rises and settles by a millimetre with one slow breath, his feet stay planted, his smile and his eyes stay exactly as they are, the magenta around and beneath him stays perfectly flat with no shadow and no reflection anywhere, and he ends in exactly the first frame\'s pose.',
  idleb:
    'He is almost completely still, alive only by a breath: over the five seconds his body rises and settles by a millimetre or two, twice, his arms drift a few millimetres with it, his head tilts one degree and back, nothing else changes, his feet stay planted, his face stays exactly as it is, the magenta around and beneath him stays perfectly flat with no shadow and no reflection anywhere, and he ends in exactly the first frame\'s pose.',
  // Round three (Colby, 2026-09-09 ~09:28: "now try some other funny things the robot companion could do"):
  // each gag finishes by the fourth second and HOLDS the first frame's pose for the last second, so the loop closes clean.
  sneeze:
    'He winds up for a sneeze, head tilting back and chest swelling, then sneezes hard forward: his pith helmet pops straight up off his head a hand\'s width, hangs, and drops back onto his head slightly askew, he straightens it with one hand, finishes by the fourth second and holds exactly the first frame\'s pose, perfectly still, for the last second; the magenta stays flat with no shadow anywhere.',
  spin:
    'He spins one full turn on the spot like a top, arms out, showing his bedroll as he goes round, comes back to face the camera dizzy with his goggles askew and his body wobbling, straightens the goggles with both hands, finishes by the fourth second and holds exactly the first frame\'s pose, perfectly still, for the last second; the magenta stays flat with no shadow anywhere.',
  coin:
    'He takes one shiny gold coin from the pouch on his belt, flips it high with his thumb and watches it spin up out of the top of the frame, waits with his hand out, and the coin drops back, clinks off the top of his pith helmet and falls into his hand; he pockets it, finishes by the fourth second and holds exactly the first frame\'s pose, perfectly still, for the last second; the magenta stays flat with no shadow anywhere.',
  trip:
    'He takes one step forward, trips over nothing, falls flat onto his face with a soft paper thump, lies still for a beat, bounces back up onto his feet in one springy motion, dusts off his jacket, finishes by the fourth second and holds exactly the first frame\'s pose, perfectly still, for the last second; the magenta stays flat with no shadow anywhere.',
  propeller:
    'His pith helmet begins to spin on his head like a propeller, faster and faster, and lifts him a hand\'s width off the ground with his boots dangling; the helmet slows, he drops back onto his feet with a bounce and the helmet settles, he finishes by the fourth second and holds exactly the first frame\'s pose, perfectly still, for the last second; the magenta stays flat with no shadow anywhere.',
  map:
    'He pulls a folded paper map from the pouch on his belt and unfolds it, and it keeps unfolding, bigger and bigger, until it hides him entirely except his boots; a beat; he folds it back down in three quick folds and tucks it into the pouch, finishes by the fourth second and holds exactly the first frame\'s pose, perfectly still, for the last second; the magenta stays flat with no shadow anywhere.',
  facepalm:
    'He looks down and to one side at something beyond the frame, freezes, slowly raises one hand and plants it over his goggles in a facepalm, shakes his head twice, lowers the hand with a long silent sigh of the shoulders, finishes by the fourth second and holds exactly the first frame\'s pose, perfectly still, for the last second; the magenta stays flat with no shadow anywhere.',
  dozeoff:
    'His eyes droop behind the goggles, his head nods forward once, twice, his whole round body sags into a doze, then he snaps awake with a jolt, looks left and right as if someone saw, straightens his helmet, finishes by the fourth second and holds exactly the first frame\'s pose, perfectly still, for the last second; the magenta stays flat with no shadow anywhere.',
}

for (const [id, action] of Object.entries(anims)) {
  const name = `explorer-paper-${id}`
  const tl = {
    name,
    end: 6,
    mix: null,
    scene: { kind: 'theme' },
    footage: { look: LOOK, physics: PHYSICS, handoff: '(single shot: no handoff)' },
    notes: `Paper explorer loop '${id}' (Colby, 2026-09-09 ~00:20: six animations, the still as start and end frame). Seedance image-to-video with the still as first AND last frame; then npm run loop -- ${name} ${id}; then scripts/tools/key-sprite.sh for alpha.`,
    tracks: [
      {
        id: 'footage',
        kind: 'visual',
        clips: [
          {
            id,
            at: 0,
            until: 5,
            params: {
              piece: 'footage',
              fit: 'contain',
              hold: 'loop',
              grade: 'none',
              render: {
                provider: 'fal',
                model: 'bytedance/seedance-2.0/image-to-video',
                prompt: `${CAMERA} ${SCENE} ${action} ${LOOK} ${PHYSICS} No text, no logos.`,
                negative:
                  'cartoon outline, cel shading, 3D render, glossy plastic, photorealistic, camera movement, zoom, pan, cutaway, second figure, background change, gradient background, shadow on the background, drop shadow, ground shadow, contact shadow, shadow under the feet, reflection, the figure drifting or changing size',
                refs: { images: [STILL, STILL] },
                seconds: 5,
                resolution: '1080p',
                aspect: 'auto',
                audio: false,
              },
            },
          },
        ],
      },
      {
        id: 'close',
        kind: 'visual',
        clips: [
          {
            id: 'endcard',
            at: 5.2,
            until: 6,
            params: { piece: 'endCard', wordmark: 'DAYLIGHT', plate: 'the on-chain survival kit', chips: ['Contains AI-generated footage'] },
          },
        ],
      },
      { id: 'captions', kind: 'visual', clips: [] },
    ],
  }
  writeFileSync(`trailers/${name}.timeline.json`, JSON.stringify(tl, null, 1) + '\n')
  console.log('wrote', name)
}
