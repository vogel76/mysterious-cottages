"""
room_sheet.py - post-processing for the room renders, run with the system python.

Why: Blender's bundled python has no Pillow, so room.py calls this script after
rendering. It measures the opaque bounding box of every furniture sprite (in
plate pixels, so the app knows where to place each sprite over the plate),
writes sprites.json and tiles the renders into one contact sheet for review.

Usage: /usr/bin/python3 room_sheet.py OUT_DIR [sprite.png ...] [--pack DEST --registry FILE.ts]
Reads OUT_DIR/camera.json, the plates and the given sprite files (default:
every <slot>_<variant>.png in OUT_DIR; a <slot>_<variant>.day.png next to one
is its daytime twin, a <slot>_<variant>.thumb.png its catalogue picture);
writes OUT_DIR/sprites.json and OUT_DIR/contact.png. With --pack DEST it also
writes the app's assets into DEST (assets/elf/room, emptied of its old WebP
files first): the empty room for every wall and floor as
plate_<wall>_<floor>.webp with its _day twin, every sprite cropped to its box
as <slot>_<variant>.webp with its _day twin, the catalogue's pictures as
<slot>_<variant>_thumb.webp, wall_<id>_thumb.webp and floor_<id>_thumb.webp,
and manifest.json with the plates, the boxes, the floor line, the rug centre,
the baked fireplace's box and fire, the wall's and the floor's boxes and
the sill's places for the finds and the point the egg rests on, all from
camera.json; with --registry it writes the TypeScript module that names
every file of DEST for Metro (src/features/elf/cottage/roomFiles.ts).
"""

import json
import os
import sys

from PIL import Image, ImageDraw

ALPHA_THRESHOLD = 12
WEBP_QUALITY = 88
# The catalogue pictures' longer side in the app's assets.
THUMB_SIDE = 320


def is_sprite(name):
    return name.endswith(".png") and "_" in name and not name.startswith(("plate", "wall_", "floor_")) \
        and not name.endswith((".day.png", ".thumb.png")) and name not in ("contact.png",)


def sprite_files(out_dir, camera):
    """The night sprites, in the catalogue's order when camera.json has it."""
    if "variants" in camera:
        names = [f"{slot}_{variant}.png" for slot, variant, _default in camera["variants"]]
        return [name for name in names if os.path.exists(os.path.join(out_dir, name))]
    return sorted(name for name in os.listdir(out_dir) if is_sprite(name))


def twin(out_dir, name, kind):
    """The day or thumb render of a sprite, if it was made."""
    other = name[:-4] + f".{kind}.png"
    return other if os.path.exists(os.path.join(out_dir, other)) else None


def opaque_box(path):
    img = Image.open(path).convert("RGBA")
    alpha = img.getchannel("A").point(lambda a: 255 if a > ALPHA_THRESHOLD else 0)
    return alpha.getbbox()


def measure(out_dir, files, defaults):
    """The box of each sprite: the union of its night and day renders, so
    both crop to the same cell."""
    entries = []
    for name in files:
        slot, variant = name[:-4].split("_", 1)
        bbox = opaque_box(os.path.join(out_dir, name))
        day = twin(out_dir, name, "day")
        if day:
            other = opaque_box(os.path.join(out_dir, day))
            if bbox and other:
                bbox = (min(bbox[0], other[0]), min(bbox[1], other[1]), max(bbox[2], other[2]), max(bbox[3], other[3]))
            bbox = bbox or other
        if bbox is None:
            print(f"[sheet] {name}: fully transparent, skipped")
            continue
        x0, y0, x1, y1 = bbox
        entry = {"slot": slot, "variant": variant, "default": (slot, variant) in defaults, "file": name,
                 "x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}
        if day:
            entry["fileDay"] = day
        thumb = twin(out_dir, name, "thumb")
        if thumb:
            entry["fileThumb"] = thumb
        entries.append(entry)
    return entries


def checker(size, cell=24):
    img = Image.new("RGBA", size, (120, 120, 120, 255))
    d = ImageDraw.Draw(img)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2 == 0:
                d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(150, 150, 150, 255))
    return img


def contact_sheet(out_dir, entries, plates):
    """The review sheet: the given plates large, every sprite small on a
    checker with its box drawn."""
    plates = [(p, Image.open(os.path.join(out_dir, p)).convert("RGBA")) for p in plates if os.path.exists(os.path.join(out_dir, p))]
    if not plates and not entries:
        return
    ref = plates[0][1] if plates else Image.open(os.path.join(out_dir, entries[0]["file"]))
    w, h = ref.size
    big, small, pad, cols = 0.4, 0.2, 16, 6
    bw, bh = int(w * big), int(h * big)
    sw, sh = int(w * small), int(h * small)
    rows = (len(entries) + cols - 1) // cols
    sheet_w = max(len(plates) * (bw + pad), cols * (sw + pad)) + pad
    sheet_h = pad + (bh + pad + 20 if plates else 0) + rows * (sh + pad + 20) + pad
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (40, 36, 32, 255))
    d = ImageDraw.Draw(sheet)
    y = pad
    for i, (name, img) in enumerate(plates):
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


def save_thumb(src, dest, transparent):
    """A catalogue picture: trimmed to the piece (a transparent one) and
    scaled so its longer side is THUMB_SIDE at most."""
    img = Image.open(src).convert("RGBA" if transparent else "RGB")
    if transparent:
        box = img.getchannel("A").point(lambda a: 255 if a > ALPHA_THRESHOLD else 0).getbbox()
        if box:
            img = img.crop(box)
    img.thumbnail((THUMB_SIDE, THUMB_SIDE), Image.LANCZOS)
    img.save(dest, quality=WEBP_QUALITY)


def pack(out_dir, entries, camera, dest):
    """The app's assets and the manifest the scene reads
    (src/features/elf/cottage/room.ts and roomAssets.ts)."""
    os.makedirs(dest, exist_ok=True)
    for name in os.listdir(dest):
        if name.endswith(".webp") or name == "manifest.json":
            os.remove(os.path.join(dest, name))
    walls, floors = camera["walls"], camera["floors"]
    first = Image.open(os.path.join(out_dir, f"plate_{walls[0]}_{floors[0]}.png"))
    manifest = {"version": 3, "width": first.width, "height": first.height,
                "floorY": int(round(camera["floor_line_px"])),
                "rug": {"x": int(round(camera["rug_center_px"][0])), "y": int(round(camera["rug_center_px"][1]))},
                "fireplace": camera["fireplace_px"],
                "hearth": {"x": int(round(camera["hearth_px"][0])), "y": int(round(camera["hearth_px"][1]))},
                "wall": camera["wall_px"], "floor": camera["floor_px"],
                "sillOffsets": camera.get("sill_offsets_px", [0]),
                "eggBase": camera.get("egg_base_px"),
                "walls": [], "floors": [], "plates": {}, "sprites": []}
    for wall in walls:
        for floor in floors:
            plate = {}
            for time, suffix in (("night", ""), ("day", "_day")):
                src = os.path.join(out_dir, f"plate_{wall}_{floor}{suffix}.png")
                if os.path.exists(src):
                    name = f"plate_{wall}_{floor}{suffix}.webp"
                    Image.open(src).convert("RGB").save(os.path.join(dest, name), quality=WEBP_QUALITY)
                    plate[time] = name
            manifest["plates"][f"{wall}/{floor}"] = plate
    for kind, ids in (("wall", walls), ("floor", floors)):
        for variant in ids:
            src = os.path.join(out_dir, f"{kind}_{variant}.thumb.png")
            entry = {"id": variant}
            if os.path.exists(src):
                entry["thumb"] = f"{kind}_{variant}_thumb.webp"
                save_thumb(src, os.path.join(dest, entry["thumb"]), False)
            manifest[f"{kind}s"].append(entry)
    for e in entries:
        box = (e["x"], e["y"], e["x"] + e["width"], e["y"] + e["height"])
        base = f"{e['slot']}_{e['variant']}"
        Image.open(os.path.join(out_dir, e["file"])).convert("RGBA").crop(box).save(os.path.join(dest, base + ".webp"), quality=WEBP_QUALITY)
        packed = {k: v for k, v in e.items() if k not in ("fileDay", "fileThumb")}
        packed["file"] = base + ".webp"
        if "fileDay" in e:
            Image.open(os.path.join(out_dir, e["fileDay"])).convert("RGBA").crop(box).save(os.path.join(dest, base + "_day.webp"), quality=WEBP_QUALITY)
            packed["fileDay"] = base + "_day.webp"
        if "fileThumb" in e:
            save_thumb(os.path.join(out_dir, e["fileThumb"]), os.path.join(dest, base + "_thumb.webp"), True)
            packed["fileThumb"] = base + "_thumb.webp"
        manifest["sprites"].append(packed)
    with open(os.path.join(dest, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"[sheet] packed {len(entries)} sprites, {len(manifest['plates'])} plates and the catalogue into {dest}")


def write_registry(dest, registry):
    """The module that names every file of the room's assets for Metro, which
    bundles only what a static require names."""
    rel = os.path.relpath(dest, os.path.dirname(os.path.abspath(registry)))
    names = sorted(name for name in os.listdir(dest) if name.endswith(".webp"))
    lines = [
        "/* Generated by art/blender/room_sheet.py --pack from assets/elf/room; do not",
        "   edit by hand. Metro bundles only what a static require names, so every",
        "   file of the room's assets is named here; roomAssets.ts looks them up by",
        "   the names the manifest gives. */",
        "export const ROOM_FILES: Record<string, number> = {",
    ]
    lines += [f"  '{name}': require('{rel}/{name}')," for name in names]
    lines += ["}", ""]
    with open(registry, "w") as f:
        f.write("\n".join(lines))
    print(f"[sheet] registry of {len(names)} files in {registry}")


def main():
    args = sys.argv[1:]
    options = {}
    for flag in ("--pack", "--registry"):
        if flag in args:
            at = args.index(flag)
            options[flag] = os.path.abspath(args[at + 1])
            del args[at:at + 2]
    out_dir = os.path.abspath(args[0])
    with open(os.path.join(out_dir, "camera.json")) as f:
        camera = json.load(f)
    defaults = {(slot, variant) for slot, variant, default in camera.get("variants", []) if default}
    files = args[1:] or sprite_files(out_dir, camera)
    entries = measure(out_dir, files, defaults)
    with open(os.path.join(out_dir, "sprites.json"), "w") as f:
        json.dump(entries, f, indent=2)
    for e in entries:
        print(f"[sheet] {e['file']}: {e['width']}x{e['height']} at ({e['x']}, {e['y']})")
    walls, floors = camera.get("walls", ["plaster"]), camera.get("floors", ["planks"])
    contact_sheet(out_dir, entries, ["plate.png", "plate_day.png", f"plate_{walls[0]}_{floors[0]}.png", f"plate_{walls[0]}_{floors[0]}_day.png"])
    if "--pack" in options:
        pack(out_dir, entries, camera, options["--pack"])
        if "--registry" in options:
            write_registry(options["--pack"], options["--registry"])


if __name__ == "__main__":
    main()
