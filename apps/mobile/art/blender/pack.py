#!/usr/bin/env python3
"""Packs rendered sprite frames into WebP atlases with a manifest for the app.

Why: the elf and its room are rendered by Blender (see common.py) as one
PNG per frame, which is far too many files and bytes to ship. The app wants
a few sheets it can decode once and draw cells from, plus a manifest that
says where every clip's frames sit and where the character's feet are.
Runs with the system Python and Pillow, not inside Blender:

    /usr/bin/python3 art/blender/pack.py pack <frames_dir> --out <atlas_dir> [--scale 0.5] [--fps 24] [--once wave,yawn] [--lossless]
    /usr/bin/python3 art/blender/pack.py pack-layers <character_dir> --out <atlas_dir> [--base body] [same options]

Input: <frames_dir> holds <clip>_####.png frames, all of one size, as
render_frames() writes them; an optional anchor.json ({"x", "y"} in those
pixels, from write_anchor()) says where the feet are, otherwise the bottom
centre of the trimmed box is taken. In pack-layers mode <character_dir>
holds one such directory per layer (body, face_happy, hat_pompom, ...) with
the same clips and frame numbers; the layers are trimmed with one common
box and laid out in one grid, so cell N of every layer is the same frame
and layered playback stays aligned.

Output: <atlas_dir>/<layer>-<n>.webp sheets (in single mode the layer is
called "body") of at most 2048 x 2048 pixels, frames in reading order,
plus manifest.json:

    {
      "version": 1,
      "frameWidth": 180, "frameHeight": 260,     // one cell, after the trim and the scale
      "anchor": { "x": 90, "y": 250 },           // the feet inside a cell, pixels
      "fps": 24,
      "sheets": [ { "file": "body-1.webp", "columns": 11, "rows": 7, "frames": 77 } ],
      "clips": { "idle": { "from": 0, "to": 23, "loop": true }, "wave": { "from": 24, "to": 47, "loop": false } },
      "layers": { "hat_pompom": { "sheets": [ ... ] } }   // pack-layers only: the overlays, same grid as "sheets"
    }

Frame indices are global and contiguous across sheets: frame i sits on the
first sheet whose cumulative "frames" exceeds i, in cell (i - frames before
it), column-major by row. Every clip loops unless named in --once.

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


def common_box(paths: list[str]) -> tuple[Box, tuple[int, int]]:
    """The union of the opaque boxes of every frame, with the margin, clamped to the image."""
    union: Box | None = None
    size: tuple[int, int] | None = None
    for path in paths:
        box, size = opaque_box(path, size)
        if box is None:
            continue
        union = box if union is None else Box(min(union.left, box.left), min(union.top, box.top),
                                              max(union.right, box.right), max(union.bottom, box.bottom))
    if union is None or size is None:
        fail('every frame is fully transparent')
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


def write_sheets(paths: list[str], layer: str, box: Box, scale: float, grid: Grid, out_dir: str,
                 lossy: bool) -> list[dict]:
    """Writes the sheets of one layer and returns their manifest entries."""
    entries = []
    index = 0
    for number, (count, columns, rows) in enumerate(sheet_plan(len(paths), grid), start=1):
        sheet = Image.new('RGBA', (columns * grid.cell_width, rows * grid.cell_height), (0, 0, 0, 0))
        for cell in range(count):
            frame = load_cell(paths[index], box, scale, (grid.cell_width, grid.cell_height))
            sheet.paste(frame, ((cell % grid.columns) * grid.cell_width, (cell // grid.columns) * grid.cell_height))
            index += 1
        file = f'{layer}-{number}.webp'
        if lossy:
            sheet.save(os.path.join(out_dir, file), 'WEBP', quality=92, method=6)
        else:
            sheet.save(os.path.join(out_dir, file), 'WEBP', lossless=True, quality=100, method=6)
        entries.append({'file': file, 'columns': columns, 'rows': rows, 'frames': count})
    return entries


# ---------------------------------------------------------------------------
# The two modes

def pack_layers(layer_dirs: dict[str, str], base: str, out_dir: str, scale: float, fps: int, once: set[str],
                lossy: bool) -> dict:
    """Packs one or more layers that share clips and frame numbers into one manifest."""
    if base not in layer_dirs:
        fail(f'the base layer "{base}" is not among {sorted(layer_dirs)}')
    clips_per_layer = {layer: read_clips(path) for layer, path in layer_dirs.items()}
    reference = clips_per_layer[base]
    signature = [(clip.name, len(clip.files)) for clip in reference]
    for layer, clips in clips_per_layer.items():
        if [(clip.name, len(clip.files)) for clip in clips] != signature:
            fail(f'layer "{layer}" has other clips or frame counts than "{base}"')

    all_paths = [path for clips in clips_per_layer.values() for clip in clips for path in clip.files]
    box, source_size = common_box(all_paths)
    cell = (max(1, round(box.width * scale)), max(1, round(box.height * scale)))
    grid = plan_grid(*cell)

    anchor = read_anchor(layer_dirs[base]) or (box.left + box.width / 2, box.bottom - MARGIN)
    anchor_x = (anchor[0] - box.left) * scale
    anchor_y = (anchor[1] - box.top) * scale

    os.makedirs(out_dir, exist_ok=True)
    sheets_per_layer = {}
    for layer, clips in clips_per_layer.items():
        paths = [path for clip in clips for path in clip.files]
        sheets_per_layer[layer] = write_sheets(paths, layer, box, scale, grid, out_dir, lossy)

    clips = {}
    start = 0
    for clip in reference:
        clips[clip.name] = {'from': start, 'to': start + len(clip.files) - 1, 'loop': clip.name not in once}
        start += len(clip.files)

    manifest = {
        'version': 1,
        'frameWidth': cell[0],
        'frameHeight': cell[1],
        'anchor': {'x': round(anchor_x, 2), 'y': round(anchor_y, 2)},
        'fps': fps,
        'sheets': sheets_per_layer[base],
        'clips': clips,
    }
    overlays = {layer: {'sheets': sheets} for layer, sheets in sheets_per_layer.items() if layer != base}
    if overlays:
        manifest['layers'] = overlays
    with open(os.path.join(out_dir, 'manifest.json'), 'w', encoding='utf-8') as handle:
        json.dump(manifest, handle, indent=2)
        handle.write('\n')

    total = sum(len(clip.files) for clip in reference)
    print(f'pack: {total} frames x {len(layer_dirs)} layer(s), {source_size[0]}x{source_size[1]} trimmed to '
          f'{box.width}x{box.height}, cells {cell[0]}x{cell[1]}, {len(sheets_per_layer[base])} sheet(s) per layer -> {out_dir}')
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
    pack_layers(layers, base, args.out, args.scale, args.fps, once, not args.lossless)


if __name__ == '__main__':
    main(sys.argv[1:])
