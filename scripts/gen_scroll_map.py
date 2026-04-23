#!/usr/bin/env python3
"""Generate assets/map/forest-map.svg — a vintage parchment scroll with a
winding trail threading through a dense forest, with all 18 cottages plotted
ALONG that trail (not scattered by lat/lng). Two stone castles on rocky
outcrops, a compass with Latin cardinals, Latin title banner at the top, and
an in-map legend — intentionally matching the reference.

Re-runnable:  python3 scripts/gen_scroll_map.py

Side-effect: the script also rewrites the mapX/mapY fields of each cottage in
data/cottages.json (every other field is preserved), so main.js and the SVG
stay in lock-step — one source of truth = the path spec in this file.
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT  = ROOT / "assets/map/forest-map.svg"
COTTAGES_JSON = ROOT / "data/cottages.json"

VW, VH = 1600, 1200

# ---------- scroll geometry ----------
LEFT_ROLL_CX  = 110
RIGHT_ROLL_CX = 1490
ROLL_RX       = 50
ROLL_CAP_RX   = 60
ROLL_CAP_RY   = 18
BODY_TOP_Y    = 95
BODY_BOTTOM_Y = 1105
BODY_LEFT_X   = LEFT_ROLL_CX - 10
BODY_RIGHT_X  = RIGHT_ROLL_CX + 10
ROLL_TOP_Y    = BODY_TOP_Y - 26
ROLL_BOTTOM_Y = BODY_BOTTOM_Y + 26

# Inner (visible) content area — between the rolls and with a small parchment margin
INNER_X0 = LEFT_ROLL_CX + ROLL_CAP_RX + 10      # ~ 180
INNER_X1 = RIGHT_ROLL_CX - ROLL_CAP_RX - 10     # ~ 1420
INNER_Y0 = BODY_TOP_Y + 20                      # ~ 115
INNER_Y1 = BODY_BOTTOM_Y - 20                   # ~ 1085

# ---------- palette ----------
INK_DARK   = "#2a1806"
INK        = "#4a2d10"
INK_MED    = "#6b4218"
INK_SOFT   = "#8a5a2b"
PAPER_HI   = "#f1d9a1"
PAPER_MID  = "#deba77"
PAPER_LOW  = "#b28548"
PAPER_DARK = "#8a5a2b"
ACCENT_RED = "#c72a28"
ROAD_EDGE  = "#7d4e1c"
ROAD_FILL  = "#d8ad66"
FOREST_G1  = "#3a5a2c"
FOREST_G2  = "#294a1f"
RIVER      = "#5d8fb0"


# =====================================================================
# Winding trail: composed of cubic Bezier segments. Cottages are plotted
# EVENLY along its combined arc length.
# =====================================================================
PATH_SEGMENTS = [
    # Each entry is (P0, C1, C2, P3) — cubic Bezier
    ((250, 260), (340, 220), (430, 220), (520, 300)),      # enters top-left, curves right
    ((520, 300), (610, 380), (640, 460), (560, 520)),      # first loop down
    ((560, 520), (470, 580), (350, 540), (280, 480)),      # turns back left
    ((280, 480), (220, 420), (220, 560), (280, 640)),      # small down-loop on the left
    ((280, 640), (340, 720), (440, 760), (560, 740)),      # swings right along the middle
    ((560, 740), (680, 720), (760, 620), (860, 620)),      # rises centre-right
    ((860, 620), (960, 620), (1040, 700), (1100, 800)),    # down into second loop
    ((1100, 800), (1180, 900), (1320, 880), (1360, 760)),  # right loop
    ((1360, 760), (1400, 640), (1280, 540), (1160, 520)),  # up-left
    ((1160, 520), (1040, 500), (940, 440), (820, 440)),    # ends centre-top-ish
]


def bezier_point(p0, c1, c2, p3, t):
    u = 1 - t
    x = u**3 * p0[0] + 3 * u**2 * t * c1[0] + 3 * u * t**2 * c2[0] + t**3 * p3[0]
    y = u**3 * p0[1] + 3 * u**2 * t * c1[1] + 3 * u * t**2 * c2[1] + t**3 * p3[1]
    return (x, y)


def bezier_length(p0, c1, c2, p3, samples=32):
    prev = p0
    length = 0.0
    for i in range(1, samples + 1):
        t = i / samples
        curr = bezier_point(p0, c1, c2, p3, t)
        length += math.hypot(curr[0] - prev[0], curr[1] - prev[1])
        prev = curr
    return length


def sample_path_evenly(segments, n):
    """Return n points evenly spaced along the combined arc length."""
    lengths = [bezier_length(*s) for s in segments]
    cum = [0.0]
    for L in lengths:
        cum.append(cum[-1] + L)
    total = cum[-1]
    out = []
    for i in range(n):
        # Skip the very first/last few percent so cottages don't sit on the
        # entry/exit of the path.
        target = (0.04 + 0.92 * i / (n - 1)) * total
        # Find segment
        for j in range(len(segments)):
            if cum[j] <= target <= cum[j + 1] + 1e-6:
                # Find local t by linear interpolation along this segment
                Lj = lengths[j] if lengths[j] > 0 else 1
                # Re-sample segment for better precision
                prev_pt = segments[j][0]
                acc = cum[j]
                local_t_final = None
                pt_final = prev_pt
                for k in range(1, 41):
                    t = k / 40
                    pt = bezier_point(*segments[j], t)
                    seg_d = math.hypot(pt[0] - prev_pt[0], pt[1] - prev_pt[1])
                    if acc + seg_d >= target:
                        frac = (target - acc) / seg_d if seg_d > 0 else 0
                        pt_final = (
                            prev_pt[0] + (pt[0] - prev_pt[0]) * frac,
                            prev_pt[1] + (pt[1] - prev_pt[1]) * frac,
                        )
                        break
                    acc += seg_d
                    prev_pt = pt
                out.append(pt_final)
                break
    return out


def path_d_attr(segments):
    p0 = segments[0][0]
    parts = [f"M{p0[0]:.1f},{p0[1]:.1f}"]
    for _, c1, c2, p3 in segments:
        parts.append(f"C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p3[0]:.1f},{p3[1]:.1f}")
    return " ".join(parts)


def densely_sampled_path(segments, per_segment=60):
    pts = []
    for seg in segments:
        for i in range(per_segment + 1):
            pts.append(bezier_point(*seg, i / per_segment))
    return pts


# =====================================================================
# Forest placement — scatter trees avoiding the path corridor & castles
# =====================================================================
def place_forest(rnd, path_pts, castles, cottage_pts, exclusion_rects, *,
                 count=360, min_path_dist=52, min_castle_dist=140,
                 min_cottage_dist=58, min_tree_dist=22):
    """Scatter tree positions across the map, avoiding:
      * a corridor around the winding path,
      * the castle rocks,
      * the cottage icons (so trees don't cover them),
      * user-supplied exclusion rectangles (compass, legend, title, etc.).
    """
    trees = []
    attempts = 0
    path_sq = min_path_dist ** 2
    castle_sq = min_castle_dist ** 2
    cottage_sq = min_cottage_dist ** 2
    tree_sq = min_tree_dist ** 2

    def in_exclusion(x, y):
        for x0, y0, x1, y1 in exclusion_rects:
            if x0 <= x <= x1 and y0 <= y <= y1:
                return True
        return False

    while len(trees) < count and attempts < 20000:
        attempts += 1
        x = rnd.uniform(INNER_X0 + 10, INNER_X1 - 10)
        y = rnd.uniform(INNER_Y0 + 60, INNER_Y1 - 60)
        if in_exclusion(x, y):
            continue
        if any((x - px) ** 2 + (y - py) ** 2 < path_sq for px, py in path_pts):
            continue
        if any((x - cx) ** 2 + (y - cy) ** 2 < castle_sq for cx, cy, *_ in castles):
            continue
        if any((x - cx) ** 2 + (y - cy) ** 2 < cottage_sq for cx, cy in cottage_pts):
            continue
        if any((x - tx) ** 2 + (y - ty) ** 2 < tree_sq for tx, ty in trees):
            continue
        trees.append((x, y))
    return trees


# =====================================================================
# Scroll frame (torn paper + rolled cylindrical ends with coil caps)
# =====================================================================
def wavy_edge(x1, x2, y, direction, *, rnd, segments=30, amp=14):
    pts = [(x1, y)]
    for i in range(1, segments):
        t = i / segments
        x = x1 + (x2 - x1) * t + rnd.uniform(-6, 6)
        dy = direction * rnd.uniform(0.3, 1.0) * amp
        pts.append((x, y + dy))
    pts.append((x2, y))
    out = []
    for i in range(1, len(pts)):
        xp, yp = pts[i - 1]
        xc, yc = pts[i]
        mx = (xp + xc) / 2 + rnd.uniform(-3, 3)
        my = (yp + yc) / 2 + direction * rnd.uniform(4, 12)
        out.append(f"Q{mx:.1f},{my:.1f} {xc:.1f},{yc:.1f}")
    return out


def build_body_path(rnd):
    top = wavy_edge(BODY_LEFT_X, BODY_RIGHT_X, BODY_TOP_Y, -1, rnd=rnd)
    bot = wavy_edge(BODY_RIGHT_X, BODY_LEFT_X, BODY_BOTTOM_Y, +1, rnd=rnd)
    return (
        f"M{BODY_LEFT_X},{BODY_TOP_Y} "
        + " ".join(top)
        + f" L{BODY_RIGHT_X},{BODY_BOTTOM_Y} "
        + " ".join(bot)
        + f" L{BODY_LEFT_X},{BODY_TOP_Y} Z"
    )


def render_roll(cx, label):
    """Vertical cylindrical roll centred at x=cx with coiled caps."""
    def coil(cy):
        return f"""
    <ellipse cx="{cx}" cy="{cy}" rx="{ROLL_CAP_RX}" ry="{ROLL_CAP_RY}"
             fill="url(#rollCapGrad)" stroke="#2a1806" stroke-width="1.4"/>
    <path d="M{cx - ROLL_CAP_RX + 4},{cy - 2}
             Q{cx},{cy - ROLL_CAP_RY + 1} {cx + ROLL_CAP_RX - 4},{cy - 2}"
          fill="none" stroke="#f2d699" stroke-width="1.2" opacity="0.55"/>
    <ellipse cx="{cx}" cy="{cy}" rx="{ROLL_CAP_RX - 6}" ry="{ROLL_CAP_RY - 3}"
             fill="none" stroke="#6b4218" stroke-width="1.4"/>
    <ellipse cx="{cx + 1}" cy="{cy + 0.5}" rx="{ROLL_CAP_RX - 14}" ry="{ROLL_CAP_RY - 6}"
             fill="#d4a36c" stroke="#3a2308" stroke-width="1"/>
    <ellipse cx="{cx + 1.5}" cy="{cy + 0.5}" rx="{ROLL_CAP_RX - 20}" ry="{ROLL_CAP_RY - 9}"
             fill="none" stroke="#6b4218" stroke-width="1"/>
    <ellipse cx="{cx + 2}" cy="{cy + 1}" rx="{ROLL_CAP_RX - 26}" ry="{ROLL_CAP_RY - 11}"
             fill="#c48a3e" stroke="#3a2308" stroke-width="0.9"/>
    <ellipse cx="{cx + 3}" cy="{cy + 1.5}" rx="{max(3, ROLL_CAP_RX - 40)}" ry="{max(2, ROLL_CAP_RY - 14)}"
             fill="#1a0e04" stroke="#3a2308" stroke-width="0.6"/>"""
    x0 = cx - ROLL_RX
    body_h = ROLL_BOTTOM_Y - ROLL_TOP_Y
    lines = []
    y = ROLL_TOP_Y + 10
    while y < ROLL_BOTTOM_Y - 10:
        lines.append(
            f'<line x1="{x0 + 4}" y1="{y:.1f}" x2="{x0 + ROLL_RX * 2 - 4}" y2="{y:.1f}" '
            f'stroke="#2a1806" stroke-opacity="0.28" stroke-width="0.8"/>'
        )
        y += 14
    wrap = "\n    ".join(lines)
    return f"""
  <g class="scroll-roll" aria-hidden="true">
    <ellipse cx="{cx}" cy="{ROLL_BOTTOM_Y + 30}" rx="{ROLL_CAP_RX + 6}" ry="10"
             fill="#000" opacity="0.4"/>
    <rect x="{x0}" y="{ROLL_TOP_Y}" width="{ROLL_RX * 2}" height="{body_h}"
          fill="url(#rollBodyGrad)" stroke="#2a1806" stroke-width="1"/>
    {wrap}
    <rect x="{x0}" y="{ROLL_TOP_Y}" width="14" height="{body_h}"
          fill="url(#rollEdgeShadeL)" opacity="0.95"/>
    <rect x="{x0 + ROLL_RX * 2 - 14}" y="{ROLL_TOP_Y}" width="14" height="{body_h}"
          fill="url(#rollEdgeShadeR)" opacity="0.95"/>
    {coil(ROLL_TOP_Y)}{coil(ROLL_BOTTOM_Y)}
  </g>"""


# =====================================================================
# SYMBOLS — ink-drawn map glyphs
# =====================================================================
def tick_marks():
    cx = cy = 100
    r_in, r_out = 86, 92
    parts = []
    for deg in range(0, 360, 10):
        rad = math.radians(deg - 90)
        x1 = cx + r_in * math.cos(rad)
        y1 = cy + r_in * math.sin(rad)
        x2 = cx + r_out * math.cos(rad)
        y2 = cy + r_out * math.sin(rad)
        parts.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{INK}" stroke-width="{1.4 if deg % 90 == 0 else 0.8}"/>'
        )
    return "\n      ".join(parts)


SYMBOLS = f"""
  <!-- Tall pine / fir — ink silhouette with faint inner hatching -->
  <symbol id="pine" viewBox="0 0 30 42">
    <polygon points="15,3 4,18 11,18 3,30 12,30 2,40 28,40 18,30 27,30 19,18 26,18"
             fill="{FOREST_G1}" stroke="{INK_DARK}" stroke-width="1"/>
    <path d="M 15,6 L 15,40" stroke="{INK_DARK}" stroke-width="0.4" opacity="0.55"/>
    <rect x="14" y="40" width="2" height="2" fill="{INK_DARK}"/>
  </symbol>

  <!-- Stocky fir (variety) -->
  <symbol id="pine2" viewBox="0 0 30 40">
    <polygon points="15,2 3,26 12,26 5,38 25,38 18,26 27,26"
             fill="{FOREST_G2}" stroke="{INK_DARK}" stroke-width="1"/>
    <path d="M 15,4 L 15,38" stroke="{INK_DARK}" stroke-width="0.4" opacity="0.55"/>
    <rect x="14" y="38" width="2" height="2" fill="{INK_DARK}"/>
  </symbol>

  <!-- Deciduous tree (oak / beech) — round canopy with hatched shading -->
  <symbol id="oak" viewBox="0 0 34 40">
    <ellipse cx="17" cy="16" rx="14" ry="13" fill="#3d5e24" stroke="{INK_DARK}" stroke-width="1.2"/>
    <path d="M 7,14 Q 17,6 27,14 Q 22,10 17,10 Q 12,10 7,14 Z"
          fill="#2b4618" opacity="0.6"/>
    <g stroke="{INK_DARK}" stroke-width="0.5" opacity="0.55" fill="none">
      <path d="M 20,10 Q 23,14 22,20"/>
      <path d="M 25,14 Q 26,20 24,24"/>
      <path d="M 12,12 Q 10,18 12,22"/>
    </g>
    <rect x="15" y="28" width="4" height="10" fill="{INK_DARK}"/>
  </symbol>

  <!-- Dead / snag tree — bare branches, adds atmosphere -->
  <symbol id="snag" viewBox="0 0 26 40">
    <g stroke="{INK_DARK}" stroke-width="1.4" fill="none" stroke-linecap="round">
      <path d="M 13,38 L 13,8"/>
      <path d="M 13,20 L 5,12"/>
      <path d="M 13,18 L 22,10"/>
      <path d="M 13,24 L 7,20"/>
      <path d="M 13,14 L 4,6"/>
      <path d="M 13,12 L 20,5"/>
      <path d="M 13,26 L 19,21"/>
    </g>
  </symbol>

  <!-- Jurassic limestone rock pillar ("Skała Wapienna") — tall narrow white
       outcrop with vertical striations, characteristic of the Jura region. -->
  <symbol id="rockPillar" viewBox="0 0 30 70">
    <path d="M 6,68 L 6,30 Q 6,10 12,8 Q 18,6 22,16 Q 26,22 24,38 L 24,68 Z"
          fill="#ece2c0" stroke="{INK_DARK}" stroke-width="1.4"/>
    <g stroke="{INK_DARK}" stroke-width="0.7" opacity="0.7" fill="none">
      <path d="M 9,30 L 9,64"/>
      <path d="M 13,16 L 13,64"/>
      <path d="M 17,14 L 17,64"/>
      <path d="M 21,22 L 21,64"/>
      <path d="M 8,46 L 22,46"/>
      <path d="M 8,56 L 22,56"/>
    </g>
    <!-- Shadow on right side -->
    <path d="M 20,24 L 24,40 L 24,68 L 20,68 Z"
          fill="{INK}" opacity="0.15"/>
  </symbol>

  <!-- Cluster of 3 limestone pillars (iconic Jura landmark) -->
  <symbol id="rockCluster" viewBox="0 0 90 80">
    <path d="M 14,76 L 14,40 Q 14,22 22,20 Q 30,18 34,30 Q 36,36 34,48 L 34,76 Z"
          fill="#ece2c0" stroke="{INK_DARK}" stroke-width="1.4"/>
    <path d="M 36,78 L 36,24 Q 36,6 46,4 Q 58,2 62,18 Q 66,30 64,44 L 64,78 Z"
          fill="#ece2c0" stroke="{INK_DARK}" stroke-width="1.4"/>
    <path d="M 62,78 L 62,46 Q 62,32 70,30 Q 80,28 82,42 L 82,78 Z"
          fill="#ece2c0" stroke="{INK_DARK}" stroke-width="1.4"/>
    <g stroke="{INK_DARK}" stroke-width="0.7" opacity="0.65" fill="none">
      <path d="M 18,40 L 18,72"/>
      <path d="M 24,26 L 24,72"/>
      <path d="M 30,30 L 30,72"/>
      <path d="M 42,20 L 42,72"/>
      <path d="M 48,10 L 48,72"/>
      <path d="M 54,12 L 54,72"/>
      <path d="M 60,20 L 60,72"/>
      <path d="M 68,36 L 68,72"/>
      <path d="M 74,34 L 74,72"/>
      <path d="M 78,40 L 78,72"/>
      <path d="M 16,54 L 34,54"/>
      <path d="M 38,56 L 64,56"/>
      <path d="M 62,58 L 82,58"/>
    </g>
    <path d="M 30,24 L 34,36 L 34,76 L 30,76 Z
             M 58,18 L 64,36 L 64,76 L 58,76 Z
             M 76,34 L 82,48 L 82,76 L 76,76 Z"
          fill="{INK}" opacity="0.14"/>
  </symbol>

  <!-- Medieval sea-dragon ("HIC SUNT DRACONES") for empty space -->
  <symbol id="dragon" viewBox="0 0 200 120">
    <!-- Body: sinuous serpent curve -->
    <path d="M 10,90 Q 30,40 70,60 Q 105,78 140,50 Q 170,30 190,40
             Q 180,60 160,62 Q 135,66 115,80 Q 85,98 55,90 Q 30,84 10,90 Z"
          fill="{INK_MED}" stroke="{INK_DARK}" stroke-width="1.6"/>
    <!-- Spines on back -->
    <g stroke="{INK_DARK}" stroke-width="1.2" fill="{INK_SOFT}">
      <path d="M 40,62 L 44,52 L 48,62 Z"/>
      <path d="M 58,56 L 62,44 L 66,56 Z"/>
      <path d="M 82,54 L 86,42 L 90,54 Z"/>
      <path d="M 110,60 L 114,48 L 118,60 Z"/>
      <path d="M 138,52 L 142,40 L 146,52 Z"/>
    </g>
    <!-- Head details -->
    <path d="M 180,40 Q 196,34 200,42 L 196,48 L 188,46 Z"
          fill="{INK_MED}" stroke="{INK_DARK}" stroke-width="1.4"/>
    <circle cx="188" cy="44" r="1.5" fill="{PAPER_HI}"/>
    <!-- Wing -->
    <path d="M 90,58 Q 100,30 130,32 Q 120,42 110,48 Q 100,52 90,58 Z"
          fill="{INK}" stroke="{INK_DARK}" stroke-width="1.2" opacity="0.8"/>
    <path d="M 92,56 L 100,36 M 100,56 L 110,40 M 108,54 L 120,38"
          stroke="{INK_DARK}" stroke-width="0.7" opacity="0.9" fill="none"/>
    <!-- Tail spikes -->
    <path d="M 10,90 L 2,94 L 10,96 Z" fill="{INK_MED}" stroke="{INK_DARK}" stroke-width="1.2"/>
    <!-- Belly scales hint -->
    <g stroke="{INK_DARK}" stroke-width="0.5" opacity="0.55" fill="none">
      <path d="M 30,86 q 4,-6 8,0 q 4,6 8,0 q 4,-6 8,0 q 4,6 8,0 q 4,-6 8,0"/>
    </g>
  </symbol>

  <!-- Small village / hamlet (cluster of simple ink houses) -->
  <symbol id="hamlet" viewBox="0 0 100 50">
    <!-- House 1 -->
    <polygon points="8,28 18,16 28,28" fill="{ACCENT_RED}" stroke="{INK_DARK}" stroke-width="1.2"/>
    <rect x="10" y="28" width="16" height="14" fill="{PAPER_HI}" stroke="{INK_DARK}" stroke-width="1.2"/>
    <rect x="16" y="34" width="4" height="8" fill="{INK_DARK}"/>
    <!-- House 2 -->
    <polygon points="34,24 48,10 62,24" fill="{ACCENT_RED}" stroke="{INK_DARK}" stroke-width="1.2"/>
    <rect x="36" y="24" width="24" height="18" fill="{PAPER_HI}" stroke="{INK_DARK}" stroke-width="1.2"/>
    <rect x="46" y="32" width="6" height="10" fill="{INK_DARK}"/>
    <rect x="39" y="28" width="4" height="4" fill="{INK_DARK}"/>
    <rect x="53" y="28" width="4" height="4" fill="{INK_DARK}"/>
    <!-- House 3 -->
    <polygon points="68,30 78,20 88,30" fill="{ACCENT_RED}" stroke="{INK_DARK}" stroke-width="1.2"/>
    <rect x="70" y="30" width="16" height="12" fill="{PAPER_HI}" stroke="{INK_DARK}" stroke-width="1.2"/>
    <rect x="76" y="34" width="4" height="8" fill="{INK_DARK}"/>
  </symbol>

  <!-- Cottage icon (used everywhere the cottages sit on the path) -->
  <symbol id="cottageHouse" viewBox="0 0 48 52">
    <!-- Smoke curl -->
    <path d="M 34,10 q -4,-6 2,-10 q 6,-3 0,-10"
          fill="none" stroke="{INK}" stroke-width="1.3" stroke-linecap="round" opacity="0.7"/>
    <!-- Chimney -->
    <rect x="32" y="10" width="6" height="12" fill="{INK}"/>
    <!-- Roof -->
    <polygon points="4,24 24,5 44,24" fill="{ACCENT_RED}" stroke="{INK_DARK}" stroke-width="1.6"/>
    <!-- Roof tiles hint -->
    <path d="M8,22 L20,11 M15,22 L27,10 M22,22 L33,10 M29,22 L40,11"
          stroke="{INK_DARK}" stroke-width="0.6" opacity="0.55"/>
    <!-- Walls -->
    <rect x="9" y="24" width="30" height="23" fill="{PAPER_HI}" stroke="{INK_DARK}" stroke-width="1.6"/>
    <!-- Timber cross beams -->
    <path d="M9,24 L39,47 M39,24 L9,47" stroke="{INK_DARK}" stroke-width="0.7" opacity="0.45"/>
    <!-- Window -->
    <rect x="13" y="28" width="9" height="9" fill="{INK_DARK}"/>
    <line x1="17.5" y1="28" x2="17.5" y2="37" stroke="{PAPER_HI}" stroke-width="0.8"/>
    <line x1="13" y1="32.5" x2="22" y2="32.5" stroke="{PAPER_HI}" stroke-width="0.8"/>
    <!-- Door -->
    <path d="M 28,47 V 32 Q 28,28 32,28 Q 36,28 36,32 V 47 Z" fill="{INK_DARK}"/>
  </symbol>

  <!-- Ornate compass rose with Latin cardinal letters -->
  <symbol id="compass" viewBox="0 0 200 200">
    <circle cx="100" cy="100" r="92" fill="none" stroke="{INK}" stroke-width="2"/>
    <circle cx="100" cy="100" r="80" fill="none" stroke="{INK}" stroke-width="0.8" stroke-dasharray="3 3"/>
    <circle cx="100" cy="100" r="60" fill="none" stroke="{INK}" stroke-width="0.8"/>
    <circle cx="100" cy="100" r="8" fill="{INK}"/>
    {tick_marks()}
    <polygon points="100,8 108,92 100,88 92,92" fill="{PAPER_HI}" stroke="{INK}" stroke-width="1.4"/>
    <polygon points="100,192 92,108 100,112 108,108" fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1.4"/>
    <polygon points="8,100 92,92 88,100 92,108" fill="{PAPER_HI}" stroke="{INK}" stroke-width="1.4"/>
    <polygon points="192,100 108,108 112,100 108,92" fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1.4"/>
    <polygon points="34,34 96,96 88,92 92,88" fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1"/>
    <polygon points="166,34 104,96 108,88 112,92" fill="{PAPER_HI}" stroke="{INK}" stroke-width="1"/>
    <polygon points="34,166 96,104 92,108 88,112" fill="{PAPER_HI}" stroke="{INK}" stroke-width="1"/>
    <polygon points="166,166 104,104 112,108 108,112" fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1"/>
    <!-- Latin cardinals -->
    <text x="100" y="26"  text-anchor="middle" font-family="Georgia, serif" font-weight="bold"
          font-size="15" fill="{INK_DARK}">SEPTENTRIO</text>
    <text x="100" y="183" text-anchor="middle" font-family="Georgia, serif" font-weight="bold"
          font-size="15" fill="{INK_DARK}">MERIDIES</text>
    <text x="24"  y="104" text-anchor="middle" font-family="Georgia, serif" font-weight="bold"
          font-size="12" fill="{INK_DARK}">OCCIDENS</text>
    <text x="176" y="104" text-anchor="middle" font-family="Georgia, serif" font-weight="bold"
          font-size="14" fill="{INK_DARK}">ORIENS</text>
  </symbol>

  <!-- Limestone rock outcrop (Skała Wapienna) -->
  <symbol id="rockOutcrop" viewBox="0 0 80 60">
    <path d="M 4,56 L 12,30 L 22,40 L 30,18 L 40,34 L 50,20 L 60,36 L 70,24 L 76,56 Z"
          fill="{PAPER_HI}" stroke="{INK}" stroke-width="1.5"/>
    <g stroke="{INK}" stroke-width="0.6" opacity="0.7" fill="none">
      <line x1="14" y1="38" x2="10" y2="48"/>
      <line x1="18" y1="42" x2="14" y2="52"/>
      <line x1="32" y1="28" x2="28" y2="40"/>
      <line x1="42" y1="38" x2="38" y2="50"/>
      <line x1="52" y1="28" x2="48" y2="42"/>
      <line x1="62" y1="40" x2="58" y2="52"/>
      <line x1="71" y1="32" x2="68" y2="44"/>
    </g>
  </symbol>

  <!-- River ink line (for tracing a river by <path> directly — this symbol
       is unused; rivers are drawn inline.) -->

  <!-- Stone medieval castle: cylindrical keep + curtain wall + Polish flag -->
  <symbol id="castle" viewBox="0 0 170 200">
    <!-- Rocky outcrop -->
    <path d="M 0,200 L 8,168 L 22,180 L 30,155 L 46,170 L 60,150 L 78,168
             L 96,140 L 112,162 L 130,150 L 148,172 L 160,155 L 170,180 L 170,200 Z"
          fill="{PAPER_HI}" stroke="{INK}" stroke-width="1.6"/>
    <g stroke="{INK}" stroke-width="0.7" opacity="0.7" fill="none">
      <line x1="10" y1="178" x2="6" y2="190"/>
      <line x1="34" y1="168" x2="28" y2="182"/>
      <line x1="60" y1="158" x2="54" y2="176"/>
      <line x1="88" y1="156" x2="82" y2="174"/>
      <line x1="114" y1="170" x2="108" y2="186"/>
      <line x1="142" y1="168" x2="136" y2="186"/>
    </g>

    <!-- Curtain wall -->
    <rect x="92" y="116" width="68" height="44" fill="{PAPER_HI}"
          stroke="{INK}" stroke-width="2"/>
    <path d="M 92,116 V 108 H 99 V 116 M 106,116 V 108 H 113 V 116
             M 120,116 V 108 H 127 V 116 M 134,116 V 108 H 141 V 116
             M 148,116 V 108 H 155 V 116 M 158,116 V 108 H 160 V 116"
          fill="none" stroke="{INK}" stroke-width="1.8"/>
    <rect x="148" y="88" width="16" height="28" fill="{PAPER_HI}"
          stroke="{INK}" stroke-width="1.8"/>
    <polygon points="146,88 156,72 166,88" fill="{INK_MED}"
             stroke="{INK}" stroke-width="1.4"/>
    <path d="M 116,160 V 138 Q 116,128 124,128 Q 132,128 132,138 V 160 Z"
          fill="{INK}"/>
    <rect x="100" y="128" width="4" height="10" fill="{INK}"/>
    <rect x="142" y="130" width="4" height="10" fill="{INK}"/>

    <!-- Round keep -->
    <rect x="30" y="48" width="56" height="112" fill="{PAPER_HI}"
          stroke="{INK}" stroke-width="2.2"/>
    <path d="M 30,52 Q 36,104 30,156" fill="none" stroke="{INK}" stroke-width="1" opacity="0.55"/>
    <path d="M 86,52 Q 80,104 86,156" fill="none" stroke="{INK}" stroke-width="1" opacity="0.55"/>
    <path d="M 30,48 V 38 H 37 V 48 M 44,48 V 38 H 51 V 48
             M 58,48 V 38 H 65 V 48 M 72,48 V 38 H 79 V 48
             M 84,48 V 38 H 86 V 48"
          fill="none" stroke="{INK}" stroke-width="2"/>
    <path d="M 50,160 V 132 Q 50,120 58,120 Q 66,120 66,132 V 160 Z"
          fill="{INK}"/>
    <path d="M 54,94 V 76 Q 54,68 58,68 Q 62,68 62,76 V 94 Z"
          fill="{INK}"/>
    <rect x="38" y="104" width="4" height="10" fill="{INK}"/>
    <rect x="74" y="104" width="4" height="10" fill="{INK}"/>

    <!-- Flag pole + Polish flag (white top, red bottom) -->
    <line x1="58" y1="38" x2="58" y2="6" stroke="{INK_DARK}" stroke-width="2"/>
    <rect x="58" y="6" width="30" height="9"
          fill="#ffffff" stroke="{INK}" stroke-width="1"/>
    <rect x="58" y="15" width="30" height="9"
          fill="#d4202a" stroke="{INK}" stroke-width="1"/>

    <!-- Brick masonry on keep -->
    <g stroke="{INK}" stroke-width="0.6" opacity="0.5" fill="none">
      <line x1="30" y1="60" x2="86" y2="60"/>
      <line x1="30" y1="72" x2="86" y2="72"/>
      <line x1="30" y1="84" x2="86" y2="84"/>
      <line x1="30" y1="96" x2="86" y2="96"/>
      <line x1="30" y1="108" x2="86" y2="108"/>
      <line x1="30" y1="120" x2="86" y2="120"/>
      <line x1="30" y1="132" x2="86" y2="132"/>
      <line x1="30" y1="144" x2="86" y2="144"/>
      <line x1="44" y1="48" x2="44" y2="60"/>
      <line x1="58" y1="48" x2="58" y2="60"/>
      <line x1="72" y1="48" x2="72" y2="60"/>
      <line x1="38" y1="60" x2="38" y2="72"/>
      <line x1="52" y1="60" x2="52" y2="72"/>
      <line x1="65" y1="60" x2="65" y2="72"/>
      <line x1="78" y1="60" x2="78" y2="72"/>
      <line x1="44" y1="72" x2="44" y2="84"/>
      <line x1="58" y1="72" x2="58" y2="84"/>
      <line x1="72" y1="72" x2="72" y2="84"/>
      <line x1="38" y1="84" x2="38" y2="96"/>
      <line x1="52" y1="84" x2="52" y2="96"/>
      <line x1="65" y1="84" x2="65" y2="96"/>
      <line x1="78" y1="84" x2="78" y2="96"/>
      <line x1="44" y1="96" x2="44" y2="108"/>
      <line x1="72" y1="96" x2="72" y2="108"/>
      <line x1="38" y1="108" x2="38" y2="120"/>
      <line x1="52" y1="108" x2="52" y2="120"/>
      <line x1="65" y1="108" x2="65" y2="120"/>
      <line x1="78" y1="108" x2="78" y2="120"/>
      <line x1="44" y1="120" x2="44" y2="132"/>
      <line x1="72" y1="120" x2="72" y2="132"/>
      <line x1="38" y1="132" x2="38" y2="144"/>
      <line x1="78" y1="132" x2="78" y2="144"/>
    </g>
    <g stroke="{INK}" stroke-width="0.5" opacity="0.45" fill="none">
      <line x1="92" y1="128" x2="160" y2="128"/>
      <line x1="92" y1="140" x2="160" y2="140"/>
      <line x1="92" y1="152" x2="160" y2="152"/>
      <line x1="106" y1="116" x2="106" y2="128"/>
      <line x1="122" y1="116" x2="122" y2="128"/>
      <line x1="140" y1="116" x2="140" y2="128"/>
      <line x1="112" y1="128" x2="112" y2="140"/>
      <line x1="134" y1="128" x2="134" y2="140"/>
      <line x1="150" y1="128" x2="150" y2="140"/>
      <line x1="100" y1="140" x2="100" y2="152"/>
      <line x1="120" y1="140" x2="120" y2="152"/>
      <line x1="140" y1="140" x2="140" y2="152"/>
    </g>
  </symbol>
"""


# =====================================================================
# Layout helpers
# =====================================================================
CASTLES = [
    # (cx_top_of_rock, cy_top_of_rock, label, subtitle)
    (220,  420, "Rabsztyn",  "castrum Rabsztyn"),
    (1200, 220, "Olsztyn",   "castrum Olsztyn"),
]


def castles_layout():
    W, H = 160, 190
    parts = []
    for cx, cy, label, sub in CASTLES:
        parts.append(f"""
    <g class="castle" transform="translate({cx - W/2:.0f},{cy - H/2:.0f})">
      <use href="#castle" width="{W}" height="{H}"/>
      <text x="{W/2:.0f}" y="{H + 24:.0f}" text-anchor="middle"
            font-family="Cinzel Decorative, Georgia, serif" font-weight="900"
            font-size="22" fill="{INK_DARK}" letter-spacing="3"
            paint-order="stroke" stroke="{PAPER_HI}" stroke-width="4" stroke-linejoin="round">{label.upper()}</text>
      <text x="{W/2:.0f}" y="{H + 44:.0f}" text-anchor="middle"
            font-family="Georgia, serif" font-style="italic"
            font-size="14" fill="{INK_MED}"
            paint-order="stroke" stroke="{PAPER_HI}" stroke-width="3" stroke-linejoin="round">{sub}</text>
    </g>""")
    return "\n".join(parts)


def forest_svg(trees, rnd):
    """Mix of conifers, oaks and occasional dead snags for medieval variety."""
    out = []
    for x, y in trees:
        w = rnd.choice([22, 24, 26, 28, 30, 32])
        h = int(w * 1.45)
        # 70% conifers, 25% deciduous oaks, 5% snags
        r = rnd.random()
        if r < 0.45:
            sym, aspect = "pine", 1.45
        elif r < 0.70:
            sym, aspect = "pine2", 1.33
        elif r < 0.95:
            sym, aspect = "oak",  1.18
        else:
            sym, aspect = "snag", 1.54
        h = int(w * aspect)
        out.append(
            f'<use href="#{sym}" x="{x - w/2:.0f}" y="{y - h/2:.0f}" width="{w}" height="{h}"/>'
        )
    return "\n    ".join(out)


def rocks_layout(rnd):
    """Iconic Jura limestone pillar clusters scattered across the paper —
    tall narrow white outcrops with vertical striations, characteristic
    of the Kraków-Częstochowa Upland."""
    # (cx, cy, variant)  variant: 'cluster' = three pillars, 'pillar' = one
    rocks = [
        (680,  250, "cluster"),   # north forest
        (1080, 390, "cluster"),   # east of path
        (320,  780, "cluster"),   # south-west
        (830,  990, "cluster"),   # bottom centre
        (1250, 960, "pillar"),    # bottom right accent
        (490,  410, "pillar"),    # upper path edge
    ]
    out = []
    for cx, cy, variant in rocks:
        if variant == "cluster":
            w = rnd.randint(170, 210)
            h = int(w * 0.88)
            out.append(
                f'<use href="#rockCluster" x="{cx - w/2}" y="{cy - h/2}" '
                f'width="{w}" height="{h}"/>'
            )
        else:
            w = rnd.randint(50, 70)
            h = int(w * 2.3)
            out.append(
                f'<use href="#rockPillar" x="{cx - w/2}" y="{cy - h/2}" '
                f'width="{w}" height="{h}"/>'
            )
    return "\n    ".join(out)


RIVER_PATHS = [
    # River 1 — Biała Przemsza, flowing south-ish on the left
    "M 180,140 C 210,220 190,320 220,400 S 240,560 200,660 S 240,860 210,1080",
    # River 2 — secondary, on the right
    "M 1260,90 C 1240,180 1300,280 1280,370 S 1240,520 1280,640 S 1260,780 1300,900",
]


def rivers_svg():
    out = []
    for d in RIVER_PATHS:
        out.append(f'<path d="{d}" fill="none" stroke="{INK_MED}" stroke-width="7" stroke-linecap="round" opacity="0.5"/>')
        out.append(f'<path d="{d}" fill="none" stroke="{RIVER}"  stroke-width="4" stroke-linecap="round" opacity="0.85"/>')
    return "\n    ".join(out)


# --- Cottage labels (short, map-friendly) ---
COTTAGE_LABELS = {
    "straznik-lodu":  "Strażnik Lodu",
    "zielonowlosy":   "Zielonowłosy",
    "czubata-myszka": "Czubata i Myszka",
    "gwerda-filinek": "Gwerda i Filinek",
    "teodor":         "Teodor",
    "elfka-z-duza-d": "Elfka",
    "straznik-zamku": "Strażnik Zamku",
    "zamczysko":      "Góra Zamczysko",
    "halinka":        "Halinka",
    "pazurek":        "Pazurek",
    "zaprasza":       "Zaprasza",
    "samotny":        "Samotny Elf",
    "fredek":         "Fredek",
    "skalne-iglice":  "Skalne Iglice",
    "dwaj-bracia":    "Dwaj Bracia",
    "stary-elf":      "Stary Elf",
    "tupak":          "Tupak",
    "iwo":            "Iwo",
}


def cottages_static_layout(cottages):
    out = []
    for c in cottages:
        x, y = c["mapX"], c["mapY"]
        label = COTTAGE_LABELS.get(c["slug"], c["slug"])
        # Alternate label above/below the house to reduce collisions with path
        above = (hash(c["slug"]) & 1) == 1
        ty = -14 if above else 68
        out.append(f"""
    <g data-slug="{c['slug']}" class="cottage-pin" transform="translate({x - 24:.0f},{y - 30:.0f})">
      <use href="#cottageHouse" width="48" height="52"/>
      <text x="24" y="{ty}" text-anchor="middle"
            font-family="Georgia, serif" font-style="italic" font-weight="bold"
            font-size="17" fill="{INK_DARK}" class="cottage-label"
            paint-order="stroke" stroke="{PAPER_HI}" stroke-width="4" stroke-linejoin="round">{label}</text>
    </g>""")
    return "\n".join(out)


def vine_border(x0, y0, x1, y1):
    """A repeating vine-and-rosette motif laid between the two border rules."""
    parts = []
    step = 46
    # Horizontal vine along top & bottom
    for x in range(x0 + 24, x1 - 24, step):
        parts.append(
            f'<path d="M {x},{y0 + 10} q 10,-6 20,0 q 10,6 20,0" '
            f'fill="none" stroke="{INK}" stroke-width="1.2" opacity="0.85"/>'
            f'<circle cx="{x + 20}" cy="{y0 + 10}" r="1.8" fill="{INK}"/>'
        )
        parts.append(
            f'<path d="M {x},{y1 - 10} q 10,6 20,0 q 10,-6 20,0" '
            f'fill="none" stroke="{INK}" stroke-width="1.2" opacity="0.85"/>'
            f'<circle cx="{x + 20}" cy="{y1 - 10}" r="1.8" fill="{INK}"/>'
        )
    # Vertical vine along left & right
    for y in range(y0 + 24, y1 - 24, step):
        parts.append(
            f'<path d="M {x0 + 10},{y} q -6,10 0,20 q 6,10 0,20" '
            f'fill="none" stroke="{INK}" stroke-width="1.2" opacity="0.85"/>'
            f'<circle cx="{x0 + 10}" cy="{y + 20}" r="1.8" fill="{INK}"/>'
        )
        parts.append(
            f'<path d="M {x1 - 10},{y} q 6,10 0,20 q -6,10 0,20" '
            f'fill="none" stroke="{INK}" stroke-width="1.2" opacity="0.85"/>'
            f'<circle cx="{x1 - 10}" cy="{y + 20}" r="1.8" fill="{INK}"/>'
        )
    return "\n  ".join(parts)


def fleur_corners(x0, y0, x1, y1):
    """Fleur-de-lis ornaments in each inner-border corner."""
    def fleur(cx, cy, flip_x=False, flip_y=False):
        sx = -1 if flip_x else 1
        sy = -1 if flip_y else 1
        # A simple medieval fleur-de-lis (stylized)
        return f"""
    <g transform="translate({cx},{cy}) scale({sx} {sy})">
      <path d="M 0,0 L 0,18 M -10,6 Q -14,18 0,22 Q 14,18 10,6 M -10,6 Q -6,-4 0,-2 Q 6,-4 10,6"
            fill="none" stroke="{INK}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M -4,-6 Q -2,-12 0,-12 Q 2,-12 4,-6 Z" fill="{INK}"/>
      <rect x="-12" y="18" width="24" height="3" fill="{INK}"/>
    </g>"""
    return (
        fleur(x0 + 34, y0 + 34)
        + fleur(x1 - 34, y0 + 34, flip_x=True)
        + fleur(x0 + 34, y1 - 34, flip_y=True)
        + fleur(x1 - 34, y1 - 34, flip_x=True, flip_y=True)
    )


def rand_stains(rnd, n=22):
    out = []
    for _ in range(n):
        cx = rnd.uniform(INNER_X0 + 20, INNER_X1 - 20)
        cy = rnd.uniform(INNER_Y0 + 30, INNER_Y1 - 30)
        rx = rnd.uniform(20, 70)
        ry = rnd.uniform(10, 32)
        rot = rnd.uniform(0, 180)
        opac = rnd.uniform(0.06, 0.15)
        out.append((cx, cy, rx, ry, rot, opac))
    return out


# =====================================================================
# Main
# =====================================================================
def generate():
    rnd = random.Random(7)
    cottages = json.loads(COTTAGES_JSON.read_text())

    # Sample 18 positions along the path (evenly spaced by arc length)
    positions = sample_path_evenly(PATH_SEGMENTS, len(cottages))
    # Apply a deterministic slug ordering so a given cottage always lands in
    # the same spot, independent of list order in cottages.json.
    ordered = sorted(cottages, key=lambda c: c["slug"])
    for c, (x, y) in zip(ordered, positions):
        c["mapX"] = round(x, 1)
        c["mapY"] = round(y, 1)
    # Write back (preserve input list order in the JSON file)
    by_slug = {c["slug"]: c for c in ordered}
    cottages_out = [by_slug[c["slug"]] for c in cottages]
    COTTAGES_JSON.write_text(
        json.dumps(cottages_out, indent=2, ensure_ascii=False) + "\n"
    )

    # For distance tests (forest placement)
    path_pts_dense = densely_sampled_path(PATH_SEGMENTS, per_segment=40)
    castles_xy = [(c[0], c[1]) for c in CASTLES]
    cottage_pts = [(c["mapX"], c["mapY"]) for c in cottages_out]

    # Rectangles where trees MUST NOT grow
    title_cx = (INNER_X0 + INNER_X1) / 2
    exclusion_rects = [
        # Title banner
        (title_cx - 560, INNER_Y0 - 10, title_cx + 560, INNER_Y0 + 76),
        # In-map legend (bottom-left)
        (INNER_X0 + 20, INNER_Y1 - 180, INNER_X0 + 290, INNER_Y1 - 20),
        # Compass rose (bottom-right)
        (INNER_X1 - 200, INNER_Y1 - 210, INNER_X1 - 10, INNER_Y1 - 10),
        # VIA TORTA IURAE label
        (900, 820, 1150, 890),
        # SILVA IURAE label
        (640, 310, 920, 370),
        # Klucze village
        (410, 170, 560, 290),
        # Olkusz village
        (550, 900, 720, 1040),
        # Dragon & HIC SVNT DRACONES
        (820, 920, 1030, 1080),
        # River-1 label column (left)
        (140, 130, 200, 780),
        # River-2 label column (right)
        (1290, 80, 1360, 920),
        # Limestone rock cluster areas (keep trees away from bright outcrops)
        (580, 190, 790, 330),
        (990, 320, 1200, 470),
        (220, 720, 430, 870),
    ]

    trees = place_forest(rnd, path_pts_dense, castles_xy, cottage_pts,
                         exclusion_rects, count=320)

    # Inline path d for drawing the winding road
    path_d = path_d_attr(PATH_SEGMENTS)

    # Stains
    stains = rand_stains(rnd)
    stain_svg = "\n    ".join(
        f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{rx:.0f}" ry="{ry:.0f}" '
        f'transform="rotate({rot:.0f} {cx:.0f} {cy:.0f})" fill="{INK}" opacity="{opac:.2f}"/>'
        for (cx, cy, rx, ry, rot, opac) in stains
    )

    # Body shape with wavy edges
    body_d = build_body_path(random.Random(33))

    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}" preserveAspectRatio="xMidYMid meet"
     role="img" aria-labelledby="mapTitle mapDesc">
  <title id="mapTitle">Terrae Regio Iurae – baśniowa mapa Chatynkowa</title>
  <desc id="mapDesc">Pergaminowy zwój z krętą ścieżką przez las, wzdłuż której rozmieszczone są chatynki Elfów.</desc>

  <defs>
    <!-- Parchment fill (warm cream centre → burnt edges) -->
    <radialGradient id="parchmentFill" cx="50%" cy="50%" r="65%">
      <stop offset="0%"  stop-color="{PAPER_HI}"/>
      <stop offset="55%" stop-color="{PAPER_MID}"/>
      <stop offset="88%" stop-color="{PAPER_LOW}"/>
      <stop offset="100%" stop-color="{INK_SOFT}"/>
    </radialGradient>

    <!-- Roll gradients -->
    <linearGradient id="rollBodyGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#3a2308"/>
      <stop offset="20%"  stop-color="#7a4f1f"/>
      <stop offset="45%"  stop-color="#d4a55b"/>
      <stop offset="55%"  stop-color="#e6c98b"/>
      <stop offset="78%"  stop-color="#9c6a28"/>
      <stop offset="100%" stop-color="#2b1a0a"/>
    </linearGradient>
    <linearGradient id="rollEdgeShadeL" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#1f1206" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#1f1206" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="rollEdgeShadeR" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#1f1206" stop-opacity="0"/>
      <stop offset="100%" stop-color="#1f1206" stop-opacity="0.85"/>
    </linearGradient>
    <radialGradient id="rollCapGrad" cx="45%" cy="45%" r="60%">
      <stop offset="0%"   stop-color="#e8c789"/>
      <stop offset="60%"  stop-color="#a07136"/>
      <stop offset="100%" stop-color="#3a2308"/>
    </radialGradient>

    <!-- Fibrous paper grain -->
    <filter id="paperGrain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11"/>
      <feColorMatrix values="0 0 0 0 0.44
                             0 0 0 0 0.30
                             0 0 0 0 0.12
                             0 0 0 0.18 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>

    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dx="1" dy="2"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.38"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    <filter id="mapDrop" x="-5%" y="-5%" width="110%" height="115%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>
      <feOffset dx="0" dy="18"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    <clipPath id="paperClip"><path d="{body_d}"/></clipPath>

    {SYMBOLS}
  </defs>

  <!-- ========= Parchment frame with rolls ========= -->
  <path d="{body_d}" fill="url(#parchmentFill)" filter="url(#mapDrop)"/>
  <path d="{body_d}" fill="{PAPER_LOW}" opacity="0.25" filter="url(#paperGrain)" pointer-events="none"/>

  <!-- Stains -->
  <g clip-path="url(#paperClip)" pointer-events="none">
    {stain_svg}
  </g>

  <!-- Ornate double-ruled inner border with vine motif between the two lines -->
  <rect x="{INNER_X0}" y="{INNER_Y0}" width="{INNER_X1 - INNER_X0}" height="{INNER_Y1 - INNER_Y0}"
        fill="none" stroke="{INK}" stroke-width="3"/>
  <rect x="{INNER_X0 + 20}" y="{INNER_Y0 + 20}" width="{INNER_X1 - INNER_X0 - 40}" height="{INNER_Y1 - INNER_Y0 - 40}"
        fill="none" stroke="{INK}" stroke-width="1.2"/>
  {vine_border(INNER_X0, INNER_Y0, INNER_X1, INNER_Y1)}

  <!-- Fleur-de-lis corner flourishes on the inner border -->
  {fleur_corners(INNER_X0, INNER_Y0, INNER_X1, INNER_Y1)}

  <!-- Medieval title banner with ribbon scroll — Latin anno-domini -->
  <g transform="translate({(INNER_X0 + INNER_X1) / 2:.0f},{INNER_Y0 + 36})">
    <!-- Ribbon tails behind the banner -->
    <path d="M -540,-6 L -500,-24 L -500,6 Z" fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1.4"/>
    <path d="M -520,18 L -500,6 L -520,-6 Z" fill="{INK_MED}" stroke="{INK}" stroke-width="1.2" opacity="0.7"/>
    <path d="M  540,-6 L  500,-24 L  500,6 Z" fill="{PAPER_LOW}" stroke="{INK}" stroke-width="1.4"/>
    <path d="M  520,18 L  500,6 L  520,-6 Z" fill="{INK_MED}" stroke="{INK}" stroke-width="1.2" opacity="0.7"/>
    <!-- Banner body -->
    <path d="M -500,-24 Q -510,0 -500,20 L 500,20 Q 510,0 500,-24 Z"
          fill="{PAPER_HI}" stroke="{INK}" stroke-width="2.2"/>
    <path d="M -488,-14 Q -494,0 -488,12 L 488,12 Q 494,0 488,-14 Z"
          fill="none" stroke="{INK}" stroke-width="0.7" stroke-dasharray="3 3"/>
    <!-- Decorative rosettes on each end -->
    <g stroke="{INK}" stroke-width="1" fill="{PAPER_MID}">
      <circle cx="-480" cy="-2" r="6"/>
      <circle cx="-480" cy="-2" r="2" fill="{INK}"/>
      <circle cx="480"  cy="-2" r="6"/>
      <circle cx="480"  cy="-2" r="2" fill="{INK}"/>
    </g>
    <text x="0" y="6" text-anchor="middle"
          font-family="Cinzel Decorative, Georgia, serif" font-weight="900"
          font-size="22" fill="{INK_DARK}" letter-spacing="2">
      TERRAE·REGIO·IURAE·KRAKOWIENSI-CZESTOCHOWIENSI · ANNO·DOMINI·MMXXVI
    </text>
  </g>

  <!-- ========= Map content ========= -->

  <!-- Rivers -->
  <g id="rivers" pointer-events="none">
    {rivers_svg()}
  </g>

  <!-- Rocky outcrops (limestone) -->
  <g id="rocks">
    {rocks_layout(random.Random(13))}
  </g>

  <!-- Castles -->
  <g id="castles">
    {castles_layout()}
  </g>

  <!-- The winding trail — drawn as a broad dirt road in three strokes -->
  <g id="road" fill="none" stroke-linecap="round">
    <path d="{path_d}" stroke="{ROAD_EDGE}" stroke-width="30" opacity="0.85"/>
    <path d="{path_d}" stroke="{ROAD_FILL}" stroke-width="22"/>
    <path d="{path_d}" stroke="{INK}"       stroke-width="1.5" stroke-dasharray="7 7" opacity="0.55"/>
  </g>

  <!-- "VIA TORTA IURAE" label along the bottom-right curve (Cinzel caps) -->
  <g transform="translate(1020,860) rotate(8)">
    <text text-anchor="middle"
          font-family="Cinzel Decorative, Georgia, serif" font-weight="900"
          font-size="24" fill="{INK_DARK}" letter-spacing="4"
          paint-order="stroke" stroke="{PAPER_HI}" stroke-width="4" stroke-linejoin="round">VIA·TORTA·IURAE</text>
  </g>

  <!-- Dense forest scattered around the road -->
  <g id="forest">
    {forest_svg(trees, rnd)}
  </g>

  <!-- "SILVA IURAE" label tucked in the top-centre forest, Cinzel caps -->
  <g transform="translate(780,340)">
    <text text-anchor="middle"
          font-family="Cinzel Decorative, Georgia, serif" font-weight="900"
          font-size="26" fill="{INK_DARK}" letter-spacing="6"
          paint-order="stroke" stroke="{PAPER_HI}" stroke-width="4" stroke-linejoin="round">SILVA · IURAE</text>
  </g>

  <!-- River labels (running beside each stream) -->
  <g>
    <text transform="translate(160,360) rotate(88)"
          font-family="Georgia, serif" font-style="italic" font-size="16" fill="{RIVER}"
          paint-order="stroke" stroke="{PAPER_HI}" stroke-width="3" stroke-linejoin="round">
      Biała Przemsza
    </text>
    <text transform="translate(1318,480) rotate(85)"
          font-family="Georgia, serif" font-style="italic" font-size="14" fill="{RIVER}"
          paint-order="stroke" stroke="{PAPER_HI}" stroke-width="3" stroke-linejoin="round">
      Flumen Iurae
    </text>
  </g>

  <!-- Small village of Klucze (with label) -->
  <g transform="translate(430,180)">
    <use href="#hamlet" width="120" height="60"/>
    <text x="60" y="78" text-anchor="middle"
          font-family="Cinzel Decorative, Georgia, serif" font-weight="900"
          font-size="18" fill="{INK_DARK}" letter-spacing="2"
          paint-order="stroke" stroke="{PAPER_HI}" stroke-width="4" stroke-linejoin="round">KLUCZE</text>
    <text x="60" y="96" text-anchor="middle"
          font-family="Georgia, serif" font-style="italic" font-size="12" fill="{INK_MED}"
          paint-order="stroke" stroke="{PAPER_HI}" stroke-width="3" stroke-linejoin="round">vicus Klucze</text>
  </g>

  <!-- Small village / mining town of Olkusz -->
  <g transform="translate(570,920)">
    <use href="#hamlet" width="130" height="65"/>
    <text x="65" y="82" text-anchor="middle"
          font-family="Cinzel Decorative, Georgia, serif" font-weight="900"
          font-size="20" fill="{INK_DARK}" letter-spacing="2"
          paint-order="stroke" stroke="{PAPER_HI}" stroke-width="4" stroke-linejoin="round">OLKUSZ</text>
    <text x="65" y="100" text-anchor="middle"
          font-family="Georgia, serif" font-style="italic" font-size="12" fill="{INK_MED}"
          paint-order="stroke" stroke="{PAPER_HI}" stroke-width="3" stroke-linejoin="round">civitas Olkusz · minerae argenti</text>
  </g>

  <!-- "HIC SVNT DRACONES" — medieval sea-dragon flourish nestled in the
       empty parchment between the path and the compass. -->
  <g transform="translate(840,940)">
    <use href="#dragon" width="170" height="100"/>
    <text x="85" y="116" text-anchor="middle"
          font-family="Cinzel Decorative, Georgia, serif" font-weight="900"
          font-size="14" fill="{INK_DARK}" letter-spacing="3"
          paint-order="stroke" stroke="{PAPER_HI}" stroke-width="3" stroke-linejoin="round">HIC · SVNT · DRACONES</text>
  </g>

  <!-- Static cottage pins drawn straight into the SVG (visible icon + label). -->
  <g id="cottages-static">
    {cottages_static_layout(cottages_out)}
  </g>

  <!-- Interactive hit-circles: filled by main.js to receive click/hover. -->
  <g id="cottages"></g>

  <!-- Compass rose (bottom-right corner inside the inner border) -->
  <g transform="translate({INNER_X1 - 170},{INNER_Y1 - 180})" filter="url(#softShadow)">
    <use href="#compass" width="160" height="160"/>
  </g>

  <!-- In-map legend in the bottom-left corner -->
  <g transform="translate({INNER_X0 + 26},{INNER_Y1 - 170})">
    <rect x="0" y="0" width="250" height="140" fill="{PAPER_HI}" stroke="{INK}" stroke-width="1.8" opacity="0.9"/>
    <rect x="6" y="6" width="238" height="128" fill="none" stroke="{INK}" stroke-width="0.6" stroke-dasharray="3 2"/>
    <text x="125" y="24" text-anchor="middle" font-family="Georgia, serif" font-weight="bold"
          font-style="italic" font-size="16" fill="{INK_DARK}">Legenda</text>
    <!-- cottage -->
    <use href="#cottageHouse" x="16" y="34" width="28" height="30"/>
    <text x="54" y="56" font-family="Georgia, serif" font-size="13" fill="{INK_DARK}">Chatynka Elfa</text>
    <!-- tree -->
    <use href="#pine" x="20" y="70" width="18" height="26"/>
    <text x="54" y="90" font-family="Georgia, serif" font-size="13" fill="{INK_DARK}">Silva — bory i lasy</text>
    <!-- road -->
    <path d="M 20,110 L 46,110" stroke="{ROAD_EDGE}" stroke-width="8" stroke-linecap="round"/>
    <path d="M 20,110 L 46,110" stroke="{ROAD_FILL}" stroke-width="5" stroke-linecap="round"/>
    <text x="54" y="114" font-family="Georgia, serif" font-size="13" fill="{INK_DARK}">Via Torta — kręta ścieżka</text>
    <!-- river -->
    <path d="M 18,130 Q 30,124 46,130" stroke="{RIVER}" stroke-width="3" fill="none"/>
    <text x="54" y="134" font-family="Georgia, serif" font-size="13" fill="{INK_DARK}">Flumen — rzeka</text>
  </g>

  <!-- Scroll rolls (drawn last so they overlay the paper's left/right ends) -->
{render_roll(LEFT_ROLL_CX,  "Left")}
{render_roll(RIGHT_ROLL_CX, "Right")}
</svg>
"""
    OUT.write_text(svg)
    print(f"Wrote {OUT} ({len(svg)} bytes)")
    print(f"Updated {COTTAGES_JSON} with {len(cottages_out)} cottage positions")


if __name__ == "__main__":
    generate()
