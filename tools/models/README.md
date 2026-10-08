# 3D models

`argus-story.py` builds the clay scene at the top of the Argus project page
(`src/components/ArgusStory.astro`): one real search through Argus's sample video, in six
step groups (`step0_video` … `step5_browser`), plus `focus_step*` empties the web camera
looks at and `pin_*` empties the HTML labels hang from. Everything is generated from
primitives in the script; there is no `.blend` file to keep in sync.

The story follows one recorded run (DeepSeek, 2026-10-08): `argus-story-run.json` holds the
question, every tool call with its input and result, the frame counts and the answer. The
scene, the step text and the tool-call lines on the cards follow that record; if you rerun
it and the agent takes another path, change all three together.

The page does not load anything from here at build time. Regenerate the committed files
in `src/assets/models/` by hand after changing the script:

```bash
mkdir -p out
# Blender 5.2 LTS: builds the scene, exports the GLB, the pin, camera and path JSON, and renders the poster
blender -b -P tools/models/argus-story.py -- "$PWD/out"
# meshopt compression (EXT_meshopt_compression + KHR_mesh_quantization): about 920 KB -> 300 KB
npx @gltf-transform/cli@4.5.1 meshopt out/argus-story.glb out/argus-story.meshopt.glb --level high
# gzip on top (about 76 KB): neither host compresses .glb; the page unzips it with DecompressionStream
gzip -9 -n -c out/argus-story.meshopt.glb > src/assets/models/argus-story.glb.gz
cp out/argus-story-pins.json out/argus-story-camera.json out/argus-story-paths.json src/assets/models/
node -e "import('sharp').then(({ default: s }) => s('out/argus-story-poster.png').webp({ quality: 92, effort: 6 }).toFile('src/assets/models/argus-story-poster.webp'))"
```

- The poster render (1800 × 1150, transparent background, Cycles) is what the page shows
  first and what readers without WebGL keep; `argus-story-pins.json` places the labels on it.
  `argus-story-camera.json` is the poster's camera, so the 3D scene opens on the same view.
- A few things move only in the browser (`src/scripts/argus-story-scene.ts`): the eyes
  follow the current step and blink; the frames (`s1_pkt*`) and the tool call ride the
  wire along `argus-story-paths.json` (the cable's sampled curve); in the tray the skim's
  frames (`s3_tray_old*`, hidden in the poster) give way to the slip of text. The poster
  shows all of it at rest, the tray already swapped.
- The step text and the label wording live in `src/data/argus-story.ts`; pin names there
  must match the `pin_*` empties.
- Keep the model light: no texture coordinates, low-resolution text curves without bevel.
  The 3D text and the eyes were most of the triangles before that (about 45k now).
- Inside a running Blender (for example over Blender MCP) the same functions work
  interactively: `build()`, `export_glb(path)`, `pin_screen_coords(path)`, `camera_info(path)`, `paths_info(path)`.
