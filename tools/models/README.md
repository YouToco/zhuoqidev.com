# 3D models

`argus-story.py` builds the clay scene at the top of the Argus project page
(`src/components/ArgusStory.astro`): one real search through Argus's sample video, in six
step groups (`step0_video` … `step5_browser`), plus `focus_step*` empties the web camera
looks at and `pin_*` empties the HTML labels hang from. Everything is generated from
primitives in the script; there is no `.blend` file to keep in sync.

The page does not load anything from here at build time. Regenerate the committed files
in `src/assets/models/` by hand after changing the script:

```bash
mkdir -p out
# Blender 5.2 LTS: builds the scene, exports the GLB, the pin and camera JSON, and renders the poster
blender -b -P tools/models/argus-story.py -- "$PWD/out"
# meshopt compression (EXT_meshopt_compression + KHR_mesh_quantization): about 810 KB -> 280 KB
npx @gltf-transform/cli@4.5.1 meshopt out/argus-story.glb out/argus-story.meshopt.glb --level high
# gzip on top (about 77 KB): neither host compresses .glb; the page unzips it with DecompressionStream
gzip -9 -n -c out/argus-story.meshopt.glb > src/assets/models/argus-story.glb.gz
cp out/argus-story-pins.json out/argus-story-camera.json src/assets/models/
node -e "import('sharp').then(({ default: s }) => s('out/argus-story-poster.png').webp({ quality: 92, effort: 6 }).toFile('src/assets/models/argus-story-poster.webp'))"
```

- The poster render (1800 × 1150, transparent background, Cycles) is what the page shows
  first and what readers without WebGL keep; `argus-story-pins.json` places the labels on it.
  `argus-story-camera.json` is the poster's camera, so the 3D scene opens on the same view.
- The step text and the label wording live in `src/data/argus-story.ts`; pin names there
  must match the `pin_*` empties.
- Keep the model light: no texture coordinates, low-resolution text curves without bevel.
  The 3D text and the eyes were most of the triangles before that (about 38k now).
- Inside a running Blender (for example over Blender MCP) the same functions work
  interactively: `build()`, `export_glb(path)`, `pin_screen_coords(path)`, `camera_info(path)`.
