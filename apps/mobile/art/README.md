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
scripts; no third-party models or textures are used.

## Installing

Blender 5.2 LTS, as a snap on Linux (`sudo snap install blender --classic`;
the binary is `/snap/bin/blender`) or from blender.org elsewhere; the
scripts below assume `blender` on the path. The packer runs with the
system Python 3 and Pillow (`python3 -m pip install pillow`); it does not
run inside Blender. Rendering uses Eevee over OpenGL, which works headless
on a desktop GPU; the painterly shading reads the light through Shader to
RGB, which Cycles has not, so Cycles is not used.

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
                         the toon and painterly materials, the Line Art ink, the outline modifier, meshes from
                         bmesh, armature parenting, the renders, the anchor, saving a .blend for inspection
art/blender/smoke.py     the smoke test described above
art/blender/elf.py       the elf: the young forest elf (a FORM table gives the baby and the young form), its rig,
                         its clips, the look-dev stills, rendered as the body layer (face and hat layers to come)
                         standing in the room of room.py, or alone in the studio rig with --studio
art/blender/room.py      the cottage: the walls and the floor, the furniture of each slot, the fire, by night and
                         by day (see The room); elf.py imports it for the elf's scene
art/blender/room_sheet.py the room's post-processing (system Python): sprite boxes, contact sheet, and with
                         --pack and --registry the app's room assets and the module that names them
art/blender/pack.py      the packer: frames to atlases and a manifest (system Python)
art/blender/check.py     the atlas check: packs the frames again and compares with the committed atlas (system Python)
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
touch of subsurface on skin. The elf's materials are painterly
(`painterly_material`): the Principled shading is blended with a flat
two-band shading read back through Shader to RGB, the base colour where
lit and the colour darkened towards a cool forest green in shadow, with an
eased edge between them (a hard step at ramp 1, the cel look); cloth gets
a fine noise grain. The ink is Grease Pencil Line Art (`add_line_art`):
one object whose modifier draws the scene's contours, creases and
intersections as thin dark-brown strokes (radius 0.0045 m, about a pixel
after the pack); painted-on parts (highlights, cheeks, iris, pupil) opt
out through `obj.lineart.usage`. The older inverted-hull outline (a
Solidify shell with flipped normals in a dark emission material, both
materials culling backfaces) stays in `outline_modifier` as a switch
(`--hull`). `enable_quality` turns on ray tracing, Fast GI and jittered
shadows for the figure, about twice the render time. The whole look is set
in `common.py` and `elf.py`'s `LOOK`; a change there changes every render.

The figure's parts are not left as primitives sitting in one another:
`fuse` in `elf.py` joins a group (the torso with its shoulders and
sleeves; the head with the neck, the nose and the ears; the hair, a
sphere shell cut to the hairstyle with sideburns and mounds of volume; a
mitten hand with its thumb; a boot with its shaft and toe), applies their
modifiers, remeshes the union on a voxel grid (0.0045 to 0.01 m) and
smooths it, so a sleeve grows out of a shoulder.
A fused mesh binds with automatic weights plus a Corrective Smooth (the
arm bones' weights are kept out of the torso column, or a raised arm
narrows the waist); the hair rides the head rigidly with its crown
weighted to the `hood_tip` bone by height (heat weights fail on that
mass). An open surface cannot be remeshed, hence the Solidify on the
hair cap. The belt and the hem band are measured on the torso tube
before the sleeves join it.

`elf.py` takes `--form young|baby`, `--ramp <0..1>` (0 plain Principled,
1 cel), `--no-ink`, `--hull`, `--no-quality` and `--quick`, and its
`lookdev` stage renders the wave pose and the four moods into
`art/out/elf/lookdev/<look>/`, one folder per combination of flags, which
is how the A/B sheet of a look-dev round is made. Verified on Blender
5.2.2: the Line Art modifier type is `LINEART`, its width is `radius`, and
Shader to RGB works in Eevee only (the hero still renders with Eevee too).

## Frames and the anchor

`render_frames(scene, out_dir, name, first, last)` writes
`<out_dir>/<name>_####.png`, one file per frame, `name` being the clip
(`idle`, `blink`, `happy`, `wave`, ...). A character is rendered as
layers, one directory per layer under `layers/` with the same clips and
frame numbers (`layers/body/idle_0001.png`, later
`layers/face_happy/idle_0001.png`, `layers/hat_pompom/idle_0001.png`).
The elf has the body layer alone today, its face and hair baked in; the
smoke scene shows the layout with two layers, which it separates by
hiding objects, whereas the elf's layers will be holdout passes (the other
parts keep cutting the alpha and casting shadows, so a hat never draws
over an ear). `write_anchor(scene, camera, out_dir)`
stores `anchor.json` next to the frames: where the feet, the world origin,
land in the frame's pixels. The packer carries that point through the
trim and the scale, and the app places a sprite by it.

Clips run at 24 fps. Every clip loops unless the packer is told otherwise
(`--once`); a looping clip should end where it starts, and a one-shot
settles into the rest pose on its last frame, so the switch back to the
idle loop is not a cut.

The elf's clips are authored in `elf.py` through `Rig`, which speaks in
world terms: a bone's offset or world-axis rotation, a hand's position
(`hand`, `hands`: the arms are on a two-bone IK whose pole angle is
calibrated at build time so the elbow rests where it was modelled), a
point the head looks at (`look`, within a comfortable range, with an
optional roll), a breath over the clip, squash and stretch about the
feet, blinks and the mouth and brow shape keys. Every key may carry its
own easing (`ease='EASE_OUT'` or `('BACK', 'EASE_OUT')` for an
overshoot); the default is an ease in and out. The ears and the crown of
the hair are not keyed by hand: when a clip is finished, `follow_through`
samples the head's pitch and roll and the body's height over the clip
and keys them against that velocity two frames late, so they trail a nod
and flap on a hop, on top of a resting angle the clip sets for its mood
(`rig.mood`, drooped ears for sad and sleep). The seven clips: idle (a
breath, a weight shift, a glance aside, a blink; 48 frames), happy (a
crouch, two hops with the arms thrown up, a settle; 36), sad (a slumped
sway with a sigh; 24, loop), sleep (48, loop), pet (a lean into the
hand with a squint; 24), feed (the hands bring the food to the mouth,
two bites, a happy settle; 36) and wave (the arm up beside the head,
three waves from the elbow, a head tilt; 36).

## Packing

```bash
python3 art/blender/pack.py pack art/out/room/fireplace --out assets/elf/sprites/fireplace --scale 0.5
python3 art/blender/pack.py pack-layers art/out/elf/layers --out assets/elf/sprites/elf --scale 0.6 --once feed,happy,pet,wave   # pnpm art:pack
python3 art/blender/check.py pack-layers art/out/elf/layers --against assets/elf/sprites/elf --scale 0.6 --once feed,happy,pet,wave   # pnpm art:check
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
  "version": 2,
  "frameWidth": 180, "frameHeight": 260,
  "anchor": { "x": 90, "y": 250 },
  "fps": 24,
  "pixelsPerMetre": 180, "modelHeight": 1.965,
  "sheets": [ { "file": "body-1.webp", "columns": 11, "rows": 7, "frames": 77 } ],
  "clips": { "idle": { "from": 0, "to": 23, "loop": true }, "wave": { "from": 24, "to": 47, "loop": false } },
  "layers": { "hat_pompom": { "sheets": [ { "file": "hat_pompom-1.webp", "columns": 11, "rows": 7, "frames": 77 } ] } },
  "source": { "render": { "script": "elf.py", "args": ["--stages", "still,allanims"], "width": 512, "height": 832, "orthoScale": 2.773333 }, "pack": "pack-layers --base body --scale 0.6 --fps 24 --once feed,happy,pet,wave" }
}
```

Frame indices are global and run on across sheets; the anchor is in cell
pixels. `pixelsPerMetre` is the render's scale (`render.json`, which the
render script writes next to the layers: 300 for the elf) after the pack's
`--scale`, and with `modelHeight` it gives the figure's height in cell
pixels, which the app scales to its room units instead of keeping a
constant; `source` records the render and the pack that made the atlas. Only the final atlases and manifests are committed, under
`assets/elf/sprites/<character>/`; frames and intermediate renders stay in
`art/out`.

Before an atlas is committed, `pnpm art:check` packs the frames again into
a temporary directory with the same arguments as `pnpm art:pack` and
compares the result with the committed one: the manifest must be
identical, every cell must match within 24/255 on every channel (lossy
WebP and Eevee's sampling noise account for less), and no frame may touch
the edge of its render, which would mean the camera cut the figure. It
needs the frames in `art/out`, so it is run by hand after `pnpm art:elf`,
not from `pnpm check`. The pack command in `package.json` is the one that
reproduces the committed atlas; when it changes, the atlas is re-rendered
and re-committed with it.

## In the app

`src/features/elf/sprites` plays the atlases with Skia: `manifest.ts`
holds the manifest type and the registry of bundled characters (Metro only
bundles files named in a static `require`, so each new character or sheet
is added there by hand), `useSpriteImages` decodes the sheets once,
`useSpriteClock` advances a frame index on the UI thread at the
manifest's fps, `SpriteFrame` draws the current cell from the sheets with
an Atlas node, `SpritePlayer` is one sprite with its own clock,
`LayeredSprite` draws the body and its overlays from one clock so they
never drift. Sprites are placed by the feet: `x`, `y` are where the anchor
goes, `scale` turns cell pixels into canvas pixels, `flipX` mirrors the
character around its feet.

## The room

`room.py` is the cottage interior: it models the walls, the floor, the
beams and the fireplace with its fire, and the pieces of every place of
the room, three variants each, named after the catalogue's ids
(`src/features/elf/cottage/catalogue.ts`): the rug (braided, a kilim, a
cushion of moss), the bed (oak, a hammock, a nest), the window (arched,
round, shuttered with a flower box), the picture (the cottage, a map,
antlers), the shelf (books, jars, seedlings), the lantern (iron, paper,
a brass bell), the herbs under the beam (dried herbs, garlic, a
dreamcatcher), the basket by the hearth (acorns, firewood, pumpkins),
the corner plant (a fern, a toadstool, a stump) and the stool by the
fire (a candle, a cauldron, a toy chest); and three walls (plaster,
boards, logs) and three floors (planks, flagstones, terracotta) as
materials of the room's own surfaces (`WALL_IDS`, `FLOOR_IDS`,
`set_surfaces`). Everything is in the same painterly materials and the
same Line Art ink as the elf (`paint_material` over its textures, the
flames, the glass, the sky and the contact shadows opted out of the
ink). It lights the room as a night scene (the fire as the warm key on
the right, the moon through the window and a dim cool fill on the left,
a soft hero spot on the rug so the elf's spot is the brightest floor)
and as a day scene (the moon's lamp turned into the sun, the fill
neutral, the fire stepped back, the ambient brighter, the window showing
a day sky without the moon and the stars; `DAYLIGHT` and
`set_daylight`), and renders with Eevee, by night and by day: the full
plate with the default furniture (`plate.png`, `plate_day.png`, for
review), the empty room with the window hole plugged for every pair of
wall and floor (`plate_<wall>_<floor>.png` and `_day`, the plates the
app draws), and every piece alone as a transparent sprite
(`<slot>_<variant>.png` and `.day.png`), lit by the whole room with the
shell invisible to the camera and drawing no ink, and a baked contact
shadow of its own. Then, by day, the decorating catalogue's pictures:
every piece once more, close up (`render_thumb`: the camera's view
cropped to the piece by a render border and scaled so its longer side
comes out at about 360 pixels, `<slot>_<variant>.thumb.png`), and a patch
of every wall and floor (`wall_<id>.thumb.png`, `floor_<id>.thumb.png`).
`room_sheet.py` (system Python) then measures each sprite's opaque box in
plate pixels (the union of its night and day renders) into
`sprites.json` and tiles a `contact.png`; with `--pack` and `--registry`
(`pnpm art:room-pack`) it writes the app's assets (emptying the folder of
its old WebP files first) and the module that names them for Metro,
`src/features/elf/cottage/roomFiles.ts`.

The elf's frames are rendered inside this scene (`elf.py` imports
`room.py`, builds the room with the furniture hidden and the shell
invisible to the camera, stands the elf on the rug sized to the app's
figure height in plate pixels and crops the room's camera to the figure
with a render border), so the figure is lit by the same fire and moon,
shaded and inked the same way, from the same point of view; `--studio`
renders it alone in the shared rig instead.

The plate is 1000 by 1300, the room units of `src/features/elf/cottage`,
the aspect of the band a 9:20 phone leaves free between the Elf tab's top
strip and its care band, and the app shows it there with a cover fit, so
a phone crops at most a sliver of its sides or of its top and bottom.
The layout is framed for it: the room is 3 m wide and 2.75 m high, a
35 mm perspective camera at eye height 1.25 m stands about 4.2 m in front
of the back wall, where the frame is 3.3 m wide (303 px per metre) and
the room's corners land at x = 45 and 955. The floor line (floor meets the
back wall) sits at 64 percent of the height and the rug centre at 78
percent. The fireplace spans x = 0.62..1.32 m on the right with the
lantern before its chimney, the bed hugs the left wall with the shelf
above it and the window over its head, the picture and the herbs hang
between them over the elf, and the corner plant and the stool stand in
front at x = -0.68 and 0.68 m. `camera.json` lists the camera, the floor
line, the rug ellipse, the fireplace's box and its fire, the wall's and
the floor's boxes, the catalogue as rendered and the pixel positions of
these landmarks. The committed assets in `assets/elf/room` are the plates
of every pair, each sprite cropped to its box by night and as its `_day`
twin, and the catalogue's pictures as `_thumb`, with `manifest.json`
(version 3) carrying the plates by pair, the boxes and which piece is
each place's default, the floor line, the rug centre, the fireplace with
its fire and the boxes of the wall and the floor; the app draws the day
pictures over the night ones at the opacity of its clock's daylight.

## Adding a hat or a piece of furniture

A hat is a layer of the elf: give it objects in `elf.py`, render the same
clips with only those objects visible into `art/out/elf/hat_<id>/`, pack
the elf again (every layer in one go, so the grid stays shared), register
the new sheet files in `manifest.ts`, and draw the layer with
`LayeredSprite` when the elf wears it. The hat follows the head because it
is rigged to the same armature and rendered through the same frames.

A piece of furniture is a builder in `room.py` named after its place and
its id (`build_<slot>_<id>`, building into the collection it is handed,
standing where its place's other variants stand so the room's depth and
the app's tap target stay right) and a line of `SLOTS`; the same id goes
into the catalogue (`DECOR_IDS` in `src/features/elf/cottage/catalogue.ts`),
its name into the dictionaries (`item<Id>` in the elf group of
`packages/i18n`) and, if it is to be earned, its threshold into
`DECOR_UNLOCKS` in the rules. `pnpm art:room` renders it by night, by
day and close up for the catalogue, and `pnpm art:room-pack` packs it and
regenerates the registry, so the app draws and offers it with no code of
its own. A wall or a floor is a material in `build_materials`
(`wall.<id>`, `floor.<id>`, patterned in world coordinates so the pattern
runs on across the wall's pieces) and an id in `WALL_IDS` or `FLOOR_IDS`;
every pair gets a plate, so each new one adds a plate per pair of the
other kind.
