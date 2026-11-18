#!/usr/bin/env python3
"""Draws the elf glyph (the ElfIcon role of both clients) and writes it as
packages/theme/src/elf-glyph.ts: Phosphor has no elf, so this one is drawn
to Phosphor's own rules (a 256 grid, a 16 unit line with round ends for the
regular weight, the other weights by the line's width, a solid form for
"fill", the form at a fifth of the ink under the outline for "duotone") and
handed to each client's Phosphor base component, so it takes size, weight
and colour like every other icon.

The elf is the app's own: a round face under an acorn cap with a sprout,
and pointed ears. Everything is circles' arcs and straight lines, written
out as closed outlines (never strokes: a filled outline takes its colour
the way the library's glyphs do). Each outline runs clockwise and a cut-out
runs the other way, which the default fill rule reads as a hole.

    python3 packages/theme/art/elf-glyph.py            writes src/elf-glyph.ts
    python3 packages/theme/art/elf-glyph.py --preview FILE.html   a sheet to look at
"""
from __future__ import annotations

import math
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / 'src' / 'elf-glyph.ts'

# The drawing, on the 256 grid.
CX = 128
CAP_Y = 131          # the cap's rim, where it sits on the head
CAP_R = 64           # the cap's dome, and the face's width
BRIM = 64            # the rim's reach to each side
FACE_DROP = 24       # the cheeks' straight run under the rim
EYE_X, EYE_Y, EYE_R = 24, 32, 11
SMILE_Y, SMILE_R, SMILE_HALF = 42, 24, 50
EAR_TOP, EAR_TIP, EAR_LOW = (64, 26), (106, 8), (64, 60)   # offsets from the rim's middle
STEM = 14            # the sprout's stem above the dome
LEAF = (18, 16)      # a leaf's reach from the stem's top
LINE = {'thin': 8, 'light': 12, 'regular': 16, 'bold': 24}


def n(value: float) -> str:
    text = f'{value:.2f}'.rstrip('0').rstrip('.')
    return '0' if text == '-0' else text


def capsule(p0, p1, w):
    """A straight line of width w with round ends."""
    (x0, y0), (x1, y1) = p0, p1
    length = math.hypot(x1 - x0, y1 - y0)
    r = w / 2
    mx, my = (y1 - y0) / length * r, -(x1 - x0) / length * r
    return (f'M{n(x0 + mx)} {n(y0 + my)}L{n(x1 + mx)} {n(y1 + my)}A{n(r)} {n(r)} 0 0 1 {n(x1 - mx)} {n(y1 - my)}'
            f'L{n(x0 - mx)} {n(y0 - my)}A{n(r)} {n(r)} 0 0 1 {n(x0 + mx)} {n(y0 + my)}Z')


def at(c, radius, angle):
    return c[0] + radius * math.cos(math.radians(angle)), c[1] + radius * math.sin(math.radians(angle))


def ring(c, radius, a0, a1, w, hole=False):
    """An arc of a circle (angles clockwise from three o'clock, a0 < a1) of width w with round ends."""
    ro, ri, r = radius + w / 2, radius - w / 2, w / 2
    large = 1 if a1 - a0 > 180 else 0
    o0, o1, i0, i1 = at(c, ro, a0), at(c, ro, a1), at(c, ri, a0), at(c, ri, a1)
    if hole:
        return (f'M{n(o0[0])} {n(o0[1])}A{n(r)} {n(r)} 0 0 0 {n(i0[0])} {n(i0[1])}A{n(ri)} {n(ri)} 0 {large} 1 {n(i1[0])} {n(i1[1])}'
                f'A{n(r)} {n(r)} 0 0 0 {n(o1[0])} {n(o1[1])}A{n(ro)} {n(ro)} 0 {large} 0 {n(o0[0])} {n(o0[1])}Z')
    return (f'M{n(o0[0])} {n(o0[1])}A{n(ro)} {n(ro)} 0 {large} 1 {n(o1[0])} {n(o1[1])}A{n(r)} {n(r)} 0 0 1 {n(i1[0])} {n(i1[1])}'
            f'A{n(ri)} {n(ri)} 0 {large} 0 {n(i0[0])} {n(i0[1])}A{n(r)} {n(r)} 0 0 1 {n(o0[0])} {n(o0[1])}Z')


def disc(c, r, hole=False):
    sweep = 0 if hole else 1
    return f'M{n(c[0] - r)} {n(c[1])}A{n(r)} {n(r)} 0 1 {sweep} {n(c[0] + r)} {n(c[1])}A{n(r)} {n(r)} 0 1 {sweep} {n(c[0] - r)} {n(c[1])}Z'


def polygon(points):
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]))
    if area < 0:
        points = points[::-1]
    return 'M' + 'L'.join(f'{n(x)} {n(y)}' for x, y in points) + 'Z'


def both(build):
    """A part and its mirror image across the middle."""
    return build(1) + build(-1)


def ear(side):
    return [(CX - side * dx, CAP_Y + dy) for dx, dy in (EAR_TOP, EAR_TIP, EAR_LOW)]


def sprout(w):
    top = (CX, CAP_Y - CAP_R - STEM)
    return capsule((CX, CAP_Y - CAP_R), top, w) + both(lambda s: capsule(top, (CX + s * LEAF[0], top[1] - LEAF[1]), w))


def features(w, hole=False):
    eyes = both(lambda s: disc((CX + s * EYE_X, CAP_Y + EYE_Y), EYE_R, hole))
    return eyes + ring((CX, CAP_Y + SMILE_Y), SMILE_R, 90 - SMILE_HALF, 90 + SMILE_HALF, w, hole)


def outline(w):
    chin = (CX, CAP_Y + FACE_DROP)
    parts = [
        ring((CX, CAP_Y), CAP_R, 180, 360, w),                                   # the cap's dome
        capsule((CX - BRIM, CAP_Y), (CX + BRIM, CAP_Y), w),                      # its brim
        both(lambda s: capsule((CX + s * CAP_R, CAP_Y), (CX + s * CAP_R, chin[1]), w)),   # the cheeks
        ring(chin, CAP_R, 0, 180, w),                                            # the chin
        both(lambda s: ''.join(capsule(a, b, w) for a, b in zip(ear(s), ear(s)[1:]))),
        sprout(w),
        features(w),
    ]
    return ''.join(parts)


def form(w, gap=True):
    """The solid elf: the cap, the face under a thin gap, the ears."""
    chin_y = CAP_Y + FACE_DROP
    half, top = CAP_R + w / 2, CAP_Y + (w if gap else 0)
    dome = f'M{n(CX - half)} {n(CAP_Y)}A{n(half)} {n(half)} 0 0 1 {n(CX + half)} {n(CAP_Y)}Z'
    face = (f'M{n(CX - half)} {n(top)}L{n(CX + half)} {n(top)}L{n(CX + half)} {n(chin_y)}'
            f'A{n(half)} {n(half)} 0 0 1 {n(CX - half)} {n(chin_y)}Z')
    ears = both(lambda s: polygon(ear(s)) + ''.join(capsule(a, b, w) for a, b in zip(ear(s), ear(s)[1:])))
    return dome, face, ears


def weights():
    out = {name: {'d': outline(w)} for name, w in LINE.items()}
    w = LINE['regular']
    dome, face, ears = form(w)
    out['fill'] = {'d': dome + capsule((CX - BRIM, CAP_Y), (CX + BRIM, CAP_Y), w) + face + ears + sprout(w) + features(w, hole=True)}
    dome, face, ears = form(0, gap=False)
    out['duotone'] = {'shade': dome + face + both(lambda s: polygon(ear(s))), 'd': outline(w)}
    return out


def write():
    lines = [
        "/* GENERATED by packages/theme/art/elf-glyph.py: do not edit by hand.",
        "",
        "   The elf glyph, the ElfIcon role of both clients: Phosphor has no elf, so",
        "   this one is drawn to Phosphor's rules (the 256 grid, its line widths, a",
        "   solid form for \"fill\", a shaded one for \"duotone\") and handed to each",
        "   client's Phosphor base component, so it takes size, weight and colour",
        "   like every other icon. `d` is the ink; `shade` the form duotone lays",
        "   under it at the library's duotone opacity. */",
        "",
        "export type ElfGlyphWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'",
        "",
        "export const ELF_GLYPH: Record<ElfGlyphWeight, { d: string; shade?: string }> = {",
    ]
    for name, glyph in weights().items():
        shade = f"\n    shade: '{glyph['shade']}'," if 'shade' in glyph else ''
        lines.append(f"  {name}: {{{shade}\n    d: '{glyph['d']}',\n  }},")
    lines.append('}')
    OUT.write_text('\n'.join(lines) + '\n')
    print(f'wrote {OUT} ({OUT.stat().st_size} bytes)')


def preview(target):
    glyphs = weights()

    def svg(name, size, colour):
        glyph = glyphs[name]
        shade = f'<path d="{glyph["shade"]}" opacity="0.2"/>' if 'shade' in glyph else ''
        return f'<svg width="{size}" height="{size}" viewBox="0 0 256 256" fill="{colour}">{shade}<path d="{glyph["d"]}"/></svg>'

    rows = []
    for name in ('regular', 'fill', 'duotone', 'bold', 'light', 'thin'):
        cells = ''.join(f'<td>{svg(name, size, "#d4b25e")}</td>' for size in (20, 24, 28, 32, 48, 96, 200))
        rows.append(f'<tr><th>{name}</th>{cells}</tr>')
    pathlib.Path(target).write_text(
        '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#1b2622;color:#bbb;font:14px sans-serif">'
        f'<table cellpadding="14">{"".join(rows)}</table>'
        f'<div style="background:#f4efe2;padding:14px">{svg("regular", 32, "#1b2622")} {svg("fill", 32, "#1b2622")} {svg("duotone", 96, "#7a5a1e")}</div></body>')
    print(f'preview {target}')


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--preview':
        preview(sys.argv[2])
    else:
        write()
