"""
Contact sheet tiler for Blender sprite renders.

Tiles several RGBA PNG renders into one PNG on a neutral grey background so
that the alpha edge and the outline can be judged at a glance. It runs with
the system python3 (Pillow is installed there, not inside Blender's python),
so the Blender build scripts call it through subprocess.

Usage:
    python3 contact_sheet.py <out.png> <columns> <cell_scale> <label:path> [<label:path> ...]
"""

import sys

from PIL import Image, ImageDraw


def main() -> None:
    out, columns, scale = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
    items = [arg.split(":", 1) for arg in sys.argv[4:]]
    images = [(label, Image.open(path).convert("RGBA")) for label, path in items]
    cell_w = int(max(im.width for _, im in images) * scale)
    cell_h = int(max(im.height for _, im in images) * scale)
    rows = (len(images) + columns - 1) // columns
    label_h = 28
    sheet = Image.new("RGBA", (cell_w * columns, (cell_h + label_h) * rows), (120, 120, 120, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (label, im) in enumerate(images):
        col, row = index % columns, index // columns
        x, y = col * cell_w, row * (cell_h + label_h)
        thumb = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
        # Alternate cell shades so neighbouring frames are easy to tell apart.
        shade = 120 if (col + row) % 2 == 0 else 108
        draw.rectangle([x, y, x + cell_w, y + cell_h + label_h], fill=(shade, shade, shade, 255))
        sheet.alpha_composite(thumb, (x + (cell_w - thumb.width) // 2, y))
        draw.text((x + 8, y + cell_h + 6), label, fill=(240, 240, 240, 255))
    sheet.convert("RGB").save(out)


if __name__ == "__main__":
    main()
