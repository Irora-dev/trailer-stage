# Daylight — six complete Seedance scene scripts

> For: Rickard and the video producer. Production script pack v4, 2026-09-09. Incorporates the latest rug, roof, honeypot and whale directions. Text and source reference frames only; no model run, narration render or video generated.

## How to use this pack

There are exactly six films. Each has one self-contained, ready-to-paste `.txt` footage prompt, a reference-image attachment order, the complete 15-second visual sequence, audio direction, narration cues and the finishing instructions. The intro deliberately has three shots within its generation; the other five are single continuous scenes. No earlier variants or optional jokes are included.

1. Open Seedance 2.0 reference-to-video. Attach the listed reference images **in the stated order** so @Image1, @Image2 and @Image3 resolve correctly. The images are extracted frames from the supplied draft clips, not newly approved character turnarounds.
2. Set duration **15 seconds**, landscape **16:9**, and resolution **1080p** for the intended output. For a first motion check, 480p is available. Use the same Seedance 2.0 endpoint for the whole set. Enable generated audio for ambience/SFX; the prompts explicitly request no speech.
3. Paste the entire matching `.txt` prompt. Do not paste this whole production document into one generation. Each prompt already includes its camera, cast, look, action, physical continuity and sound requirements.
4. Assemble the result with the narration and end card below. The first film finishes at approximately 21s; the other five at approximately 19s. These are planning timings, not measured voice cues. Use the actual read and action to set the final cuts.

These settings follow the current [fal Seedance 2.0 reference-to-video documentation](https://fal.ai/models/bytedance/seedance-2.0/reference-to-video/api), checked 2026-09-09. The endpoint accepts 4–15-second output clips, named image references and generated audio; a 19–21-second finished film therefore includes an edited brand tail. Native reference support does not guarantee exact timing or identity; review the generated action against the scene checks.

## Shared voice and end card

The explorer IS the Narrator. Retain the established **The Clipped Newsreel**, the dry 1940s British RP voice already cast for Daylight. Voiceover is recorded separately: none of the characters speaks or lip-syncs in the generated pictures. Roof narration is Rickard's selected wording; intro uses the existing script. Whale, honeypot, rug and mechanical bull have no speech during the scene.

For films 2–6, after the final visual payoff, fade over about half a second to the established black Daylight end card. Keep the exact approved wordmark and the written subtitle **“the on-chain survival kit”**, with the existing small **“Contains AI-generated footage”** disclosure. Hold the card for the full closing read, approximately four seconds:

> Introducing Daylight. The onchain survival kit.

Film 1 uses approximately six seconds for:

> Stay one step ahead with Daylight. The on-chain survival kit.

Use the established end-card design, typeset/composited in the edit, so the name and text remain exact. No generative logo or invented UI. The repository's existing end-card frames are visual references; the final brand asset and exact mobile Daylight screen are finishing inputs. No music is specified; silence, physical sound and the restrained voice carry these films.

## Film order

| Film | Generated picture | Brand tail | Finished target | Spoken material |
|---|---:|---:|---:|---|
| 1. One step ahead | 15s | 6s | 21s | Two short scene lines, then brand |
| 2. Outrun the bear market | 15s | 4s | 19s | Rickard's lap-six/seven narration, then brand |
| 3. The whale | 15s | 4s | 19s | Brand only |
| 4. The honeypot | 15s | 4s | 19s | Brand only |
| 5. The rug | 15s | 4s | 19s | Brand only |
| 6. The mechanical bull | 15s | 4s | 19s | Brand only |

## 01. One step ahead

**Paste:** `prompts/01-one-step-ahead.txt`

**Attach in this order:**

- **@Image1**: `references/cast-and-forest.jpg`
- **@Image2**: `references/bear-and-honeypot.jpg`

### Complete generation prompt

```text
CAMERA
A 15-second sequence with exactly three shots: a locked eye-level woodland wide shot, one tight side-tracking phone insert, then a cut back to the identical wide-shot camera position. Landscape 16:9. All running travels screen-left to screen-right. No reverse angle, montage, extra cuts or camera orbit.

@Image1 establishes the two human characters and forest lighting. Remove the rug from this scene. @Image2 establishes the bear; do not reproduce the honey pot or seated pose.

LOOK AND CAST
Photorealistic cinematic woodland comedy, natural golden late-afternoon light, rich evergreen forest, warm sun shafts, restrained earthy colours, realistic skin, fur, fabric, wood and water. Match the attached reference images for character identity and environment; they are appearance references, not instructions to repeat their original action. Natural live-action movement with dry visual comedy. Our man is the same heavyset young adult crypto trader in a lime-green bucket hat, pale-grey hoodie, black knee-length shorts, white socks and dark sandals, with black over-ear headphones resting around his neck. The explorer is the same older gentleman with a prominent moustache, khaki pith helmet, classic British khaki safari jacket over a shirt, matching shorts, brown belt and outdoor boots. He is quietly observant and composed. Preserve their faces, body proportions and costumes throughout. Our man's expression is sincere and recognisable, never a caricature. Animals remain realistic animals.

SCENE AND TIMED ACTION
0–3 seconds, wide: our man stands slightly right of centre on a forest path, scrolling his smartphone in his right hand and holding a dark energy-drink can in his left. The path extends horizontally across the frame. He is completely absorbed. The explorer and bear are not yet visible.
3–5 seconds, same wide: the explorer abruptly sprints into frame from the left, passes just behind our man and continues off to the right. He carries his own smartphone in his right hand. Our man only begins to register the movement. Do not show or announce the bear yet.
5–7 seconds, the sole insert: a tight side-tracking close-up of the explorer's right hand and phone while he runs left to right. A brief restrained slow-motion feeling. The phone screen faces the camera enough for later screen replacement; it is a plain dark illuminated surface, steady in the hand for one readable moment. Preserve the same sleeve, hand and phone. Do not invent an app or analytics graphics.
7–9 seconds, return to the original wide: our man looks screen-right after the departing explorer, then turns his head screen-left. His own phone stays in his right hand. His body has not changed position.
9–11 seconds: only now reveal one large brown bear charging in from the left, uncomfortably close and heading along the same path. Our man's face registers it. The bear roars as it becomes visible.
11–13 seconds: our man instantly takes off screen-right after the explorer, still holding his own phone and can. A small splash escapes the can. His start is awkward but physically credible, then he accelerates.
13–15 seconds: our man exits right. The bear follows him rightward and exits without contact. Hold the empty forest path as their footsteps recede.

PHYSICS AND AUDIO
The bear approaches from the same direction the explorer came from. It never teleports or crosses in front of the fleeing man. Phones remain in the stated hands; both men have separate phones. Keep the explorer's run continuous across the insert. Birds and soft woodland ambience initially, approaching and passing footfalls, brief narrowed sound over the insert, then normal sound. No early bear growl. The first roar belongs to the reveal. Running and can splash, then receding footsteps.

SOUND AND FINISH
Generate only the specified natural location sound and effects. No spoken words, no lip-sync, no narrator, no music. Do not put captions, logos, titles, readable phone-interface text or watermarks into the generated scene. Keep the final image alive until the clip ends; the editor adds the fade, brand card and separately recorded narration afterward. No cartoon effects, exaggerated rubber limbs, gore, injury detail, magical motion, extra people, duplicate animals or changing props. Preserve the physical order of cause and effect. The listed seconds are pacing targets, with the pauses and final reaction more important than exact frame timing.
```

### Voice and edit

| Approximate time | Narration / direction |
|---|---|
| 0.0–3.0 | Our man is waiting for a signal. |
| 12.0–14.0 | Ah. Message received. |
| 15.0–21.0 | Stay one step ahead with Daylight. The on-chain survival kit. |

Replace the plain phone screen in the 5–7s insert with the real approved Daylight mobile screen, tracked to the phone and masked behind the fingers. It must be recognisably Daylight before the bear reveal; no invented forecast or alert. The phone screenshot is a remaining finishing asset, not supplied in this pack. Let the roar and initial scramble breathe. From 15s, soften/fade the woodland into the end card and give the final line approximately six seconds. Keep existing intro lines from v2; this is the only three-shot scene.

### Review the generated take

- Explorer passes left to right before phone insert; our man looks right, then left.
- Bear first appears at the reveal, not in the establishing frame.
- The exact Daylight screen must be composited before this is a finished introduction.

## 02. Outrun the bear market

**Paste:** `prompts/02-outrun-the-bear-market.txt`

**Attach in this order:**

- **@Image1**: `references/cabin.jpg`
- **@Image2**: `references/cast-and-forest.jpg`
- **@Image3**: `references/bear-and-honeypot.jpg`

### Complete generation prompt

```text
CAMERA
One continuous locked elevated three-quarter wide shot for 15 seconds, landscape 16:9. Frame the entire small cabin and the circuit around it, while keeping the explorer's head, shoulders and tea cup readable on the near roof slope. No cuts, orbit, zoom or aerial flyover.

@Image1 is the exact Daylight cabin and setting: preserve its distinctive roof, walls, scale and clearing. @Image2 establishes human identity and clothing. @Image3 establishes the bear. Recompose only enough to make the sip legible.

LOOK AND CAST
Photorealistic cinematic woodland comedy, natural golden late-afternoon light, rich evergreen forest, warm sun shafts, restrained earthy colours, realistic skin, fur, fabric, wood and water. Match the attached reference images for character identity and environment; they are appearance references, not instructions to repeat their original action. Natural live-action movement with dry visual comedy. Our man is the same heavyset young adult crypto trader in a lime-green bucket hat, pale-grey hoodie, black knee-length shorts, white socks and dark sandals, with black over-ear headphones resting around his neck. The explorer is the same older gentleman with a prominent moustache, khaki pith helmet, classic British khaki safari jacket over a shirt, matching shorts, brown belt and outdoor boots. He is quietly observant and composed. Preserve their faces, body proportions and costumes throughout. Our man's expression is sincere and recognisable, never a caricature. Animals remain realistic animals.

SCENE AND TIMED ACTION
0–4 seconds: the chase is already happening. Our man runs clockwise around the small cabin with one brown bear a few strides behind. The explorer sits comfortably on the near roof slope, a tea cup in his right hand. He has already been drinking it. He watches without alarm. Nobody speaks on camera.
4–6 seconds: our man and the bear disappear naturally behind the cabin on the far side. Hold the roof and the continuing footfalls for a full comic beat.
6–8 seconds: our man, then the bear, reappear around the near corner and cross a clearly visible landmark such as the cabin's front corner. This is the passage the narrator will call lap six.
8–11 seconds: they continue the same clockwise circuit. Let the pair disappear behind the cabin again. At approximately 11 seconds, they reappear at the SAME landmark on the following circuit. This is the passage the narrator corrects to lap seven. The small cabin and running speed must make this circuit physically plausible; never teleport them or reverse their direction to manufacture the second pass.
11–13 seconds: the explorer raises his existing tea cup and takes one slow, contented sip as the runners continue below.
13–15 seconds: he lowers the cup slightly and rests, while the chase continues around the cabin. Hold his calm posture.

PHYSICS AND AUDIO
Only one man running and one bear chasing. They follow a clear ground-level loop around the building; neither clips through the cabin, jumps onto the roof or changes direction. The explorer sits securely with believable weight on the roof. His tea cup exists from the first frame and never swaps hands. Keep the cup away from his mouth while later voiceover is speaking; the narration is offscreen. Footsteps, distant panting, bear breath, forest air and a small audible sip. No music or speech.

SOUND AND FINISH
Generate only the specified natural location sound and effects. No spoken words, no lip-sync, no narrator, no music. Do not put captions, logos, titles, readable phone-interface text or watermarks into the generated scene. Keep the final image alive until the clip ends; the editor adds the fade, brand card and separately recorded narration afterward. No cartoon effects, exaggerated rubber limbs, gore, injury detail, magical motion, extra people, duplicate animals or changing props. Preserve the physical order of cause and effect. The listed seconds are pacing targets, with the pauses and final reaction more important than exact frame timing.
```

### Voice and edit

| Approximate time | Narration / direction |
|---|---|
| 0.0–4.3 | Our man has decided to outrun the bear market. |
| 4.3–6.0 | [No speech. Take a beat.] |
| 6.0–8.2 | He is on lap six. |
| 9.7–11.2 | No, wait... seven. |
| 11.2–15.0 | [No speech. Tea sip, then fade.] |
| 15.0–19.0 | Introducing Daylight. The onchain survival kit. |

Keep Rickard's exact chosen wording, with six/seven spoken as words. This is an absent-minded correction, not a shouted punchline. Place “seven” against the next completed passage of the same landmark. We join the chase in progress: do not show five preliminary laps or add a lap-counter overlay. If the generated circuit timing differs, shift the two count lines to the actual passes; never speed the entire clip unnaturally. Hold the sip, then fade at 15s and add the four-second end card.

### Review the generated take

- Same landmark is crossed on successive circuits; the six/seven correction has a visible cause.
- Tea is present from the opening and the sip is clearly visible.
- Our man and bear remain on the ground; the cabin matches the reference.

## 03. The whale

**Paste:** `prompts/03-whale.txt`

**Attach in this order:**

- **@Image1**: `references/lake-and-pier.jpg`
- **@Image2**: `references/cast-and-forest.jpg`

### Complete generation prompt

```text
CAMERA
One continuous locked eye-level wide shot for 15 seconds, landscape 16:9. Match the lake composition: small rowing boat and our man on screen-left, wooden pier and explorer on screen-right, mountain and forest beyond. Keep both men, the umbrella and enough open water for the whale readable. No cuts, zoom, orbit or underwater shot.

@Image1 establishes the boat, pier, mountain lake and relative character positions. @Image2 reinforces the established character identities. This version is a splash under an umbrella, not the original boat-ejection action.

LOOK AND CAST
Photorealistic cinematic woodland comedy, natural golden late-afternoon light, rich evergreen forest, warm sun shafts, restrained earthy colours, realistic skin, fur, fabric, wood and water. Match the attached reference images for character identity and environment; they are appearance references, not instructions to repeat their original action. Natural live-action movement with dry visual comedy. Our man is the same heavyset young adult crypto trader in a lime-green bucket hat, pale-grey hoodie, black knee-length shorts, white socks and dark sandals, with black over-ear headphones resting around his neck. The explorer is the same older gentleman with a prominent moustache, khaki pith helmet, classic British khaki safari jacket over a shirt, matching shorts, brown belt and outdoor boots. He is quietly observant and composed. Preserve their faces, body proportions and costumes throughout. Our man's expression is sincere and recognisable, never a caricature. Animals remain realistic animals.

SCENE AND TIMED ACTION
0–3 seconds: both men sit fishing in apparent peace. Our man sits in a tiny wooden rowing boat just left of the pier, absorbed in the water. The explorer sits on the pier with his fishing rod resting safely in a simple holder beside him. A closed dark umbrella lies within his reach. Water is almost still and the sky is clear.
3–5 seconds: the explorer briefly glances at the phone in his left hand, puts it into his shirt pocket, then calmly picks up and opens the umbrella. The screen is not presented as a product insert and no readable text is needed. His rod remains in its holder. All props stay physically distinct.
5–7 seconds: our man turns screen-right toward the explorer and looks up at the open umbrella, puzzled by it on a clear day. The explorer angles the umbrella toward the open water and settles beneath it. Give this puzzled look a full beat.
7–10 seconds: a large realistic whale breaches in the open water beyond and just left of the boat, then falls back into the lake. It does not strike the boat or either person. Its landing sends a broad sheet of spray toward the men.
10–12 seconds: the spray drenches our man, his hat and hoodie. The boat rocks but stays upright and our man remains seated inside it. The explorer's angled umbrella intercepts the spray reaching his head and upper body. Water cascades from the umbrella's rim. Keep the wave reaching the pier modest enough for an umbrella to be a credible shield against spray rather than a tsunami.
12–15 seconds: our man sits soaked and motionless, then gives the explorer a flat sideways look. The explorer calmly continues sitting beneath the umbrella; one last drip falls from its edge. Hold the contrast. The whale has submerged and does not reappear.

PHYSICS AND AUDIO
The fictional lake contains a whale, but the breach, gravity, water displacement and spray behave like live-action physics. One whale, one boat, one pier, one umbrella. Do not capsize the boat, eject our man or have the umbrella hold back a solid wall of water. The explorer does not vanish or become entirely submerged. Soft water and birds, umbrella click, breathy whale breach, heavy splash, then close dripping water. No spoken reaction and no narration.

SOUND AND FINISH
Generate only the specified natural location sound and effects. No spoken words, no lip-sync, no narrator, no music. Do not put captions, logos, titles, readable phone-interface text or watermarks into the generated scene. Keep the final image alive until the clip ends; the editor adds the fade, brand card and separately recorded narration afterward. No cartoon effects, exaggerated rubber limbs, gore, injury detail, magical motion, extra people, duplicate animals or changing props. Preserve the physical order of cause and effect. The listed seconds are pacing targets, with the pauses and final reaction more important than exact frame timing.
```

### Voice and edit

| Approximate time | Narration / direction |
|---|---|
| 0.0–15.0 | [No narration or dialogue.] |
| 15.0–19.0 | Introducing Daylight. The onchain survival kit. |

Use the umbrella-and-splash story throughout. Remove every earlier whale line, including “Lovely weather for it” and the boat-position joke. The umbrella opening, puzzled look and splash tell the story. Hold the drenched reaction and final drip before fading at 15s. Add the established four-second brand close. The reference video supplies appearance and geography, not the revised action.

### Review the generated take

- Umbrella opens BEFORE the breach; our man notices it before the water lands.
- Our man stays in an upright boat and gets soaked; explorer is protected from spray.
- Final wet reaction and umbrella drip have room; no added spoken joke.

## 04. The honeypot

**Paste:** `prompts/04-honeypot.txt`

**Attach in this order:**

- **@Image1**: `references/bear-and-honeypot.jpg`
- **@Image2**: `references/cast-and-forest.jpg`

### Complete generation prompt

```text
CAMERA
One continuous locked medium-wide shot for 15 seconds, landscape 16:9. A low broad tree stump with a brown honey pot stands just left of centre. Frame our man's whole body, the pot opening and the clear bear entrance on screen-right. Leave enough room below the stump to see him sit on the ground. No cuts, zoom, camera shake or sudden close-up.

@Image1 establishes the pot, bear, woodland and our man. @Image2 establishes the explorer and human costumes. The final defeated seated posture is the target emotional state; do not begin the film in that final pose.

LOOK AND CAST
Photorealistic cinematic woodland comedy, natural golden late-afternoon light, rich evergreen forest, warm sun shafts, restrained earthy colours, realistic skin, fur, fabric, wood and water. Match the attached reference images for character identity and environment; they are appearance references, not instructions to repeat their original action. Natural live-action movement with dry visual comedy. Our man is the same heavyset young adult crypto trader in a lime-green bucket hat, pale-grey hoodie, black knee-length shorts, white socks and dark sandals, with black over-ear headphones resting around his neck. The explorer is the same older gentleman with a prominent moustache, khaki pith helmet, classic British khaki safari jacket over a shirt, matching shorts, brown belt and outdoor boots. He is quietly observant and composed. Preserve their faces, body proportions and costumes throughout. Our man's expression is sincere and recognisable, never a caricature. Animals remain realistic animals.

SCENE AND TIMED ACTION
0–3 seconds: our man stands hunched over the low stump with his LEFT hand stuck inside the narrow opening of the honey pot. His wrist remains visibly in the opening. He gives a small hopeful tug, then braces his free right hand against the stump. The pot stays on the stump. The explorer walks past in the background carrying his own small closed jar and continues away, taking no part in the predicament.
3–6 seconds: our man tries harder once, planting a foot against the stump for leverage. His hand does not come out. He stops and lets his shoulders drop. Keep this brief effort natural rather than frantic slapstick.
6–8 seconds: one large brown bear quietly enters from screen-right and approaches the stump. Our man notices it. His effort stops completely. He looks at the bear, then at his trapped hand. The explorer has already walked out of frame.
8–10 seconds: our man gives ONE very small, slow, almost defeated final tug. It has barely any force. The hand does not move out of the pot. He already knows it will not work. No vigorous final yank, renewed panic or attempt to run.
10–12 seconds: he lowers himself onto his backside beside the stump, his left hand STILL inside the pot. The stump is low enough that the arm can stay bent naturally while he sits. His legs extend loosely forward, knees relaxed; his free right hand drops into his lap. Shoulders sag. He settles with the sheepish, caught-in-the-act resignation of a little child with a hand in a cookie jar, while remaining unmistakably the same adult man.
12–15 seconds: hold the seated tableau completely. Our man sits on his backside, hand in the pot, looking quietly guilty and defeated. The bear stands nearby looking toward the pot without touching him. He does not tug again. Let three full seconds of embarrassed stillness finish the joke.

PHYSICS AND AUDIO
The same left wrist remains in the same pot opening from first frame to last. His hand never briefly slips free. The pot is heavy and sits securely on the low stump; do not fuse it to his body, stretch his arm or drag it onto the ground. Sitting must be anatomically possible at this stump height. One bear, no attack, no contact, no injury. Forest air, a little pot scraping, fabric and effort, the bear's soft footfalls and breathing. Once he sits, mostly quiet. No dialogue, whimper, “Oh dear,” narrator or music.

SOUND AND FINISH
Generate only the specified natural location sound and effects. No spoken words, no lip-sync, no narrator, no music. Do not put captions, logos, titles, readable phone-interface text or watermarks into the generated scene. Keep the final image alive until the clip ends; the editor adds the fade, brand card and separately recorded narration afterward. No cartoon effects, exaggerated rubber limbs, gore, injury detail, magical motion, extra people, duplicate animals or changing props. Preserve the physical order of cause and effect. The listed seconds are pacing targets, with the pauses and final reaction more important than exact frame timing.
```

### Voice and edit

| Approximate time | Narration / direction |
|---|---|
| 0.0–15.0 | [No narration or dialogue.] |
| 15.0–19.0 | Introducing Daylight. The onchain survival kit. |

Rickard's approved ending is defeated, not desperate. Preserve the tiny final tug, the actual movement down onto his backside, and the held child-caught-with-hand-in-cookie-jar posture. Do not fade while he is still lowering himself. Let the seated pose read for three seconds, then fade at 15s. No “Oh, dear” option remains in this production version. Add the four-second brand close.

### Review the generated take

- Final tug is small, slow and defeated; no frantic last effort.
- He sits visibly on his backside with hand still in the pot.
- Hold the final pose three seconds BEFORE fading; he does not tug again.

## 05. The rug

**Paste:** `prompts/05-rug.txt`

**Attach in this order:**

- **@Image1**: `references/cast-and-forest.jpg`

### Complete generation prompt

```text
CAMERA
One continuous locked eye-level wide shot for 15 seconds, landscape 16:9, looking across the forest clearing. Frame both men head to toe on a patterned rug in the foreground, a clearly visible loose coil of rope on bare ground to the rug's right, and an unobstructed path in the background. The bull travels screen-left to screen-right. No cuts, zoom, whip-pan or camera orbit.

@Image1 establishes the clearing, rug and cast. Replace its original rug-pulling action completely. The explorer must never pull the rug or touch the rope.

LOOK AND CAST
Photorealistic cinematic woodland comedy, natural golden late-afternoon light, rich evergreen forest, warm sun shafts, restrained earthy colours, realistic skin, fur, fabric, wood and water. Match the attached reference images for character identity and environment; they are appearance references, not instructions to repeat their original action. Natural live-action movement with dry visual comedy. Our man is the same heavyset young adult crypto trader in a lime-green bucket hat, pale-grey hoodie, black knee-length shorts, white socks and dark sandals, with black over-ear headphones resting around his neck. The explorer is the same older gentleman with a prominent moustache, khaki pith helmet, classic British khaki safari jacket over a shirt, matching shorts, brown belt and outdoor boots. He is quietly observant and composed. Preserve their faces, body proportions and costumes throughout. Our man's expression is sincere and recognisable, never a caricature. Animals remain realistic animals.

SCENE AND TIMED ACTION
0–2 seconds: both men stand on the rug. Our man stands on its left half, looking down at the phone in his right hand. The explorer stands near its left/front edge, already drinking tea from a small cup in his right hand. A realistic adult bull runs briskly left to right along the background path and out of frame. A long rope is visibly tied to its tail and trails behind it. The other end is securely attached to the RIGHT edge of the rug, with ample slack arranged as a loose low coil on the bare ground to the rug's right.
2–6 seconds: the bull is now offscreen right. The loose coil slowly pays out across the ground toward screen-right, becoming visibly smaller. The rug stays completely still because slack remains. Let several empty beats pass. Our man continues looking down at his phone. The explorer notices the paying-out rope and lowers his cup slightly.
6–8 seconds: keeping the tea steady in his right hand, the explorer calmly steps OFF the rug toward the camera and slightly left, onto clear ground outside the rug's path. Our man remains on the rug, staring at his phone. The last few coils continue slipping away.
8–10 seconds: the final loop disappears. Our man begins to look up from his phone. At that exact moment, the rope becomes fully taut in a clear straight pull toward screen-right. The explorer is already safely off the rug, cup still in hand.
10–12 seconds: the taut rope yanks the rug sharply screen-right from beneath our man's feet. He loses his footing and lands harmlessly on his backside on the soft ground. One quick credible fall, not a somersault or flight through the air. The rug travels in the rope's direction, away from the explorer. The bull remains offscreen.
12–15 seconds: the explorer, who has held his tea throughout, takes another unhurried sip. Our man sits on the ground in bewilderment, still holding his phone. Hold this final image; the explorer never looks pleased to have caused anything because he did not cause it.

PHYSICS AND AUDIO
One bull and one continuous rope, attached to the tail at one end and rug at the other, visible as the setup. No tail injury. Loose rope alone accounts for the delayed pull: it must visibly pay out rather than shrink or dissolve. The rope never wraps around either person. The rug does not move until the last slack is gone. The explorer steps clear BEFORE tension reaches the rug and keeps the same tea cup from beginning to end. Hooves pass and recede, soft rope sliding, a brief taut-rope snap, rug scrape, one soft thump, then a small tea sip. No speech, narration, explanation, cartoon boing or music.

SOUND AND FINISH
Generate only the specified natural location sound and effects. No spoken words, no lip-sync, no narrator, no music. Do not put captions, logos, titles, readable phone-interface text or watermarks into the generated scene. Keep the final image alive until the clip ends; the editor adds the fade, brand card and separately recorded narration afterward. No cartoon effects, exaggerated rubber limbs, gore, injury detail, magical motion, extra people, duplicate animals or changing props. Preserve the physical order of cause and effect. The listed seconds are pacing targets, with the pauses and final reaction more important than exact frame timing.
```

### Voice and edit

| Approximate time | Narration / direction |
|---|---|
| 0.0–15.0 | [No narration or dialogue.] |
| 15.0–19.0 | Introducing Daylight. The onchain survival kit. |

The coil is the visible countdown. Preserve its several-beat run-down and the order: explorer off, our man still scrolling, upward glance, rope taut, rug pulled, tea sip. Never rescue unclear rope physics with explanatory narration. Fade only after the sip at 15s, then add the four-second brand close. The existing rug film is an appearance reference; its explorer-pulls-rug action is superseded.

### Review the generated take

- Bull tail → rope → slack coil → rug attachment form one understandable mechanism.
- Rug stays still while slack remains; explorer steps off before tension.
- Our man looks up as the rope becomes taut; explorer sips afterward with the cup he had all along.

## 06. The mechanical bull

**Paste:** `prompts/06-mechanical-bull.txt`

**Attach:** **@Image1** = `references/cast-and-forest.jpg`. This supplies cast and setting only. Match the living bull to film 5's selected design when available; no real-bull identity reference is supplied yet.

### Complete generation prompt

```text
CAMERA
One continuous locked eye-level wide shot for 15 seconds, landscape 16:9. A clearing in the forest, with a small mechanical bull and its low fixed base in the near foreground, slightly right of centre. An open forest path passes behind it from screen-left to screen-right. Frame our man's entire body, the whole mechanical ride and enough background space to see a real bull with a standing rider pass clearly. No cuts, close-ups, zoom, orbit or tracking away from our man.

REFERENCE
@Image1 establishes the two human characters, their costumes and the forest's light and texture. It is an appearance reference only. Remove the rug and rope; there is no bear, tea cup or phone in this scene. The real bull should match the bull selected for film 5 when that design is available; the provided image does not contain a bull reference.

LOOK AND CAST
Photorealistic cinematic woodland comedy, natural golden late-afternoon light, rich evergreen forest, warm sun shafts, restrained earthy colours, realistic skin, fur, fabric, wood and water. Match the attached reference images for character identity and environment; they are appearance references, not instructions to repeat their original action. Natural live-action movement with dry visual comedy. Our man is the same heavyset young adult crypto trader in a lime-green bucket hat, pale-grey hoodie, black knee-length shorts, white socks and dark sandals, with black over-ear headphones resting around his neck. The explorer is the same older gentleman with a prominent moustache, khaki pith helmet, classic British khaki safari jacket over a shirt, matching shorts, brown belt and outdoor boots. He is quietly observant and composed. Preserve their faces, body proportions and costumes throughout. Our man's expression is sincere and recognisable, never a caricature. Animals remain realistic animals.

SCENE AND TIMED ACTION
0–4 seconds: our man sits astride a small, visibly artificial mechanical bull on a squat amusement-ride base, alone in the foreground. The ride has the scale and weak repetitive movement of a coin-operated children's horse outside a shopping centre: a rigid moulded bull body, a simple saddle and a shallow rocking pivot. It slowly rocks a few degrees forward and back. Our man sits heavily, shoulders slack, hands resting loosely on the ride's handle, expression blank. He makes no attempt to buck, bounce, cheer or ride enthusiastically. The incongruous little machine is simply out here among the trees.
4–5 seconds: deep thundering hoofbeats approach from offscreen left, sharply contrasting with the small ride's tired motor hum. Our man starts to turn his head toward the sound while the mechanical bull continues its same tiny slow rocking motion.
5–7 seconds: a powerful real bull thunders left to right along the path behind him, several metres away. The explorer stands upright on the bull's broad back as if surfing, both boots planted in a wide fore-and-aft stance, knees softly bent, arms slightly extended for balance. His composure is effortless. He rides standing for the entire visible pass, never seated in a saddle. The bull gallops through and exits screen-right with the explorer still balanced on its back. A little dust trails behind them. Neither touches our man or the mechanical ride.
7–10 seconds: stay in the original wide shot. Our man's gaze follows the explorer to screen-right and then remains there for several full beats after the real bull has exited. He looks faintly bewildered rather than excited or jealous. His own ride keeps rocking slowly beneath him. Let the sound of the departing hooves diminish until the little motor hum is audible again. The mechanical ride has not failed yet.
10–12 seconds: while our man is still looking after the explorer, the mechanical bull slowly leans sideways toward screen-left, beyond its normal shallow range. The body visibly sags at the mounting pivot. Hold a tiny pause at an obviously excessive angle. One dry mechanical crack: the support joint fails. The real bull's wake did not strike it; this is a delayed mechanical breakdown under its own rider.
12–13 seconds: the moulded bull body tips onto its side beside the fixed base, dropping our man the short distance onto the soft earth on screen-left. One awkward, unglamorous fall onto his backside/hip, legs sliding clear of the ride. No flip, launch, crushed limb or injury detail. The base remains planted; the motor stops.
13–15 seconds: hold the unchanged wide composition. Our man sits on the ground beside the visibly broken, motionless ride. The proper bull and explorer are long gone. A final little mechanical rattle settles, leaving forest ambience. His deadpan expression is the last image. Do not have him stand up or begin another gag. The editor fades only after this beat.

PHYSICS AND AUDIO
There are exactly two distinct bulls: one inert moulded amusement-ride body mounted to a base, and one living animal galloping through the background. The mechanical bull never becomes alive; its legs are rigid decorative shapes and it moves only at its pivot. The real bull never becomes a machine or breaks. The explorer's feet stay in contact with the real bull's back, his knees absorb the gait and his body maintains believable balance within this deliberately absurd surfing premise. No levitation, ropes, wheels, surfboard, saddle-sitting or airborne rider. The two bulls never collide. The machine's failure comes AFTER the real bull has left and AFTER the sustained following gaze: slow sideways over-tilt, joint crack, short fall, stillness. Keep the camera and ground scale consistent. Sound progression: weak repetitive electric hum and tiny squeak; approaching thunder of hooves; powerful passing hoofbeats; receding hooves; exposed pathetic motor hum; strained creak; one dry crack; soft thump; final rattle; quiet forest. No music, dialogue, narrator or comic cartoon effects.

SOUND AND FINISH
Generate only the specified natural location sound and effects. No spoken words, no lip-sync, no narrator, no music. Do not put captions, logos, titles, readable phone-interface text or watermarks into the generated scene. Keep the final image alive until the clip ends; the editor adds the fade, brand card and separately recorded narration afterward. No cartoon effects, exaggerated rubber limbs, gore, injury detail, magical motion, extra people, duplicate animals or changing props. Preserve the physical order of cause and effect. The listed seconds are pacing targets, with the pauses and final reaction more important than exact frame timing.
```

### Voice and edit

| Approximate time | Narration / direction |
|---|---|
| 0–15s | No narration or dialogue. Let the motor, hooves, silence and mechanical crack tell the story. |
| 15–19s | Introducing Daylight. The onchain survival kit. |

The contrast is in the motion and sound: our man barely rocking on a children's ride, then the explorer surfing past on a real thundering bull. Keep our man's following gaze for several beats after the pass. The sideways lean and break arrive late, when the exciting thing is already gone. Hold him sitting beside the collapsed ride before fading into the established four-second Daylight card. No extra punchline, explanatory slogan or phone insert.

### Review the generated take

- The mechanical ride is small, slow and feeble from the opening; our man is passive.
- Explorer stands surfing on the real bull for the entire pass; neither contacts the mechanical ride.
- Our man's gaze follows rightward for several beats before the mechanical bull over-tilts.
- Failure order: slow sideways lean, excessive angle, support joint breaks, short fall, settled reaction, fade.
- Two different bulls remain physically distinct; the living animal never breaks and the machine never gallops.

## Source assets and readiness

The four JPEGs are unchanged single frames extracted from the eight previously reviewed DaylightTrailers drafts, main at `5d4185c85c3eb21272b60bb4bc951ac4aa63e194`:

| Included reference | Source clip and time | Role |
|---|---|---|
| cast-and-forest.jpg | daylight-mini-rug-narrated-draft-1080p.mp4, 0s | Both characters, costume, forest and rug |
| cabin.jpg | daylight-cabin-chase-narrated-1080p.mp4, 0s | The specific Daylight cabin and roof |
| lake-and-pier.jpg | daylight-mini-whale-narrated-draft-1080p.mp4, 0s | Boat-left/pier-right layout, landscape, characters |
| bear-and-honeypot.jpg | daylight-mini-honeypot-narrated-draft-1080p.mp4, 8s | Bear, pot and woodland |

Use these as appearance references, not exact start frames: several depict a different action or a late beat. If the production team has the approved character turnarounds, those are better identity references and should retain the same appearance. Reference frames alone do not establish a fresh approval of character design.

`manifest.json` is a local handoff index, not an executable API request. It records prompt paths, ordered local reference paths, settings and narration. To use an API, supply the file contents as prompt and upload the listed references through the provider's normal interface; private GitHub URLs are not directly fetchable public inputs. No upload or API call has been made here.

All six scene scripts are complete. Remaining execution inputs are the established voice, exact end-card assets and the real Daylight phone screen for film 1. Generated footage still requires review, especially the roof circuit count, umbrella splash, honey-pot wrist continuity and the rope's delayed pull. If a complex scene misses its physical sequence, split it at the natural cut between anticipation and payoff using a matched continuation frame; do not replace the chosen story with a different gag.

Changes from v2: honey-pot final tug is almost defeated, followed by sitting on his backside with hand still trapped and a held cookie-jar tableau; whale uses the umbrella/splash version with brand-only narration; roof and rug preserve Rickard's selected words and actions. Earlier drafts remain historical creative development, not alternate instructions for this batch.

Revision v4: added Rickard’s mechanical-bull scene as film 6. The first five prompts remain unchanged. The mechanical-bull scene is newly scripted; no corresponding footage or bull reference has been generated.
