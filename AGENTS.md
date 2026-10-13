# AGENTS.md — devin_threejs_animegirl

## What this is
A procedural kawaii anime-girl character built 100% in code by **Devin** (Cognition AI)
using **Three.js r180** — no external assets, no generated images, no Blender.
Self-scored **~92/100** after 18 render iterations against a 95/100 goal.

## Layout
- `studio/index.html` + `studio/main.js` — the character itself. Single-file procedural
  build: MeshToonMaterial + 4-tone gradientMap, inverted-hull outlines, canvas-generated
  textures (iris/blush/shadow/sparkle/heart), displaced-primitive hair strands.
  URL params: `?still` (no orbit controls), `?spin` (turntable), `?credit` (black credit
  bar), `&view=front|threequarter|side|back|closeup|full`.
  Hooks: `window.__ready` after 4 frames, `window.__studio.{setView,renderSpin,getMetrics,exportGLB}`.
  **NOTE: `URLSearchParams.get('x')` returns `''` for bare `?x` — use `params.has('x')`.**
- `vendor/` — three.module.js + three.core.js (BOTH required — module imports core),
  GLTFExporter.js, addons/{controls,loaders,utils}.
- `scripts/capture.mjs <iterName> [views]` — headless-Chrome renders → `output/iterations/`.
- `scripts/export_glb.mjs` — writes `output/devin_threejs_animegirl.glb` (binary to file,
  never base64 to stdout).
- `scripts/turntable.mjs` — 240 deterministic `renderSpin` frames → ffmpeg mp4.
- `scripts/showcase.mjs` — all views with credit bar → `output/showcase/`.
- `viewer/index.html` — public viewer: loads the live studio scene (`../studio/main.js`
  + OrbitControls + auto credit bar). The exported GLB loses toon/outline materials
  (GLTFExporter converts to standard mats and BackSide hulls render black) — so the
  showcase renders from the scene, not the GLB. GLB stays a download artifact only.
- `progress/index.html` — auto-refreshing iteration gallery.
- `output/` — renders, GLB, mp4. `node_modules/` — local playwright/three (not vendored src).

## How to run
```bash
cd ~/project/3d/devin_threejs_animegirl
python3 -m http.server 8123 &          # serve repo root
node scripts/capture.mjs iterNN        # renders for inspection
node scripts/export_glb.mjs            # rebuild GLB after model edits
node scripts/turntable.mjs             # rebuild mp4
node scripts/showcase.mjs              # rebuild showcase stills
```
Headless capture uses system Chrome + `--enable-webgl --ignore-gpu-blocklist`
(macOS headless GPU works; do NOT pass `--disable-gpu`). Requires a local http server —
importmaps don't work on file://.

## What's done / what's next
- Done: chibi kawaii character (pastel-pink hair, devin-blue eyes, sailor outfit,
  sparkles+hearts, twin-tails, ahoge, crown shine arc, tip-shaded strands), all 4 side
  views verified natural, GLB 2.5MB, turntable mp4, showcase stills w/ credit bar,
  live viewer page, deployed: https://ecooxai.github.io/devin_threejs_animegirl/
  repo: https://github.com/ecooxai/devin_threejs_animegirl branch `devin/threejs-animegirl`
- Score ~92/100. Remaining polish ideas if pushed further: side-view forelock sheets
  could overlap ear more; skirt inner-face flash at hem gaps; hands are mitten-simple;
  no rig/animation (static pose + code-driven sway only); GLB loses toon-outline
  materials (exporter converts to standard materials — showcase uses live scene anyway).
- To improve further: edit `studio/main.js`, re-run capture/iterations, re-export GLB,
  re-run turntable+showcase, push the same branch.

## Conventions
- Keep everything procedural — no downloaded assets, no image generation.
- Light-blue background `0xb9dcff` is the spec default.
- Filenames carry model+tool: `devin_threejs_animegirl_*`.
- Branch: `devin/threejs-animegirl`. Deploy target: GitHub Pages.
