# The elf's art: Blender to sprites

The Elf tab shows a Pou-style companion in its cottage. Drawing it in code
(Skia paths animated by hand) came out clumsy, stiff and slow, so the
character and the room are made here instead: modelled, rigged, lit and
animated in Blender by script, rendered to 2D frames with alpha, packed
into WebP atlases and played in the app as sprites. The phone draws
pictures, which is smooth on any device; the lighting, the cloth and the
particles are computed offline in Blender, where they can be as rich as
the renders allow; and clothes or furniture are extra layers rendered in
the same light. Nothing here needs the Blender window: every script runs
headless and rebuilds its scene from scratch, so the repository holds
code, not .blend files.

All of this art is the project's own, made in Blender from primitives and
scripts; no third-party models or textures are used (the CC BY model of
the first prototype, `assets/elf/elf.glb`, is not part of this pipeline).

## Installing

Blender 5.2 LTS, as a snap on Linux (`sudo snap install blender --classic`;
the binary is `/snap/bin/blender`) or from blender.org elsewhere; the
scripts below assume `blender` on the path. The packer runs with the
system Python 3 and Pillow (`python3 -m pip install pillow`); it does not
run inside Blender. Rendering uses Eevee over OpenGL, which works headless
on a desktop GPU; Cycles (CPU) is for the odd still.

Check the install with the smoke scene, which renders a few spheres in the
shared light and a short layered clip:

```bash
cd apps/mobile
pnpm art:smoke                         # -> art/out/smoke/smoke.png, frames/body and frames/hat
python3 art/blender/pack.py pack-layers art/out/smoke/frames --out art/out/smoke/atlas --scale 0.5
```

## The scripts

```
art/blender/common.py    shared helpers, imported by every build script: the scene (resolution, Standard view
                         transform, transparent film, Eevee at 32 samples), the orthographic camera, the light rig,
                         the toon material, the outline modifier, meshes from bmesh, armature parenting, the
                         renders, the anchor, saving a .blend for inspection
art/blender/smoke.py     the smoke test described above
art/blender/elf.py       the elf: the chibi model, its rig, its clips, rendered as layers (body, face_<mood>, hat_<id>)
art/blender/room.py      the cottage: the walls and the floor, the furniture of each slot, the fire (see The room)
art/blender/room_sheet.py the room's post-processing (system Python): sprite boxes, contact sheet, phone crop
art/blender/pack.py      the packer: frames to atlases and a manifest (system Python)
art/out/                 renders, logs, .blend files (not committed)
```

A build script is run as

```bash
blender --background --python art/blender/elf.py -- art/out/elf       # pnpm art:elf
blender --background --python art/blender/room.py -- art/out/room     # pnpm art:room
```

where everything after `--` belongs to the script (the output directory).
The scripts build their scene from nothing on every run; they may save a
`.blend` into `art/out` to open in the Blender GUI, but never read one.

The conventions `common.py` fixes, binding for every script: one Blender
unit is a metre; the character stands with its feet at the origin and
faces -Y, towards the camera, with Z up and +X to the screen's right; the
camera is orthographic at -Y, tilted down eight degrees, its `ortho_scale`
the visible height in metres; the view transform is Standard, so a
palette colour (`hex_to_linear`) renders as that colour; the film is
transparent and the frames are PNG RGBA. The light is one rig for
everything: a warm key from the upper right (the fireplace side), a cool
fill from the left (the moon in the window), a soft top light and a dim
cool ambient; soft shadows come from wide shadow filters rather than
jitter, which is grainy at 32 samples. Materials are soft and matte with a
touch of subsurface on skin, and every mesh carries a thin dark outline,
an inverted hull: a Solidify shell with flipped normals in a dark emission
material, both materials culling backfaces. The whole look is set in
`common.py`; a change there changes every render.

## Frames and the anchor

`render_frames(scene, out_dir, name, first, last)` writes
`<out_dir>/<name>_####.png`, one file per frame, `name` being the clip
(`idle`, `blink`, `happy`, `wave`, ...). A character rendered as layers
writes each layer into its own directory with the same clips and frame
numbers (`body/idle_0001.png`, `face_happy/idle_0001.png`,
`hat_pompom/idle_0001.png`), by hiding everything but the layer's objects
between passes (`hide_for_render`). `write_anchor(scene, camera, out_dir)`
stores `anchor.json` next to the frames: where the feet, the world origin,
land in the frame's pixels. The packer carries that point through the
trim and the scale, and the app places a sprite by it.

Clips run at 24 fps. Every clip loops unless the packer is told otherwise
(`--once`); a looping clip should end where it starts.

## Packing

```bash
python3 art/blender/pack.py pack art/out/room/fireplace --out assets/elf/sprites/fireplace --scale 0.5
python3 art/blender/pack.py pack-layers art/out/elf --out assets/elf/sprites/elf --scale 0.5 --once wave,yawn   # pnpm art:pack
```

`pack` takes one directory of frames, `pack-layers` a directory with one
frames directory per layer (`--base body` names the layer whose sheets are
the manifest's base). The packer trims the transparent margin common to
every frame of the clip (of every layer, so the layers stay aligned), keeps
one transparent pixel around the box, scales the frames (`--scale`, with
a premultiplied resample so the edges stay clean), lays them in reading
order on sheets of at most 2048 by 2048 pixels, and writes WebP at
quality 92 (`--lossless` for the exact pixels; on the soft-shaded renders
the two are indistinguishable and the lossy sheet is a third of the size).
Next to the sheets goes `manifest.json`:

```json
{
  "version": 1,
  "frameWidth": 180, "frameHeight": 260,
  "anchor": { "x": 90, "y": 250 },
  "fps": 24,
  "sheets": [ { "file": "body-1.webp", "columns": 11, "rows": 7, "frames": 77 } ],
  "clips": { "idle": { "from": 0, "to": 23, "loop": true }, "wave": { "from": 24, "to": 47, "loop": false } },
  "layers": { "hat_pompom": { "sheets": [ { "file": "hat_pompom-1.webp", "columns": 11, "rows": 7, "frames": 77 } ] } }
}
```

Frame indices are global and run on across sheets; the anchor is in cell
pixels. Only the final atlases and manifests are committed, under
`assets/elf/sprites/<character>/`; frames and intermediate renders stay in
`art/out`.

## In the app

`src/features/elf/sprites` plays the atlases with Skia: `manifest.ts`
holds the manifest type and the registry of bundled characters (Metro only
bundles files named in a static `require`, so each new character or sheet
is added there by hand), `useSpriteImages` decodes the sheets once,
`useSpriteClock` advances a frame index on the UI thread at the
manifest's fps, `SpriteFrame` draws the current cell from the sheets with
an Atlas node, `SpritePlayer` is one sprite with its own clock,
`LayeredSprite` draws the body and its overlays from one clock so they
never drift, and `SpriteDemo` is a stage to look at a freshly packed
character. Sprites are placed by the feet: `x`, `y` are where the anchor
goes, `scale` turns cell pixels into canvas pixels, `flipX` mirrors the
character around its feet.

## The room

`room.py` is the cottage interior: it models the walls, the floor, the
beams and the fireplace with its fire, the swappable furniture of every
slot (two rugs, a bed and a hammock, a square and a round window, the
shelf, the lantern, the picture, the basket, the fern, the candle stool,
the herbs), lights the room as a night scene (the fire as the warm key on
the right, the moon through the window and a dim cool fill on the left, a
soft hero spot on the rug so the elf's spot is the brightest floor) and
renders stills with Cycles, not Eevee: the full plate with the default
furniture (`plate.png`, for reference), the empty shell with the window
hole plugged (`plate_empty.png`, the plate the app draws) and every slot
variant alone as a transparent sprite (`<slot>_<variant>.png`), lit by the
whole room with the shell invisible to the camera and a baked contact
shadow of its own. `room_sheet.py` (system Python) then measures each
sprite's opaque box in plate pixels into `sprites.json`, tiles a
`contact.png` and writes `phone_crop.png`.

The plate is 1000 by 1600, the room units of `src/features/elf/cottage`,
and the app shows it with a cover fit: scaled to the phone's height, the
sides cropped, so a 9:20 phone sees x = 140..860 of it (`phone_crop.png`
is that band). The layout is framed for it: the room is 2.2 m wide, a
40 mm perspective camera at eye height 1.3 m stands 5.33 m in front of
the back wall, where the frame is 3 m wide (333 px per metre) and the
room's corners land at x = 133 and 867, just outside the phone band. The
floor line (floor meets the back wall) sits at y = 1152, the rug centre at
(500, 1280), both of which the app relies on, the ceiling at 3.45 m at the
top of the frame. The fireplace spans x = 0.34..0.98 m on the right, the
bed hugs the left wall with the shelf above it, the window is small and
high (centre at x = -0.52 m, z = 2.0 m), up and left of the elf, never
behind it. `camera.json` lists the camera, the floor line, the rug ellipse
and the pixel positions of these landmarks. The committed assets in
`assets/elf/room` are the empty plate as `plate.webp` and each sprite
cropped to its box, with `manifest.json` carrying the boxes, the floor
line and the rug centre.

## Adding a hat or a piece of furniture

A hat is a layer of the elf: give it objects in `elf.py`, render the same
clips with only those objects visible into `art/out/elf/hat_<id>/`, pack
the elf again (every layer in one go, so the grid stays shared), register
the new sheet files in `manifest.ts`, and draw the layer with
`LayeredSprite` when the elf wears it. The hat follows the head because it
is rigged to the same armature and rendered through the same frames.

A piece of furniture is a character of its own: a scene in `room.py` with
the camera and the light rig at the same settings as the elf's, an `idle`
clip (a single frame is a clip of one), packed with `pack` into
`assets/elf/sprites/<piece>/` and drawn with `SpritePlayer` at its slot.
Because the camera and the light are shared, a piece sits in the room's
light without any seam.
