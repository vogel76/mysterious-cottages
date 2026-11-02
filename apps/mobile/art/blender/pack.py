#!/usr/bin/env python3
"""Packs rendered sprite frames into WebP atlases with a manifest for the app.

Why: the elf and its room are rendered by Blender (see common.py) as one
PNG per frame, which is far too many files and bytes to ship. The app wants
a few sheets it can decode once and draw cells from, plus a manifest that
says where every clip's frames sit and where the character's feet are.
Runs with the system Python and Pillow, not inside Blender:

    /usr/bin/python3 art/blender/pack.py pack <frames_dir> --out <atlas_dir> [--scale 0.5] [--fps 24] [--once wave,yawn] [--lossless]
    /usr/bin/python3 art/blender/pack.py pack-layers <character_dir> --out <atlas_dir> [--base body] [same options]
        [--thumbs <dir>] [--sleepers <dir>] [--registry <file.ts>]

Input: <frames_dir> holds <clip>_####.png frames, all of one size, as
render_frames() writes them; an optional anchor.json ({"x", "y"} in those
pixels, from write_anchor()) says where the feet are, otherwise the bottom
centre of the trimmed box is taken. In pack-layers mode <character_dir>
holds one such directory per layer (body, hat_acornCap, ...) with the same
clips and frame numbers, rendered through the same frame. The base
layer's box over every frame is the atlas's frame of reference (the feet
are placed in it); every clip of every layer is then trimmed to a box of
its own (a hop or a staff swung out widens one clip, not all of them, and
a hat is a small part of the frame) and laid out on sheets of its own,
which carry their cell's size and the offset of the clip's box from the
frame of reference, so cell N of every layer is the same moment and the
app draws each cell at the frame's place plus its sheet's offset. --thumbs turns the <name>.thumb.png pictures of a
directory into <name>_thumb.webp next to the sheets (the wardrobe's cards),
--sleepers the elf asleep in each bed (elf.py's sleepers stage: a picture
per bed and per hat, by night and by day, with sleepers.json) into
sleeper_<bed>[_hat_<id>][_day].webp, and --registry writes the TypeScript module that names every file of the
atlas for Metro (a form of the elf's is src/features/elf/sprites/<form>Files.ts); the
atlas directory is emptied of its old WebP files first.

Output: <atlas_dir>/<layer>-<n>.webp sheets (in single mode the layer is
called "body") of at most 2048 x 2048 pixels, frames in reading order,
plus manifest.json:

    {
      "version": 3,
      "frameWidth": 180, "frameHeight": 260,     // the frame of reference, after the trim and the scale
      "anchor": { "x": 90, "y": 250 },           // the feet in it, pixels
      "fps": 24,
      "pixelsPerMetre": 180, "modelHeight": 1.965, // the render's scale after --scale, and the model's height
      "figureUnits": 460,                         // the figure's height in the room's units (plate pixels)
      "headUnits": 261,                           // the neck's height, the same units: above it a tap is on the head
      "sheets": [ { "file": "body-1.webp", "columns": 11, "rows": 3, "frames": 24,
                    "frameWidth": 150, "frameHeight": 240, "offset": { "x": 14, "y": 20 } } ],
                                                // a clip's frames, cut to its box: the cell and the box's place in the frame
      "clips": { "idle": { "from": 0, "to": 23, "loop": true }, "wave": { "from": 24, "to": 47, "loop": false } },
      "layers": { "hat_acornCap": { "sheets": [ ... ] } },  // pack-layers only: the overlays, sheets alike
      "thumbs": { "hat_acornCap": "hat_acornCap_thumb.webp" },  // with --thumbs
      "sleepers": { "oak": { "x": 40, "y": 600, "width": 300, "height": 200, "puff": { "x": 120, "y": 610 },
                             "file": "sleeper_oak.webp", "fileDay": "sleeper_oak_day.webp",
                             "hats": { "acornCap": { "file": "sleeper_oak_hat_acornCap.webp", "fileDay": ... } } } },
                                                // with --sleepers: plate pixels, the puff above the head
      "source": { "render": { "script": "elf.py", ... }, "pack": "pack-layers --base body --scale 0.6 ..." }
    }

Frame indices are global and contiguous across sheets: frame i sits on the
first sheet whose cumulative "frames" exceeds i, in cell (i - frames before
it), column-major by row; a sheet holds the frames of one clip only. Every
clip loops unless named in --once.
pixelsPerMetre, modelHeight and the neck's height come from render.json,
which the render script writes next to the layers (the frame, the
camera's scale, the pixels to the metre, the model's and the neck's
height); the app sizes the figure and places the head's line from them
instead of a constant. "source" records the render and the pack that
made the atlas, so check.py can prove the scripts still reproduce it.

Format: WebP at quality 92 by default, which on the smoke test's soft-shaded
frames is indistinguishable from lossless at a third of the bytes (the
outline and the alpha edge stay clean at that quality). --lossless keeps the
exact pixels for a check of the renders or a tiny atlas. The trim keeps a one pixel
transparent margin around the box, so a cell's edge samples transparent
pixels of its own frame rather than its neighbour's.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from dataclasses import dataclass

from PIL import Image

MAX_SHEET = 2048
MARGIN = 1
FRAME_NAME = re.compile(r'^(?P<clip>.+?)_(?P<index>\d+)\.png$')


@dataclass
class Clip:
    name: str
    files: list[str]


@dataclass
class Box:
    left: int
    top: int
    right: int
    bottom: int

    @property
    def width(self) -> int:
        return self.right - self.left

    @property
    def height(self) -> int:
        return self.bottom - self.top


def fail(message: str) -> None:
    print(f'pack: {message}', file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Reading the frames

def read_clips(frames_dir: str) -> list[Clip]:
    """The clips of a directory, each with its frames in number order."""
    groups: dict[str, list[tuple[int, str]]] = {}
    for entry in os.listdir(frames_dir):
        match = FRAME_NAME.match(entry)
        if match:
            groups.setdefault(match['clip'], []).append((int(match['index']), os.path.join(frames_dir, entry)))
    if not groups:
        fail(f'no <clip>_####.png frames in {frames_dir}')
    return [Clip(name, [path for _, path in sorted(frames)]) for name, frames in sorted(groups.items())]


def read_render(directory: str) -> dict | None:
    """render.json next to the layers, as the render script writes it; None when the renderer wrote none."""
    path = os.path.join(directory, 'render.json')
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def read_anchor(frames_dir: str) -> tuple[float, float] | None:
    path = os.path.join(frames_dir, 'anchor.json')
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as handle:
        data = json.load(handle)
    return (float(data['x']), float(data['y']))


def opaque_box(path: str, expected: tuple[int, int] | None) -> tuple[Box | None, tuple[int, int]]:
    """The bounding box of the non-transparent pixels of one frame (None when empty)."""
    with Image.open(path) as image:
        if expected is not None and image.size != expected:
            fail(f'{path} is {image.size}, the other frames are {expected}')
        alpha = image.convert('RGBA').getchannel('A')
        bbox = alpha.getbbox()
        return (Box(*bbox) if bbox else None, image.size)


def common_box(paths: list[str], empty: Box | None = None) -> tuple[Box, tuple[int, int]]:
    """The union of the opaque boxes of every frame, with the margin, clamped
    to the image; `empty` when every frame is transparent (else a failure)."""
    union: Box | None = None
    size: tuple[int, int] | None = None
    for path in paths:
        box, size = opaque_box(path, size)
        if box is None:
            continue
        union = box if union is None else Box(min(union.left, box.left), min(union.top, box.top),
                                              max(union.right, box.right), max(union.bottom, box.bottom))
    if size is None or (union is None and empty is None):
        fail('every frame is fully transparent')
    if union is None:
        return (empty, size)
    return (Box(max(0, union.left - MARGIN), max(0, union.top - MARGIN),
                min(size[0], union.right + MARGIN), min(size[1], union.bottom + MARGIN)), size)


# ---------------------------------------------------------------------------
# Laying out the sheets

@dataclass
class Grid:
    cell_width: int
    cell_height: int
    columns: int
    rows: int

    @property
    def capacity(self) -> int:
        return self.columns * self.rows


def plan_grid(cell_width: int, cell_height: int) -> Grid:
    columns = MAX_SHEET // cell_width
    rows = MAX_SHEET // cell_height
    if columns == 0 or rows == 0:
        fail(f'a {cell_width} x {cell_height} frame does not fit a {MAX_SHEET} sheet; use --scale')
    return Grid(cell_width, cell_height, columns, rows)


def sheet_plan(total: int, grid: Grid) -> list[tuple[int, int, int]]:
    """Per sheet: (frames on it, columns used, rows used)."""
    plan = []
    left = total
    while left > 0:
        count = min(left, grid.capacity)
        columns = min(count, grid.columns)
        rows = math.ceil(count / grid.columns)
        plan.append((count, columns, rows))
        left -= count
    return plan


def load_cell(path: str, box: Box, scale: float, cell: tuple[int, int]) -> Image.Image:
    """One frame cropped to the box and scaled; premultiplied for a clean resample on alpha."""
    with Image.open(path) as image:
        frame = image.convert('RGBA').crop((box.left, box.top, box.right, box.bottom))
    if scale != 1.0:
        frame = frame.convert('RGBa').resize(cell, Image.LANCZOS).convert('RGBA')
    return frame


def write_sheets(paths: list[str], layer: str, first: int, box: Box, reference: Box, scale: float, out_dir: str,
                 lossy: bool) -> list[dict]:
    """Writes the sheets of one clip of a layer, numbered from `first`, and
    returns their manifest entries: the cell's size and the offset of the
    clip's box from the frame of reference."""
    cell = (max(1, round(box.width * scale)), max(1, round(box.height * scale)))
    grid = plan_grid(*cell)
    offset = {'x': round((box.left - reference.left) * scale, 2), 'y': round((box.top - reference.top) * scale, 2)}
    entries = []
    index = 0
    for number, (count, columns, rows) in enumerate(sheet_plan(len(paths), grid), start=first):
        sheet = Image.new('RGBA', (columns * grid.cell_width, rows * grid.cell_height), (0, 0, 0, 0))
        for cell_index in range(count):
            frame = load_cell(paths[index], box, scale, cell)
            sheet.paste(frame, ((cell_index % grid.columns) * grid.cell_width, (cell_index // grid.columns) * grid.cell_height))
            index += 1
        file = f'{layer}-{number}.webp'
        if lossy:
            sheet.save(os.path.join(out_dir, file), 'WEBP', quality=92, method=6)
        else:
            sheet.save(os.path.join(out_dir, file), 'WEBP', lossless=True, quality=100, method=6)
        entries.append({'file': file, 'columns': columns, 'rows': rows, 'frames': count,
                        'frameWidth': cell[0], 'frameHeight': cell[1], 'offset': offset})
    return entries


def write_layer(clips: list[Clip], layer: str, reference: Box, scale: float, out_dir: str, lossy: bool) -> list[dict]:
    """Every clip of a layer on sheets of its own, each cut to the clip's
    box (a clip the layer never shows in gets a one-pixel cell)."""
    entries: list[dict] = []
    nothing = Box(reference.left, reference.top, reference.left + 1, reference.top + 1)
    for clip in clips:
        box, _size = common_box(clip.files, empty=nothing)
        entries += write_sheets(clip.files, layer, len(entries) + 1, box, reference, scale, out_dir, lossy)
    return entries


def decoded_megabytes(sheets: list[dict]) -> float:
    return sum(sheet['columns'] * sheet['frameWidth'] * sheet['rows'] * sheet['frameHeight'] * 4 for sheet in sheets) / 2 ** 20


# ---------------------------------------------------------------------------
# The two modes

THUMB_SIDE = 320


def write_thumbs(thumbs_dir: str, out_dir: str) -> dict:
    """The catalogue pictures: <name>.thumb.png trimmed to its picture and
    scaled to THUMB_SIDE at most, as <name>_thumb.webp."""
    thumbs = {}
    for name in sorted(os.listdir(thumbs_dir)):
        if not name.endswith('.thumb.png'):
            continue
        key = name[:-len('.thumb.png')]
        with Image.open(os.path.join(thumbs_dir, name)) as image:
            picture = image.convert('RGBA')
        bbox = picture.getchannel('A').getbbox()
        if bbox:
            picture = picture.crop(bbox)
        picture.thumbnail((THUMB_SIDE, THUMB_SIDE), Image.LANCZOS)
        file = f'{key}_thumb.webp'
        picture.save(os.path.join(out_dir, file), 'WEBP', quality=90, method=6)
        thumbs[key] = file
    return thumbs


def write_sleepers(sleepers_dir: str, out_dir: str) -> dict:
    """The elf asleep in each bed: every picture as WebP, their crop (one
    per bed, in the plate's pixels) and the puff's point from sleepers.json."""
    with open(os.path.join(sleepers_dir, 'sleepers.json'), encoding='utf-8') as handle:
        info = json.load(handle)

    def webp(name: str) -> str:
        file = f'sleeper_{name}.webp'
        with Image.open(os.path.join(sleepers_dir, f'{name}.png')) as image:
            image.convert('RGBA').save(os.path.join(out_dir, file), 'WEBP', quality=92, method=6)
        return file

    sleepers = {}
    for bed, box in sorted(info.items()):
        hats = sorted(name[len(f'{bed}_hat_'):-len('.png')] for name in os.listdir(sleepers_dir)
                      if name.startswith(f'{bed}_hat_') and name.endswith('.png') and not name.endswith('_day.png'))
        sleepers[bed] = {**box, 'file': webp(bed), 'fileDay': webp(f'{bed}_day'),
                         'hats': {hat: {'file': webp(f'{bed}_hat_{hat}'), 'fileDay': webp(f'{bed}_hat_{hat}_day')} for hat in hats}}
    return sleepers


def write_registry(out_dir: str, registry: str) -> None:
    """The module that names every file of the atlas for Metro, which
    bundles only what a static require names."""
    rel = os.path.relpath(os.path.abspath(out_dir), os.path.dirname(os.path.abspath(registry)))
    names = sorted(name for name in os.listdir(out_dir) if name.endswith('.webp'))
    lines = [f'/* Generated by art/blender/pack.py --registry from the atlas in {os.path.basename(os.path.abspath(out_dir))}/;',
             '   do not edit by hand. Metro bundles only what a static require names,',
             '   so every file of the atlas is named here; the manifest names them. */',
             'export const ATLAS_FILES: Record<string, number> = {']
    lines += [f"  '{name}': require('{rel}/{name}')," for name in names]
    lines += ['}', '']
    with open(registry, 'w', encoding='utf-8') as handle:
        handle.write('\n'.join(lines))
    print(f'pack: registry of {len(names)} files in {registry}')


def pack_layers(layer_dirs: dict[str, str], base: str, out_dir: str, scale: float, fps: int, once: set[str],
                lossy: bool, render: dict | None = None, command: str = '', thumbs_dir: str | None = None,
                sleepers_dir: str | None = None) -> dict:
    """Packs one or more layers that share clips and frame numbers into one manifest."""
    if base not in layer_dirs:
        fail(f'the base layer "{base}" is not among {sorted(layer_dirs)}')
    clips_per_layer = {layer: read_clips(path) for layer, path in layer_dirs.items()}
    reference = clips_per_layer[base]
    signature = [(clip.name, len(clip.files)) for clip in reference]
    for layer, clips in clips_per_layer.items():
        if [(clip.name, len(clip.files)) for clip in clips] != signature:
            fail(f'layer "{layer}" has other clips or frame counts than "{base}"')

    def layer_paths(layer: str) -> list[str]:
        return [path for clip in clips_per_layer[layer] for path in clip.files]

    box, source_size = common_box(layer_paths(base))
    cell = (max(1, round(box.width * scale)), max(1, round(box.height * scale)))

    anchor = read_anchor(layer_dirs[base]) or (box.left + box.width / 2, box.bottom - MARGIN)
    anchor_x = (anchor[0] - box.left) * scale
    anchor_y = (anchor[1] - box.top) * scale

    os.makedirs(out_dir, exist_ok=True)
    for name in os.listdir(out_dir):
        if name.endswith('.webp'):
            os.remove(os.path.join(out_dir, name))
    sheets_per_layer = {layer: write_layer(clips, layer, box, scale, out_dir, lossy) for layer, clips in clips_per_layer.items()}
    overlays = {layer: {'sheets': sheets} for layer, sheets in sheets_per_layer.items() if layer != base}

    clips = {}
    start = 0
    for clip in reference:
        clips[clip.name] = {'from': start, 'to': start + len(clip.files) - 1, 'loop': clip.name not in once}
        start += len(clip.files)

    manifest = {
        'version': 3,
        'frameWidth': cell[0],
        'frameHeight': cell[1],
        'anchor': {'x': round(anchor_x, 2), 'y': round(anchor_y, 2)},
        'fps': fps,
        'sheets': sheets_per_layer[base],
        'clips': clips,
    }
    if render is not None:
        manifest['pixelsPerMetre'] = round(float(render['pixelsPerMetre']) * scale, 3)
        manifest['modelHeight'] = float(render['modelHeight'])
        # the figure's height in the room's units (plate pixels), before the pack's scale
        manifest['figureUnits'] = round(float(render['pixelsPerMetre']) * float(render['modelHeight']), 1)
        if 'neckHeight' in render:
            manifest['headUnits'] = round(float(render['pixelsPerMetre']) * float(render['neckHeight']), 1)
    if overlays:
        manifest['layers'] = overlays
    if thumbs_dir:
        manifest['thumbs'] = write_thumbs(thumbs_dir, out_dir)
    if sleepers_dir:
        manifest['sleepers'] = write_sleepers(sleepers_dir, out_dir)
    manifest['source'] = {
        'render': {key: render[key] for key in ('script', 'args', 'width', 'height', 'orthoScale') if key in render} if render else None,
        'pack': command,
    }
    with open(os.path.join(out_dir, 'manifest.json'), 'w', encoding='utf-8') as handle:
        json.dump(manifest, handle, indent=2)
        handle.write('\n')

    total = sum(len(clip.files) for clip in reference)
    print(f'pack: {total} frames x {len(layer_dirs)} layer(s), {source_size[0]}x{source_size[1]} trimmed to '
          f'{box.width}x{box.height} (the frame {cell[0]}x{cell[1]}), {len(sheets_per_layer[base])} sheet(s) of the base, '
          f'{decoded_megabytes(sheets_per_layer[base]):.0f} MB decoded -> {out_dir}')
    return manifest


def main(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(description='Packs rendered sprite frames into WebP atlases.')
    sub = parser.add_subparsers(dest='mode', required=True)
    for mode, help_text in (('pack', 'one directory of <clip>_####.png frames'),
                            ('pack-layers', 'a directory with one frames directory per layer')):
        command = sub.add_parser(mode, help=help_text)
        command.add_argument('source')
        command.add_argument('--out', required=True, help='the atlas directory (created)')
        command.add_argument('--scale', type=float, default=1.0, help='downscale factor, e.g. 0.5')
        command.add_argument('--fps', type=int, default=24)
        command.add_argument('--once', default='', help='comma-separated clips that do not loop')
        command.add_argument('--lossless', action='store_true', help='lossless WebP instead of quality 92')
        if mode == 'pack-layers':
            command.add_argument('--base', default='body', help='the layer whose sheets are the manifest\'s "sheets"')
            command.add_argument('--thumbs', default=None, help='a directory of <name>.thumb.png catalogue pictures')
            command.add_argument('--sleepers', default=None, help='the sleepers stage\'s pictures and sleepers.json')
            command.add_argument('--registry', default=None, help='the TypeScript registry to write')
    args = parser.parse_args(argv)
    once = {name.strip() for name in args.once.split(',') if name.strip()}

    if args.mode == 'pack':
        layers = {'body': args.source}
        base = 'body'
    else:
        layers = {entry: os.path.join(args.source, entry) for entry in sorted(os.listdir(args.source))
                  if os.path.isdir(os.path.join(args.source, entry))}
        if not layers:
            fail(f'no layer directories in {args.source}')
        base = args.base
    # The arguments that shape the atlas, recorded in the manifest without the
    # paths, so a check pack into another directory records the same command.
    command = f'{args.mode} --base {base} --scale {args.scale} --fps {args.fps}'
    if once:
        command += f' --once {",".join(sorted(once))}'
    if args.lossless:
        command += ' --lossless'
    thumbs = getattr(args, 'thumbs', None)
    if thumbs:
        command += ' --thumbs'
    sleepers = getattr(args, 'sleepers', None)
    if sleepers:
        command += ' --sleepers'
    pack_layers(layers, base, args.out, args.scale, args.fps, once, not args.lossless, read_render(args.source), command,
                thumbs, sleepers)
    if getattr(args, 'registry', None):
        write_registry(args.out, args.registry)


if __name__ == '__main__':
    main(sys.argv[1:])
