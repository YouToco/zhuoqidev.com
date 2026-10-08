# 3D models

The clay scene at the top of the Argus project page (`src/components/ArgusStory.astro`) is
built from primitives in code: `src/scripts/argus-story-model.ts`. It is one real search
through Argus's sample video in six step groups (`step0_video` … `step5_browser`), with
`focus_step*` empties the web camera looks at and `pin_*` empties the HTML labels hang from.
The page builds it in the browser after the reader's first input (about 8 KB gzipped, no
model file), and `src/scripts/argus-story-scene.ts` animates it by those names.

The story follows one recorded run (DeepSeek, 2026-10-08): `argus-story-run.json` holds the
question, every tool call with its input and result, the frame counts and the answer. The
scene, the step text and the tool-call lines on the cards follow that record; if you rerun
it and the agent takes another path, change all three together.

## After changing the model

The page shows a poster first: the same scene path traced, which readers without WebGL keep.
Render it again, with its camera and label spots, whenever the model changes:

```bash
npm run poster
```

It installs this folder's packages on first use, builds the scene from the page's own model in
Chrome, frames it, path-traces it with `three-gpu-pathtracer` (eight passes of 128 samples,
about two minutes on a laptop GPU) and writes three files to `src/assets/models/`:

- `argus-story-poster.webp`: 1800 × 1150, transparent background;
- `argus-story-camera.json`: the poster's camera; the 3D scene opens on it, so the swap from
  picture to canvas does not jump;
- `argus-story-pins.json`: where each `pin_*` lands on the poster, for the labels.

It needs a real GPU. On a laptop with switchable graphics, hand Chrome the discrete one:

```bash
__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia npm run poster
```

Each pass prints the GPU it ran on; software rendering (SwiftShader) is refused. A single
WebGL context that renders for much longer than about 15 seconds gets reset by Chrome's GPU
process and comes back blank, which is why the poster is several short passes in fresh
browsers, each with its own random seed, averaged in linear light. `PASSES` and `SAMPLES`
override the defaults.

The 3D text (the `?` and the `10.0s – 25.0s` on the answer card) uses a few glyphs of Inter in
`src/assets/models/argus-story-glyphs.json`. To set other characters, change `CHARS` and run
`npm --prefix tools/models ci` once, then `node tools/models/argus-glyphs.mjs`; it downloads
Inter 4.1 from a pinned commit and checks its SHA-256.

## Notes

- A few things move only in the browser (`argus-story-scene.ts`): the eyes follow the current
  step and blink; the frames (`s1_pkt*`) and the tool call ride the wire along the cable's
  sampled path (`userData.wire` on the built scene); in the tray the skim's frames
  (`s3_tray_old*`, hidden in the poster) give way to the slip of text. The poster shows all of
  it at rest, the tray already swapped.
- The step text and the label wording live in `src/data/argus-story.ts`; pin names there
  must match the `pin_*` empties.
- Keep the model light: no texture coordinates, coarse text curves without bevel (about 50k
  triangles now).
- The scene was first modelled in Blender (until 2026-10-08), so the model is laid out in
  Blender's axes (z up) and turned to three's at the end, and the poster's lights and framing
  follow that setup. The code replaced it to drop the 76 KB model file and the GLTF loader
  (about 97 KB, gzipped, before the 3D scene could show) and to keep the model and its
  animation in one place.
