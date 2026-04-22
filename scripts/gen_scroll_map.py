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
  <!-- Rolling-hills / low mountain range in vintage-map ink style:
       soft rounded bumps with parallel shading hatch-marks on the right flank
       and small foothill tick-marks at the base. Not sharp, not numerous. -->
  <symbol id="mountain" viewBox="0 0 220 80">
    <!-- Main undulating silhouette (4–5 rounded humps) -->
    <path d="M 6,70
             C 16,56 26,34 42,36
             C 54,20 70,18 86,34
             C 98,22 116,22 132,36
             C 146,26 162,30 178,44
             C 190,54 200,64 214,70 Z"
          fill="{PAPER_MID}" fill-opacity="0.35"
          stroke="{INK}" stroke-width="2.2" stroke-linejoin="round"/>
    <!-- Behind-contour suggestion of a further range -->
    <path d="M 30,52 C 46,42 58,36 70,42 C 82,36 94,32 108,40
             M 120,44 C 134,36 150,36 164,46 C 176,44 188,50 204,58"
          fill="none" stroke="{INK}" stroke-width="1" opacity="0.65"/>
    <!-- Right-flank slope hatching, applied to each bump -->
    <g stroke="{INK}" stroke-width="0.9" fill="none" opacity="0.75">
      <line x1="46" y1="40"  x2="38" y2="54"/>
      <line x1="50" y1="44"  x2="42" y2="58"/>
      <line x1="54" y1="50"  x2="46" y2="62"/>
      <line x1="92" y1="36"  x2="82" y2="52"/>
      <line x1="96" y1="42"  x2="86" y2="56"/>
      <line x1="100" y1="48" x2="90" y2="62"/>
      <line x1="138" y1="40" x2="128" y2="54"/>
      <line x1="142" y1="46" x2="132" y2="60"/>
      <line x1="184" y1="50" x2="174" y2="62"/>
      <line x1="188" y1="56" x2="178" y2="66"/>
    </g>
    <!-- Small foothill / rock tick-marks along the base -->
    <g stroke="{INK}" stroke-width="1" fill="none" stroke-linecap="round">
      <path d="M 22,67 l 3,-4 l 3,4"/>
      <path d="M 60,65 l 2.5,-3 l 2.5,3"/>
      <path d="M 104,63 l 2.5,-3 l 2.5,3"/>
      <path d="M 150,65 l 2.5,-3 l 2.5,3"/>
      <path d="M 190,68 l 2.5,-3 l 2.5,3"/>
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

  <!-- Medieval stone castle, drawn as an ink contour:
         * tall cylindrical (round) keep with battlements,
         * attached lower stone wall,
         * conical roof on a smaller flanking turret,
         * Polish flag on a pole flying from the keep's top (white top, red bottom),
         * the stonework is suggested by a brick-pattern hatch. -->
  <symbol id="castle" viewBox="0 0 160 170">
    <!-- Rocky outcrop base (soft contour) -->
    <path d="M 4,160 Q 40,148 80,154 T 156,156 L 156,168 L 4,168 Z"
          fill="none" stroke="{INK}" stroke-width="1.6"/>
    <g stroke="{INK}" stroke-width="0.7" fill="none" opacity="0.7">
      <path d="M 12,162 l 3,-4 l 3,4"/>
      <path d="M 60,158 l 3,-4 l 3,4"/>
      <path d="M 100,158 l 3,-4 l 3,4"/>
      <path d="M 140,160 l 3,-4 l 3,4"/>
    </g>

    <!-- Attached curtain wall (right side, lower) -->
    <rect x="88" y="104" width="62" height="52" fill="{PAPER_HI}"
          stroke="{INK}" stroke-width="2"/>
    <!-- Wall crenellations -->
    <path d="M 88,104 V 96 H 94 V 104 M 100,104 V 96 H 106 V 104
             M 112,104 V 96 H 118 V 104 M 124,104 V 96 H 130 V 104
             M 136,104 V 96 H 142 V 104 M 148,104 V 96 H 150 V 104"
          fill="none" stroke="{INK}" stroke-width="1.8"/>
    <!-- Small corner turret on the far right -->
    <rect x="140" y="78" width="14" height="26" fill="{PAPER_HI}"
          stroke="{INK}" stroke-width="1.8"/>
    <polygon points="138,78 147,64 156,78" fill="{PAPER_MID}"
             stroke="{INK}" stroke-width="1.6"/>
    <!-- Wall gate -->
    <path d="M 110,156 V 132 Q 110,120 118,120 Q 126,120 126,132 V 156 Z"
          fill="{INK}"/>
    <!-- Wall slit windows -->
    <rect x="96" y="120" width="3" height="10" fill="{INK}"/>
    <rect x="136" y="120" width="3" height="10" fill="{INK}"/>

    <!-- Main round keep: cylindrical body shown side-on -->
    <!-- body (tall rectangle; "roundness" hinted by vertical shading arcs) -->
    <rect x="30" y="52" width="52" height="104" fill="{PAPER_HI}"
          stroke="{INK}" stroke-width="2.2"/>
    <!-- Left & right curvature shading arcs (to read as cylinder) -->
    <path d="M 30,56 Q 36,100 30,154" fill="none"
          stroke="{INK}" stroke-width="1" opacity="0.55"/>
    <path d="M 82,56 Q 76,100 82,154" fill="none"
          stroke="{INK}" stroke-width="1" opacity="0.55"/>
    <!-- Keep crenellations -->
    <path d="M 30,52 V 42 H 36 V 52 M 42,52 V 42 H 48 V 52
             M 54,52 V 42 H 60 V 52 M 66,52 V 42 H 72 V 52
             M 78,52 V 42 H 82 V 52"
          fill="none" stroke="{INK}" stroke-width="2"/>
    <!-- Arched keep door -->
    <path d="M 48,156 V 130 Q 48,118 56,118 Q 64,118 64,130 V 156 Z"
          fill="{INK}"/>
    <!-- Arched window on the keep -->
    <path d="M 52,92 V 76 Q 52,70 56,70 Q 60,70 60,76 V 92 Z"
          fill="{INK}"/>
    <!-- Slit windows -->
    <rect x="38" y="100" width="3" height="10" fill="{INK}"/>
    <rect x="71" y="100" width="3" height="10" fill="{INK}"/>

    <!-- Flag pole + Polish flag (white top, red bottom) -->
    <line x1="56" y1="42" x2="56" y2="14" stroke="{INK_DARK}" stroke-width="2"/>
    <rect x="56" y="14" width="26" height="7"
          fill="#ffffff" stroke="{INK}" stroke-width="0.9"/>
    <rect x="56" y="21" width="26" height="7"
          fill="#d4202a" stroke="{INK}" stroke-width="0.9"/>

    <!-- Stone-masonry pattern on keep (brick courses, offset per row) -->
    <g stroke="{INK}" stroke-width="0.6" opacity="0.55" fill="none">
      <!-- horizontal courses -->
      <line x1="30" y1="64"  x2="82" y2="64"/>
      <line x1="30" y1="76"  x2="82" y2="76"/>
      <line x1="30" y1="88"  x2="82" y2="88"/>
      <line x1="30" y1="100" x2="82" y2="100"/>
      <line x1="30" y1="112" x2="82" y2="112"/>
      <line x1="30" y1="124" x2="82" y2="124"/>
      <line x1="30" y1="136" x2="82" y2="136"/>
      <line x1="30" y1="148" x2="82" y2="148"/>
      <!-- row 1 verticals -->
      <line x1="43" y1="52" x2="43" y2="64"/>
      <line x1="56" y1="52" x2="56" y2="64"/>
      <line x1="69" y1="52" x2="69" y2="64"/>
      <!-- row 2 (offset) -->
      <line x1="36" y1="64" x2="36" y2="76"/>
      <line x1="49" y1="64" x2="49" y2="76"/>
      <line x1="62" y1="64" x2="62" y2="76"/>
      <line x1="75" y1="64" x2="75" y2="76"/>
      <!-- row 3 -->
      <line x1="43" y1="76" x2="43" y2="88"/>
      <line x1="56" y1="76" x2="56" y2="88"/>
      <line x1="69" y1="76" x2="69" y2="88"/>
      <!-- row 4 -->
      <line x1="36" y1="88" x2="36" y2="100"/>
      <line x1="49" y1="88" x2="49" y2="100"/>
      <line x1="62" y1="88" x2="62" y2="100"/>
      <line x1="75" y1="88" x2="75" y2="100"/>
      <!-- row 5 -->
      <line x1="43" y1="100" x2="43" y2="112"/>
      <line x1="69" y1="100" x2="69" y2="112"/>
      <!-- row 6 -->
      <line x1="36" y1="112" x2="36" y2="124"/>
      <line x1="49" y1="112" x2="49" y2="124"/>
      <line x1="62" y1="112" x2="62" y2="124"/>
      <line x1="75" y1="112" x2="75" y2="124"/>
      <!-- row 7 (around door) -->
      <line x1="43" y1="124" x2="43" y2="136"/>
      <line x1="69" y1="124" x2="69" y2="136"/>
      <!-- row 8 -->
      <line x1="36" y1="136" x2="36" y2="148"/>
      <line x1="75" y1="136" x2="75" y2="148"/>
    </g>

    <!-- Stone-masonry pattern on curtain wall -->
    <g stroke="{INK}" stroke-width="0.5" opacity="0.5" fill="none">
      <line x1="88" y1="116" x2="150" y2="116"/>
      <line x1="88" y1="128" x2="150" y2="128"/>
      <line x1="88" y1="140" x2="150" y2="140"/>
      <line x1="88" y1="152" x2="150" y2="152"/>
      <line x1="98" y1="104" x2="98" y2="116"/>
      <line x1="114" y1="104" x2="114" y2="116"/>
      <line x1="134" y1="104" x2="134" y2="116"/>
      <line x1="94" y1="116" x2="94" y2="128"/>
      <line x1="106" y1="116" x2="106" y2="128"/>
      <line x1="140" y1="116" x2="140" y2="128"/>
      <line x1="100" y1="128" x2="100" y2="140"/>
      <line x1="132" y1="128" x2="132" y2="140"/>
      <line x1="144" y1="128" x2="144" y2="140"/>
      <line x1="94" y1="140" x2="94" y2="152"/>
      <line x1="106" y1="140" x2="106" y2="152"/>
      <line x1="140" y1="140" x2="140" y2="152"/>
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
    """A handful of rolling ridges spread across the paper.
    Intentionally sparse and wide — treasure-map style, not a tall mountain range."""
    # (cx, cy, width) — mountain symbol is 220×80, so height = width * 80/220
    clusters = [
        (720,  470, 420),   # main central ridge (horizontal band)
        (1100, 610, 340),   # mid-right ridge
        (400,  700, 300),   # mid-left lower range
        (860,  820, 360),   # southern ridge
    ]
    parts = []
    for cx, cy, w in clusters:
        h = w * 80 / 220
        parts.append(
            f'<use href="#mountain" x="{cx - w/2:.0f}" y="{cy - h/2:.0f}" '
            f'width="{w}" height="{h:.0f}"/>'
        )
    return "\n    ".join(parts)


def forest_layout():
    """A handful of small pine/fir clusters between the mountains and cottages.
    Kept sparse so the cottage houses and castles remain readable."""
    rnd = random.Random(91)
    # (cx, cy, count) — gentle clusters
    patches = [
        (420, 340, 5),   # NW
        (640, 340, 6),   # N (between Ogrodzieniec and Olsztyn)
        (1180, 470, 6),  # mid-right
        (320, 540, 5),   # mid-left
        (470, 780, 6),   # S-centre-left
        (920, 680, 5),   # mid-SE
        (1240, 760, 5),  # SE
        (700, 960, 5),   # bottom
    ]
    out = []
    for cx, cy, n in patches:
        for _ in range(n):
            px = cx + rnd.uniform(-70, 70)
            py = cy + rnd.uniform(-38, 38)
            w = rnd.choice([26, 30, 34])
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
    W, H = 150, 160   # display width/height of each castle (aspect ≈160:170)
    castles = [
        (220,  240, "Zamek Ogrodzieniec"),
        (1320, 360, "Zamek Olsztyn"),
        (220,  830, "Zamek Mirów"),
        (1320, 830, "Zamek Bobolice"),
    ]
    parts = []
    for cx, cy, label in castles:
        parts.append(f"""
    <g transform="translate({cx - W/2:.0f},{cy - H/2:.0f})">
      <use href="#castle" width="{W}" height="{H}"/>
      <text x="{W/2:.0f}" y="{H + 20:.0f}" text-anchor="middle"
            font-family="Georgia, serif" font-style="italic" font-weight="bold"
            font-size="22" fill="{INK_DARK}"
            paint-order="stroke" stroke="{PAPER_HI}" stroke-width="4" stroke-linejoin="round">{label}</text>
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

  <!-- Sea-monster flourish tucked under the title cartouche on the right -->
  <use href="#seaMonster" x="1250" y="470" width="140" height="56"/>

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
