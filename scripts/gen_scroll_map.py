#!/usr/bin/env python3
"""Generate assets/map/forest-map.svg in a vintage pirate-treasure-map style.

Full-frame aged parchment with torn edges on ALL four sides, a
decorative double-ruled inner border, hand-drawn ink symbols
(mountains, pines, castles, cottages, compass rose), a title
cartouche and the fairytale scene content. Cottage positions come
from data/cottages.json (mapX, mapY fields); the #cottages and
#branches groups are left empty for main.js to populate at runtime.

Re-runnable: call `python3 scripts/gen_scroll_map.py` to regenerate.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT  = ROOT / "assets/map/forest-map.svg"
COTTAGES_JSON = ROOT / "data/cottages.json"

VW, VH = 1600, 1200

# ---------- frame geometry ----------
OUTER_MARGIN   = 28     # outer torn page edge margin
FRAME_MARGIN   = 92     # inner double-ruled border margin
CONTENT_MARGIN = 130    # content kept inside this margin from viewBox edge

# ---------- palette ----------
INK_DARK     = "#2a1806"
INK          = "#4a2d10"
INK_MED      = "#6b4218"
INK_SOFT     = "#8a5a2b"
INK_FAINT    = "#a97632"
PAPER_HI     = "#f5dfa8"
PAPER_MID    = "#e3bf80"
PAPER_LOW    = "#b3823a"
ACCENT_RED   = "#a83a2a"


# ---------- helpers ----------
def torn_edge(pts_start, pts_end, *, rnd, amp, seg=42, jitter=10):
    """Add torn-edge points between start and end along one side.
    pts_start / pts_end are (x, y). Returns a list of intermediate (x,y) points
    tracing a jagged line along the straight edge from start toward end."""
    sx, sy = pts_start
    ex, ey = pts_end
    dx, dy = ex - sx, ey - sy
    length = (dx * dx + dy * dy) ** 0.5
    if length == 0:
        return []
    # unit tangent and normal
    tx, ty = dx / length, dy / length
    nx, ny = -ty, tx
    n = max(3, int(length / seg))
    pts = []
    for i in range(1, n):
        t = i / n + rnd.uniform(-0.02, 0.02)
        base_x = sx + dx * t
        base_y = sy + dy * t
        off = rnd.uniform(-amp, amp)
        tan_j = rnd.uniform(-jitter, jitter)
        pts.append((base_x + nx * off + tx * tan_j,
                    base_y + ny * off + ty * tan_j))
    return pts


def torn_rect_path(rnd, margin, *, amp, seg=42):
    """Build a closed SVG path d= for a rectangle with torn edges on all four sides."""
    x0, x1 = margin, VW - margin
    y0, y1 = margin, VH - margin
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    out = [corners[0]]
    for i in range(4):
        a = corners[i]
        b = corners[(i + 1) % 4]
        out.extend(torn_edge(a, b, rnd=rnd, amp=amp, seg=seg))
        out.append(b)
    d = f"M{out[0][0]:.1f},{out[0][1]:.1f} " \
        + " ".join(f"L{x:.1f},{y:.1f}" for x, y in out[1:]) + " Z"
    return d


def rand_stains(rnd, n=18):
    out = []
    for _ in range(n):
        cx = rnd.uniform(150, VW - 150)
        cy = rnd.uniform(130, VH - 130)
        rx = rnd.uniform(18, 65)
        ry = rnd.uniform(10, 34)
        rot = rnd.uniform(0, 180)
        opac = rnd.uniform(0.10, 0.22)
        out.append((cx, cy, rx, ry, rot, opac))
    return out


def corner_flourish(x, y, mx, my):
    """Draw a small decorative ink flourish at a corner of the inner frame.
    (x,y) = the corner anchor; (mx,my) = direction multipliers (±1, ±1)."""
    return f"""
    <g stroke="{INK}" stroke-width="1.3" fill="none" opacity="0.85">
      <path d="M {x},{y} q {20*mx},{6*my} {36*mx},{22*my} q {6*mx},{10*my} {6*mx},{22*my}"/>
      <path d="M {x},{y} q {6*mx},{20*my} {22*mx},{36*my} q {10*mx},{6*my} {22*mx},{6*my}"/>
      <circle cx="{x + 28*mx}" cy="{y + 28*my}" r="2.5" fill="{INK}"/>
    </g>"""


def load_cottages():
    with COTTAGES_JSON.open() as f:
        return json.load(f)


def tick_marks():
    """Tick marks around the compass rose (every 10°, longer at cardinals)."""
    import math as _math
    cx = cy = 100
    r_in, r_out = 86, 92
    parts = []
    for deg in range(0, 360, 10):
        rad = _math.radians(deg - 90)
        x1 = cx + r_in * _math.cos(rad)
        y1 = cy + r_in * _math.sin(rad)
        x2 = cx + r_out * _math.cos(rad)
        y2 = cy + r_out * _math.sin(rad)
        parts.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{INK}" stroke-width="{1.4 if deg % 90 == 0 else 0.8}"/>'
        )
    return "\n      ".join(parts)


# ---------- symbols (hand-drawn ink style) ----------
SYMBOLS = f"""
  <!-- Mountain range: a trio of triangular peaks with slope hatching -->
  <symbol id="mountain" viewBox="0 0 160 100">
    <path d="M 10,92 L 50,22 L 90,92 Z"
          fill="{PAPER_LOW}" stroke="{INK}" stroke-width="2"/>
    <path d="M 60,92 L 100,8 L 140,92 Z"
          fill="{PAPER_MID}" stroke="{INK}" stroke-width="2"/>
    <path d="M 110,92 L 140,38 L 158,92 Z"
          fill="{PAPER_LOW}" stroke="{INK}" stroke-width="2"/>
    <!-- Snow caps on the tallest peak -->
    <path d="M 92,20 L 100,8 L 108,20 L 104,24 L 100,18 L 96,24 Z"
          fill="{PAPER_HI}" stroke="{INK}" stroke-width="1"/>
    <!-- Slope hatching (suggests rocky terrain) -->
    <g stroke="{INK}" stroke-width="0.8" fill="none" opacity="0.8">
      <path d="M 50,22 L 44,34 M 48,30 L 42,42 M 46,38 L 40,50 M 44,46 L 38,58"/>
      <path d="M 100,8 L 93,22 M 98,16 L 90,30 M 96,24 L 88,38 M 94,32 L 86,46 M 92,40 L 84,54 M 90,48 L 82,62 M 88,56 L 80,70"/>
      <path d="M 140,38 L 134,50 M 138,46 L 132,58 M 136,54 L 130,66"/>
    </g>
  </symbol>

  <!-- Single pine / fir tree (small ink silhouette) -->
  <symbol id="pine" viewBox="0 0 30 44">
    <polygon points="15,3 4,18 11,18 3,30 12,30 2,42 28,42 18,30 27,30 19,18 26,18"
             fill="{INK_MED}" stroke="{INK_DARK}" stroke-width="1"/>
    <rect x="13.5" y="42" width="3" height="2" fill="{INK_DARK}"/>
  </symbol>

  <!-- Fatter pine (variety) -->
  <symbol id="pine2" viewBox="0 0 30 40">
    <polygon points="15,2 3,26 12,26 5,38 25,38 18,26 27,26"
             fill="{INK_SOFT}" stroke="{INK_DARK}" stroke-width="1"/>
    <rect x="13.5" y="38" width="3" height="2" fill="{INK_DARK}"/>
  </symbol>

  <!-- Castle: main keep, two flanking towers, crenellations, flag -->
  <symbol id="castle" viewBox="0 0 160 140">
    <!-- Rocky base -->
    <path d="M 0,128 Q 30,112 60,122 T 120,118 Q 150,126 160,132 L 160,140 L 0,140 Z"
          fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1.5"/>
    <!-- Left tower -->
    <rect x="22" y="68" width="30" height="60" fill="{PAPER_MID}" stroke="{INK}" stroke-width="1.6"/>
    <path d="M 22,68 h4 v-6 h4 v6 h4 v-6 h4 v6 h4 v-6 h4 v6 h4 v-6 h2 v6"
          fill="none" stroke="{INK}" stroke-width="1.6"/>
    <!-- Right tower -->
    <rect x="108" y="62" width="32" height="66" fill="{PAPER_MID}" stroke="{INK}" stroke-width="1.6"/>
    <path d="M 108,62 h4 v-6 h4 v6 h4 v-6 h4 v6 h4 v-6 h4 v6 h4 v-6 h2 v6"
          fill="none" stroke="{INK}" stroke-width="1.6"/>
    <!-- Main keep (central, tallest) -->
    <rect x="58" y="42" width="46" height="86" fill="{PAPER_HI}" stroke="{INK}" stroke-width="1.8"/>
    <path d="M 58,42 h4 v-6 h4 v6 h4 v-6 h4 v6 h4 v-6 h4 v6 h4 v-6 h4 v6 h4 v-6 h4 v6 h4 v-6 h2 v6"
          fill="none" stroke="{INK}" stroke-width="1.8"/>
    <!-- Windows -->
    <rect x="76" y="58" width="5" height="10" fill="{INK}"/>
    <rect x="83" y="58" width="5" height="10" fill="{INK}"/>
    <rect x="30" y="86" width="4" height="8" fill="{INK}"/>
    <rect x="42" y="86" width="4" height="8" fill="{INK}"/>
    <rect x="118" y="80" width="4" height="8" fill="{INK}"/>
    <rect x="130" y="80" width="4" height="8" fill="{INK}"/>
    <!-- Door -->
    <path d="M 76,128 V 104 Q 76,96 82,96 H 82 Q 88,96 88,104 V 128 Z"
          fill="{INK}"/>
    <!-- Flag on keep -->
    <line x1="81" y1="36" x2="81" y2="18" stroke="{INK_DARK}" stroke-width="2"/>
    <path d="M 81,18 L 100,24 L 81,30 Z" fill="{ACCENT_RED}" stroke="{INK_DARK}" stroke-width="1"/>
    <!-- Bricks hatching (subtle) -->
    <g stroke="{INK}" stroke-width="0.5" opacity="0.35" fill="none">
      <line x1="58" y1="56"  x2="104" y2="56"/>
      <line x1="58" y1="74"  x2="104" y2="74"/>
      <line x1="58" y1="92"  x2="104" y2="92"/>
      <line x1="58" y1="110" x2="104" y2="110"/>
      <line x1="22" y1="82"  x2="52"  y2="82"/>
      <line x1="22" y1="98"  x2="52"  y2="98"/>
      <line x1="22" y1="114" x2="52"  y2="114"/>
      <line x1="108" y1="76" x2="140" y2="76"/>
      <line x1="108" y1="94" x2="140" y2="94"/>
      <line x1="108" y1="112" x2="140" y2="112"/>
    </g>
  </symbol>

  <!-- Cozy cottage (house + red roof + chimney with curling smoke) -->
  <symbol id="cottageHouse" viewBox="0 0 48 52">
    <!-- Smoke curl -->
    <path d="M 34,10 q -4,-6 2,-10 q 6,-3 0,-10"
          fill="none" stroke="{INK}" stroke-width="1.2" stroke-linecap="round" opacity="0.55"/>
    <!-- Chimney -->
    <rect x="32" y="10" width="6" height="12" fill="{INK}"/>
    <!-- Roof -->
    <polygon points="6,24 24,6 42,24" fill="{ACCENT_RED}" stroke="{INK_DARK}" stroke-width="1.5"/>
    <!-- Walls -->
    <rect x="10" y="24" width="28" height="22" fill="{PAPER_HI}" stroke="{INK_DARK}" stroke-width="1.5"/>
    <!-- Window -->
    <rect x="14" y="28" width="8" height="8" fill="{INK}" stroke="{INK}" stroke-width="0.6"/>
    <line x1="18" y1="28" x2="18" y2="36" stroke="{PAPER_HI}" stroke-width="0.8"/>
    <line x1="14" y1="32" x2="22" y2="32" stroke="{PAPER_HI}" stroke-width="0.8"/>
    <!-- Door -->
    <path d="M 28,46 V 32 Q 28,28 32,28 Q 36,28 36,32 V 46 Z" fill="{INK}"/>
  </symbol>

  <!-- Ornate compass rose -->
  <symbol id="compass" viewBox="0 0 200 200">
    <circle cx="100" cy="100" r="92" fill="none" stroke="{INK}" stroke-width="2"/>
    <circle cx="100" cy="100" r="80" fill="none" stroke="{INK}" stroke-width="0.8" stroke-dasharray="3 3"/>
    <circle cx="100" cy="100" r="60" fill="none" stroke="{INK}" stroke-width="0.8"/>
    <circle cx="100" cy="100" r="8" fill="{INK}"/>
    <!-- Tick marks around the outer ring, every 10 degrees -->
    {tick_marks()}
    <!-- 8-point star -->
    <polygon points="100,8 108,92 100,88 92,92" fill="{PAPER_HI}" stroke="{INK}" stroke-width="1.4"/>
    <polygon points="100,192 92,108 100,112 108,108" fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1.4"/>
    <polygon points="8,100 92,92 88,100 92,108" fill="{PAPER_HI}" stroke="{INK}" stroke-width="1.4"/>
    <polygon points="192,100 108,108 112,100 108,92" fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1.4"/>
    <!-- Diagonal points -->
    <polygon points="34,34 96,96 88,92 92,88" fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1"/>
    <polygon points="166,34 104,96 108,88 112,92" fill="{PAPER_HI}" stroke="{INK}" stroke-width="1"/>
    <polygon points="34,166 96,104 92,108 88,112" fill="{PAPER_HI}" stroke="{INK}" stroke-width="1"/>
    <polygon points="166,166 104,104 112,108 108,112" fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1"/>
    <!-- Cardinal text -->
    <text x="100" y="30"  text-anchor="middle" font-family="Georgia, serif" font-weight="bold"
          font-size="18" fill="{INK_DARK}">N</text>
    <text x="100" y="178" text-anchor="middle" font-family="Georgia, serif" font-weight="bold"
          font-size="18" fill="{INK_DARK}">S</text>
    <text x="24"  y="106" text-anchor="middle" font-family="Georgia, serif" font-weight="bold"
          font-size="18" fill="{INK_DARK}">W</text>
    <text x="176" y="106" text-anchor="middle" font-family="Georgia, serif" font-weight="bold"
          font-size="18" fill="{INK_DARK}">E</text>
    <!-- Decorative ring with a fleur-de-lis on N -->
    <path d="M 100,10 Q 96,0 100,-6 Q 104,0 100,10 Z"
          transform="translate(0,12)" fill="{INK_DARK}"/>
  </symbol>

  <!-- Sea-monster / fish flourish (decorative, for empty corners) -->
  <symbol id="seaMonster" viewBox="0 0 140 60">
    <path d="M 10,38 Q 30,10 65,22 Q 95,32 120,18 L 130,28 Q 110,40 85,36
             Q 55,32 30,48 Q 20,50 10,38 Z"
          fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1.5"/>
    <circle cx="112" cy="24" r="2.5" fill="{INK_DARK}"/>
    <path d="M 22,38 L 10,48 L 18,40 L 10,30 Z" fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1.2"/>
    <path d="M 70,30 q 2,-6 6,-4 M 82,26 q 3,-5 7,-2 M 58,32 q 2,-4 6,-2"
          stroke="{INK}" stroke-width="0.8" fill="none"/>
  </symbol>
"""


# ---------- scene elements (static map content) ----------
def mountains_layout():
    """Scattered mountain ranges across the map."""
    # (cx, cy, width) — height is derived from width*0.62
    clusters = [
        (560, 340, 260),    # upper-centre-left
        (780, 430, 320),    # upper-centre range
        (1080, 450, 220),   # upper-right
        (240, 600, 220),    # left lower ridge
        (540, 770, 240),    # centre-south
        (920, 760, 260),    # south-east range
        (1180, 710, 200),   # east
        (360, 900, 220),    # south-west (near Iwo)
    ]
    parts = []
    for cx, cy, w in clusters:
        h = w * 0.62
        parts.append(
            f'<use href="#mountain" x="{cx - w/2:.0f}" y="{cy - h/2:.0f}" '
            f'width="{w}" height="{h:.0f}"/>'
        )
    return "\n    ".join(parts)


def forest_layout():
    """Dense pine/fir clusters scattered across the map."""
    rnd = random.Random(91)
    # Several forest "patches" centred around (cx, cy) with ~count trees
    patches = [
        (180, 380, 10),
        (420, 520, 14),
        (660, 560, 16),
        (950, 560, 14),
        (1260, 420, 10),
        (300, 780, 12),
        (600, 880, 14),
        (840, 920, 12),
        (1080, 880, 14),
        (1340, 820, 10),
    ]
    out = []
    for cx, cy, n in patches:
        for _ in range(n):
            px = cx + rnd.uniform(-90, 90)
            py = cy + rnd.uniform(-55, 55)
            w = rnd.choice([24, 28, 32])
            h = int(w * 1.45)
            sym = rnd.choice(["pine", "pine2"])
            out.append(
                f'<use href="#{sym}" x="{px:.0f}" y="{py:.0f}" width="{w}" height="{h}"/>'
            )
    return "\n    ".join(out)


def castles_layout():
    """The four Polish castles, spread across the map corners.
    Olsztyn sits in the upper-right below the title cartouche so they
    don't collide."""
    castles = [
        (200,  220, "Zamek Ogrodzieniec"),
        (1320, 340, "Zamek Olsztyn"),
        (180,  830, "Zamek Mirów"),
        (1320, 840, "Zamek Bobolice"),
    ]
    parts = []
    for cx, cy, label in castles:
        parts.append(f"""
    <g transform="translate({cx - 70},{cy - 70})">
      <use href="#castle" width="140" height="140"/>
      <text x="70" y="160" text-anchor="middle" font-family="Georgia, serif" font-style="italic"
            font-size="22" fill="{INK_DARK}" font-weight="bold">{label}</text>
    </g>""")
    return "\n".join(parts)


# Short, map-friendly labels per cottage slug.
COTTAGE_LABELS = {
    "fredek":         "Fredek",
    "iwo":            "Iwo",
    "zamczysko":      "Góra Zamczysko",
    "teodor":         "Teodor",
    "tupak":          "Tupak",
    "elfka-z-duza-d": "Elfka",
    "pazurek":        "Pazurek",
    "halinka":        "Halinka",
    "gwerda-filinek": "Gwerda i Filinek",
    "straznik-zamku": "Strażnik Zamku",
    "dwaj-bracia":    "Dwaj Bracia",
    "czubata-myszka": "Czubata i Myszka",
    "zielonowlosy":   "Zielonowłosy",
    "zaprasza":       "Zaprasza",
    "samotny":        "Samotny Elf",
    "skalne-iglice":  "Skalne Iglice",
    "stary-elf":      "Stary Elf",
    "straznik-lodu":  "Strażnik Lodu",
}


def cottages_static_layout(cottages):
    """Render small house icons + slug labels at the authored mapX/mapY positions.
    Populates the #cottages-static group in the SVG (JS decorates #cottages-interactive
    on top with clickable markers)."""
    out = []
    for c in cottages:
        x, y = c["mapX"], c["mapY"]
        label = COTTAGE_LABELS.get(c["slug"], c["slug"])
        out.append(f"""
    <g data-slug="{c['slug']}" class="cottage-pin" transform="translate({x - 26},{y - 30})">
      <use href="#cottageHouse" width="52" height="56"/>
      <text x="26" y="78" text-anchor="middle" font-family="Georgia, serif" font-style="italic"
            font-weight="bold" font-size="20" fill="{INK_DARK}" class="cottage-label"
            paint-order="stroke" stroke="{PAPER_HI}" stroke-width="4" stroke-linejoin="round">{label}</text>
    </g>""")
    return "\n".join(out)


def main_path_d():
    """A winding dashed path (ink trail) that threads through the map."""
    return ("M 280,360 "
            "C 360,360 440,520 540,560 "
            "S 720,580 820,560 "
            "S 1000,580 1120,620 "
            "S 1240,720 1180,820 "
            "S 960,900 780,870 "
            "S 560,880 460,820")


def generate(debug=False):
    rnd = random.Random(7)
    outer_d = torn_rect_path(rnd, OUTER_MARGIN, amp=18, seg=38)
    cottages = load_cottages()
    stains = rand_stains(rnd, n=20)
    stain_svg = "\n    ".join(
        f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{rx:.0f}" ry="{ry:.0f}" '
        f'transform="rotate({rot:.0f} {cx:.0f} {cy:.0f})" fill="{INK}" opacity="{opac:.2f}"/>'
        for (cx, cy, rx, ry, rot, opac) in stains
    )

    # Inner frame rectangle sizes
    fx0, fy0 = FRAME_MARGIN, FRAME_MARGIN
    fx1, fy1 = VW - FRAME_MARGIN, VH - FRAME_MARGIN

    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}" preserveAspectRatio="xMidYMid meet"
     role="img" aria-labelledby="mapTitle mapDesc">
  <title id="mapTitle">Baśniowa mapa-skarbów Chatynkowa</title>
  <desc id="mapDesc">Pergaminowa mapa w stylu piracko-baśniowym. Na karcie naszkicowano góry, lasy,
  cztery zamki (Ogrodzieniec, Olsztyn, Bobolice, Mirów), różę wiatrów oraz osiemnaście chatynek Elfów
  rozmieszczonych po całym pergaminie.</desc>

  <defs>
    <!-- Aged parchment fill (warm centre → burnt tan at edges) -->
    <radialGradient id="parchmentFill" cx="50%" cy="50%" r="70%">
      <stop offset="0%"   stop-color="{PAPER_HI}"/>
      <stop offset="55%"  stop-color="{PAPER_MID}"/>
      <stop offset="88%"  stop-color="{PAPER_LOW}"/>
      <stop offset="100%" stop-color="{INK_SOFT}"/>
    </radialGradient>

    <!-- Inner edge burnt vignette -->
    <radialGradient id="innerBurn" cx="50%" cy="50%" r="65%">
      <stop offset="60%"  stop-color="#000" stop-opacity="0"/>
      <stop offset="90%"  stop-color="{INK_DARK}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="{INK_DARK}" stop-opacity="0.75"/>
    </radialGradient>

    <filter id="paperGrain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11"/>
      <feColorMatrix values="0 0 0 0 0.44
                             0 0 0 0 0.30
                             0 0 0 0 0.12
                             0 0 0 0.22 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>

    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dx="1" dy="2"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.38"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    <filter id="mapDrop" x="-5%" y="-5%" width="110%" height="115%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="8"/>
      <feOffset dx="0" dy="14"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    <clipPath id="paperClip"><path d="{outer_d}"/></clipPath>

    {SYMBOLS}
  </defs>

  <!-- ============== Parchment frame ============== -->
  <path d="{outer_d}" fill="{INK_DARK}" opacity="0.35"
        transform="translate(6 10)" pointer-events="none"/>
  <path d="{outer_d}" fill="url(#parchmentFill)" filter="url(#mapDrop)"/>
  <path d="{outer_d}" fill="{PAPER_LOW}" opacity="0.28" filter="url(#paperGrain)" pointer-events="none"/>

  <!-- Stains on the paper -->
  <g clip-path="url(#paperClip)" pointer-events="none">
    {stain_svg}
  </g>

  <!-- Double-ruled inner border -->
  <rect x="{fx0}" y="{fy0}" width="{fx1 - fx0}" height="{fy1 - fy0}"
        fill="none" stroke="{INK}" stroke-width="3"/>
  <rect x="{fx0 + 14}" y="{fy0 + 14}" width="{fx1 - fx0 - 28}" height="{fy1 - fy0 - 28}"
        fill="none" stroke="{INK}" stroke-width="0.8" stroke-dasharray="4 3"/>

  <!-- Corner flourishes -->
  {corner_flourish(fx0 + 16, fy0 + 16, +1, +1)}
  {corner_flourish(fx1 - 16, fy0 + 16, -1, +1)}
  {corner_flourish(fx0 + 16, fy1 - 16, +1, -1)}
  {corner_flourish(fx1 - 16, fy1 - 16, -1, -1)}

  <!-- ============== Map content ============== -->
  <!-- Mountains (rear) -->
  <g id="mountains">
    {mountains_layout()}
  </g>

  <!-- Pine/fir forest clusters (in front of mountains) -->
  <g id="forest" opacity="0.92">
    {forest_layout()}
  </g>

  <!-- Sea-monster flourish, for empty space (upper-left) -->
  <use href="#seaMonster" x="210" y="430" width="150" height="60"/>
  <!-- and a smaller fish decoration bottom-right -->
  <use href="#seaMonster" x="1100" y="1000" width="120" height="50" transform="scale(-1 1) translate(-1220 0)"/>

  <!-- Castles -->
  <g id="castles">
    {castles_layout()}
  </g>

  <!-- Main winding trail (dashed red — treasure-map style) -->
  <g id="paths" fill="none" stroke="{ACCENT_RED}" stroke-width="4.5"
     stroke-linecap="round" stroke-dasharray="10 6" opacity="0.85">
    <path d="{main_path_d()}"/>
  </g>
  <!-- Sub-branch paths from JS -->
  <g id="branches" fill="none" stroke="{ACCENT_RED}" stroke-width="3"
     stroke-linecap="round" stroke-dasharray="7 5" opacity="0.8"></g>

  <!-- Static cottage icons + labels drawn right into the SVG so the layout is
       identical across all viewers, including the cairosvg preview. -->
  <g id="cottages-static">
    {cottages_static_layout(cottages)}
  </g>

  <!-- Interactive hit layer populated by main.js (transparent overlay that
       receives hover/click; the visible cottage icon is in cottages-static). -->
  <g id="cottages"></g>

  <!-- Compass rose (bottom-left, like classic treasure maps) -->
  <g transform="translate(200,930)" filter="url(#softShadow)">
    <use href="#compass" width="170" height="170"/>
  </g>

  <!-- Title cartouche (top-right) -->
  <g transform="translate(960,140)" filter="url(#softShadow)">
    <path d="M 0,0 H 440 Q 480,0 488,30 L 500,70 Q 508,100 476,108 H 12 Q -20,100 -12,70 L 0,30 Q 8,0 40,0"
          fill="{PAPER_HI}" stroke="{INK}" stroke-width="2.2"/>
    <path d="M 14,16 H 474 Q 486,30 490,60 L 480,90 H 20 L 10,60 Q 14,30 14,16 Z"
          fill="none" stroke="{INK}" stroke-width="0.8" stroke-dasharray="3 3"/>
    <text x="250" y="58" text-anchor="middle" font-family="Georgia, serif"
          font-size="42" font-weight="bold" font-style="italic" fill="{INK_DARK}">Chatynkowo</text>
    <text x="250" y="90" text-anchor="middle" font-family="Georgia, serif"
          font-size="17" font-style="italic" fill="{INK_MED}">~ mapa ukrytych chatynek Elfów ~</text>
  </g>

  <!-- Inner burnt vignette on top of everything (subtle), clipped to paper -->
  <path d="{outer_d}" fill="url(#innerBurn)" pointer-events="none" opacity="0.85"/>
</svg>
"""
    OUT.write_text(svg)
    print(f"Wrote {OUT} ({len(svg)} bytes)")


if __name__ == "__main__":
    generate()
