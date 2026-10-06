"""
room_sheet.py - post-processing for the room renders, run with the system python.

Why: Blender's bundled python has no Pillow, so room.py calls this script after
rendering. It measures the opaque bounding box of every furniture sprite (in
plate pixels, so the app knows where to place each sprite over the shell plate),
writes sprites.json, tiles all renders into one contact sheet for review and
crops the plate to the band a 9:20 phone shows (the app fits the plate to the
screen height and crops the sides) so the phone view can be judged directly.

Usage: /usr/bin/python3 room_sheet.py OUT_DIR [sprite.png ...]
Reads OUT_DIR/plate.png, plate_empty.png and the given sprite files (default:
every <slot>_<variant>.png in OUT_DIR); writes OUT_DIR/sprites.json,
OUT_DIR/contact.png and OUT_DIR/phone_crop.png.
"""

import json
import os
import sys

from PIL import Image, ImageDraw

ALPHA_THRESHOLD = 12
PLATES = ("plate.png", "plate_empty.png")
# The band of the plate a 9:20 phone shows with the app's cover fit, as a
# fraction of the plate width: 140..860 of 1000.
PHONE_BAND = (0.14, 0.86)


def sprite_files(out_dir):
    files = []
    for name in sorted(os.listdir(out_dir)):
        if not name.endswith(".png") or name in PLATES or name in ("contact.png", "phone_crop.png"):
            continue
        if "_" not in name:
            continue
        files.append(name)
    return files


def measure(out_dir, files):
    entries = []
    for name in files:
        slot, variant = name[:-4].split("_", 1)
        img = Image.open(os.path.join(out_dir, name)).convert("RGBA")
        alpha = img.getchannel("A").point(lambda a: 255 if a > ALPHA_THRESHOLD else 0)
        bbox = alpha.getbbox()
        if bbox is None:
            print(f"[sheet] {name}: fully transparent, skipped")
            continue
        x0, y0, x1, y1 = bbox
        entries.append({"slot": slot, "variant": variant, "file": name,
                        "x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0})
    return entries


def checker(size, cell=24):
    img = Image.new("RGBA", size, (120, 120, 120, 255))
    d = ImageDraw.Draw(img)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2 == 0:
                d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(150, 150, 150, 255))
    return img


def contact_sheet(out_dir, entries):
    plates = [Image.open(os.path.join(out_dir, p)).convert("RGBA") for p in PLATES if os.path.exists(os.path.join(out_dir, p))]
    if not plates and not entries:
        return
    ref = plates[0] if plates else Image.open(os.path.join(out_dir, entries[0]["file"]))
    w, h = ref.size
    big = 0.5
    small = 0.25
    pad = 16
    cols = 4
    bw, bh = int(w * big), int(h * big)
    sw, sh = int(w * small), int(h * small)
    rows = (len(entries) + cols - 1) // cols
    sheet_w = max(len(plates) * (bw + pad), cols * (sw + pad)) + pad
    sheet_h = pad + (bh + pad + 20 if plates else 0) + rows * (sh + pad + 20) + pad
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (40, 36, 32, 255))
    d = ImageDraw.Draw(sheet)
    y = pad
    for i, (name, img) in enumerate(zip(PLATES, plates)):
        x = pad + i * (bw + pad)
        sheet.paste(img.resize((bw, bh), Image.LANCZOS), (x, y + 20))
        d.text((x, y + 4), name, fill=(230, 220, 200, 255))
    if plates:
        y += bh + pad + 20
    for i, e in enumerate(entries):
        x = pad + (i % cols) * (sw + pad)
        yy = y + (i // cols) * (sh + pad + 20)
        tile = checker((sw, sh))
        img = Image.open(os.path.join(out_dir, e["file"])).convert("RGBA").resize((sw, sh), Image.LANCZOS)
        tile.alpha_composite(img)
        td = ImageDraw.Draw(tile)
        bx0, by0 = int(e["x"] * small), int(e["y"] * small)
        bx1, by1 = int((e["x"] + e["width"]) * small), int((e["y"] + e["height"]) * small)
        td.rectangle([bx0, by0, bx1, by1], outline=(255, 80, 80, 255))
        sheet.paste(tile, (x, yy + 20))
        d.text((x, yy + 4), f"{e['file']} {e['width']}x{e['height']} at {e['x']},{e['y']}", fill=(230, 220, 200, 255))
    sheet.save(os.path.join(out_dir, "contact.png"))
    print(f"[sheet] contact.png {sheet_w}x{sheet_h}")


def phone_crop(out_dir):
    """The full plate cropped to the central band a phone shows."""
    path = os.path.join(out_dir, "plate.png")
    if not os.path.exists(path):
        return
    img = Image.open(path).convert("RGB")
    w, h = img.size
    x0, x1 = int(round(w * PHONE_BAND[0])), int(round(w * PHONE_BAND[1]))
    img.crop((x0, 0, x1, h)).save(os.path.join(out_dir, "phone_crop.png"))
    print(f"[sheet] phone_crop.png {x1 - x0}x{h} (plate x {x0}..{x1})")


def main():
    out_dir = os.path.abspath(sys.argv[1])
    files = sys.argv[2:] or sprite_files(out_dir)
    entries = measure(out_dir, files)
    with open(os.path.join(out_dir, "sprites.json"), "w") as f:
        json.dump(entries, f, indent=2)
    for e in entries:
        print(f"[sheet] {e['file']}: {e['width']}x{e['height']} at ({e['x']}, {e['y']})")
    contact_sheet(out_dir, entries)
    phone_crop(out_dir)


if __name__ == "__main__":
    main()
