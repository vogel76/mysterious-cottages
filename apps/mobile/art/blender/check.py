#!/usr/bin/env python3
"""Checks that the frames in art/out pack into the committed atlas.

Why: an atlas is committed as the output of a render and a pack, and the
next person (or the next session) must be able to regenerate it from the
scripts. This check packs the frames again, into a temporary directory,
with exactly the arguments the committed atlas was packed with, and
compares: the manifest must be identical, every cell of every sheet must
match within a small tolerance (lossy WebP and Eevee's sampling noise
account for a few levels, never more), and no frame may touch the edge
of its render, which would mean the camera cut the figure. Runs with the
system Python and Pillow, like the packer; needs the frames in art/out, so
it is run by hand after a render, not from `pnpm check`:

    python3 art/blender/check.py pack-layers <layers_dir> --against <atlas_dir> [--scale 0.6] [--fps 24] [--once a,b] [--base body] [--lossless] [--tolerance 24]

Every option but --against and --tolerance is handed to pack.py unchanged,
so the command mirrors `pnpm art:pack` with `--out` replaced by `--against`
(package.json keeps the two next to each other). Exit status 1 on any
difference, with the worst cell named.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageChops

PACK = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pack.py')


def fail(message: str) -> None:
    print(f'check: {message}', file=sys.stderr)
    sys.exit(1)


def frame_files(layers_dir: str) -> list[str]:
    paths = []
    for layer in sorted(os.listdir(layers_dir)):
        directory = os.path.join(layers_dir, layer)
        if not os.path.isdir(directory):
            continue
        paths += [os.path.join(directory, name) for name in sorted(os.listdir(directory)) if name.endswith('.png')]
    if not paths:
        fail(f'no frames under {layers_dir}')
    return paths


def check_edges(paths: list[str]) -> None:
    """A figure that touches the render's edge was cut by the camera."""
    cut = []
    for path in paths:
        with Image.open(path) as image:
            bbox = image.convert('RGBA').getchannel('A').getbbox()
            if bbox is None:
                continue
            left, top, right, bottom = bbox
            if left == 0 or top == 0 or right == image.width or bottom == image.height:
                cut.append(os.path.relpath(path))
    if cut:
        fail(f'{len(cut)} frame(s) touch the edge of the render (the camera cuts the figure): {", ".join(cut[:6])}')
    print(f'check: {len(paths)} frames, none touches the edge')


def repack(args: argparse.Namespace, out_dir: str) -> None:
    command = [sys.executable, PACK, 'pack-layers', args.source, '--out', out_dir, '--scale', str(args.scale), '--fps', str(args.fps), '--base', args.base]
    if args.once:
        command += ['--once', args.once]
    if args.lossless:
        command.append('--lossless')
    if args.thumbs:
        command += ['--thumbs', args.thumbs]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        fail(f'pack.py failed:\n{result.stdout}{result.stderr}')
    print(result.stdout.strip())


def load_manifest(directory: str) -> dict:
    path = os.path.join(directory, 'manifest.json')
    if not os.path.exists(path):
        fail(f'{path} is missing')
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)


def compare_sheets(manifest: dict, against: str, fresh: str, tolerance: int) -> None:
    """The largest channel difference of any cell, on premultiplied pixels so a transparent pixel's hidden colour does not count."""
    worst = (0, '', 0)
    groups = [('body', manifest)] + list(manifest.get('layers', {}).items())
    sheets = [(layer, sheet, group.get('frameWidth', manifest['frameWidth']), group.get('frameHeight', manifest['frameHeight']))
              for layer, group in groups for sheet in group['sheets']]
    for layer, sheet, width, height in sheets:
        a_path, b_path = os.path.join(against, sheet['file']), os.path.join(fresh, sheet['file'])
        if not os.path.exists(a_path):
            fail(f'{a_path} is missing')
        with Image.open(a_path) as a_image, Image.open(b_path) as b_image:
            if a_image.size != b_image.size:
                fail(f'{sheet["file"]}: committed {a_image.size}, fresh {b_image.size}')
            difference = ImageChops.difference(a_image.convert('RGBa'), b_image.convert('RGBa'))
            columns = sheet['columns']
            for index in range(sheet['frames']):
                left, top = (index % columns) * width, (index // columns) * height
                cell_max = max(high for _, high in difference.crop((left, top, left + width, top + height)).getextrema())
                if cell_max > worst[0]:
                    worst = (cell_max, f'{layer}/{sheet["file"]}', index)
    print(f'check: worst cell difference {worst[0]}/255 ({worst[1]} cell {worst[2]}), tolerance {tolerance}')
    if worst[0] > tolerance:
        fail('the fresh pack differs from the committed atlas beyond the tolerance: the render or the pack arguments changed')


def main(argv: list[str]) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='mode', required=True)
    command = sub.add_parser('pack-layers', help='a directory with one frames directory per layer')
    command.add_argument('source')
    command.add_argument('--against', required=True, help='the committed atlas directory')
    command.add_argument('--scale', type=float, default=1.0)
    command.add_argument('--fps', type=int, default=24)
    command.add_argument('--once', default='')
    command.add_argument('--lossless', action='store_true')
    command.add_argument('--base', default='body')
    command.add_argument('--thumbs', default=None)
    command.add_argument('--tolerance', type=int, default=24, help='the largest channel difference a cell may show')
    args = parser.parse_args(argv)

    with tempfile.TemporaryDirectory(prefix='elf-atlas-check-') as fresh:
        repack(args, fresh)
        committed, packed = load_manifest(args.against), load_manifest(fresh)
        if committed != packed:
            differing = sorted(key for key in set(committed) | set(packed) if committed.get(key) != packed.get(key))
            fail(f'manifest.json differs from the committed one in: {", ".join(differing)}')
        print('check: manifest.json identical')
        compare_sheets(committed, args.against, fresh, args.tolerance)
    check_edges(frame_files(args.source))
    print('check: ok')


if __name__ == '__main__':
    main(sys.argv[1:])
