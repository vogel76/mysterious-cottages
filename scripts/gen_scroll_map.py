#!/usr/bin/env python3
"""Generate assets/map/forest-map.svg as a treasure-map scroll.

Frame: aged parchment body with torn wavy top/bottom edges and two
cylindrical coiled rolls on the left & right. The existing fairytale
scene (moon, hills, river, forest, castles, paths, compass, title
cartouche, and the JS-populated #cottages / #branches layers) is
rendered inside a nested <svg> that fills the inner parchment area.
Idempotent: re-run to regenerate the SVG.
"""
from __future__ import annotations
import random
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "assets/map/forest-map.svg"

# ---------- layout ----------
VW, VH = 1600, 1200

LEFT_ROLL_CX  = 170
RIGHT_ROLL_CX = 1430
ROLL_RX       = 46                       # half-width of each cylinder's body
ROLL_CAP_RX   = 56                       # caps bulge wider than cylinder
ROLL_CAP_RY   = 18                       # vertical radius of end ellipse
BODY_TOP_Y    = 135
BODY_BOTTOM_Y = 1065
BODY_LEFT_X   = LEFT_ROLL_CX - 8         # extends INTO the left roll (hidden behind it) so the silhouette reads as continuous
BODY_RIGHT_X  = RIGHT_ROLL_CX + 8        # same on the right
ROLL_TOP_Y    = BODY_TOP_Y - 30          # 105
ROLL_BOTTOM_Y = BODY_BOTTOM_Y + 30       # 1095

# Inner content viewport (nested <svg> placement — fits inside the VISIBLE
# parchment: from just past the left roll's right edge to just before the right
# roll's left edge).
CONTENT_X = LEFT_ROLL_CX + ROLL_CAP_RX - 6   # just inside the left roll's cap
CONTENT_Y = BODY_TOP_Y + 30
CONTENT_W = (RIGHT_ROLL_CX - LEFT_ROLL_CX) - 2 * (ROLL_CAP_RX - 6)
CONTENT_H = (BODY_BOTTOM_Y - BODY_TOP_Y) - 60


# ---------- helpers ----------
def wavy_edge(x1, x2, y, direction, *, segments=34, amp=30, rnd):
    """Return a list of Q-curve commands tracing a torn edge from (x1,y) to (x2,y).
    `direction` is -1 (bumps upward) for a top edge, +1 (bumps downward) for a bottom edge.
    """
    pts = [(x1, y)]
    for i in range(1, segments):
        t = i / segments
        # Small x jitter, large y jitter – looks more torn than mere wavy
        x = x1 + (x2 - x1) * t + rnd.uniform(-14, 14)
        # Mix a steady wave with noise so it doesn't look random
        base = 0.4 + 0.6 * (0.5 * (1 + (-1 if i % 2 else 1)))
        dy = direction * (0.35 + 0.65 * rnd.random()) * amp * (0.6 + 0.4 * base)
        pts.append((x, y + dy))
    pts.append((x2, y))
    cmds = []
    for i in range(1, len(pts)):
        xp, yp = pts[i - 1]
        xc, yc = pts[i]
        mx = (xp + xc) / 2 + rnd.uniform(-4, 4)
        my = (yp + yc) / 2 + direction * rnd.uniform(6, 20)
        cmds.append(f"Q{mx:.1f},{my:.1f} {xc:.1f},{yc:.1f}")
    return cmds


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


def make_stains(rnd, n=14):
    spots = []
    for _ in range(n):
        cx = rnd.uniform(260, 1340)
        cy = rnd.uniform(170, 1030)
        rx = rnd.uniform(28, 80)
        ry = rnd.uniform(16, 44)
        rot = rnd.uniform(0, 180)
        opac = rnd.uniform(0.14, 0.28)
        spots.append((cx, cy, rx, ry, rot, opac))
    return spots


# ---------- inner map content (the existing fairytale scene) ----------
# Note: greens and blues are dialled down (opacity-wise) so the scene blends
# with the aged parchment instead of looking like a coloured poster.
INNER_CONTENT = """
  <!-- Faint moon glow (top-right of the paper) -->
  <circle cx="1360" cy="200" r="200" fill="url(#moonGlow)" opacity="0.45"/>

  <!-- Distant hills: dark brown ink silhouettes, not greens -->
  <path d="M0,820 Q200,760 420,790 T820,770 T1200,790 T1600,760 L1600,1200 L0,1200 Z"
        fill="#6b4d20" opacity="0.22"/>
  <path d="M0,900 Q220,840 460,880 T900,860 T1260,880 T1600,850 L1600,1200 L0,1200 Z"
        fill="#4a3514" opacity="0.22"/>

  <!-- River winding: dark brown ink, not blue -->
  <path d="M-20,640 C180,610 300,700 520,680 S820,600 1000,680 1260,740 1620,700"
        fill="none" stroke="#5a3a15" stroke-width="10" stroke-linecap="round" opacity="0.55"/>
  <path d="M-20,640 C180,610 300,700 520,680 S820,600 1000,680 1260,740 1620,700"
        fill="none" stroke="#c79a4b" stroke-width="3" stroke-linecap="round" opacity="0.75"/>

  <!-- Forest: scattered pines & oaks (symbols darkened via CSS-less approach — the
       pine/oak symbols already use dark strokes; group opacity adapts them to paper). -->
  <g id="forest" opacity="0.82">
    <use href="#pine" x="40"  y="120" width="60" height="120"/>
    <use href="#pine" x="110" y="90"  width="80" height="160"/>
    <use href="#pine" x="200" y="140" width="55" height="110"/>
    <use href="#pine" x="260" y="110" width="70" height="140"/>
    <use href="#pine" x="340" y="150" width="50" height="100"/>
    <use href="#oak"  x="50"  y="260" width="90" height="108"/>
    <use href="#pine" x="150" y="270" width="70" height="140"/>
    <use href="#pine" x="230" y="260" width="60" height="120"/>
    <use href="#oak"  x="310" y="270" width="80" height="96"/>

    <use href="#pine" x="80"  y="420" width="60" height="120"/>
    <use href="#oak"  x="170" y="440" width="70" height="84"/>
    <use href="#pine" x="260" y="420" width="55" height="110"/>

    <use href="#pine" x="1340" y="380" width="60" height="120"/>
    <use href="#pine" x="1420" y="350" width="80" height="160"/>
    <use href="#oak"  x="1510" y="400" width="70" height="84"/>
    <use href="#pine" x="1380" y="520" width="60" height="120"/>
    <use href="#pine" x="1460" y="540" width="55" height="110"/>
    <use href="#oak"  x="1520" y="540" width="60" height="72"/>

    <use href="#pine" x="120"  y="1020" width="60" height="120"/>
    <use href="#oak"  x="220"  y="1040" width="70" height="84"/>
    <use href="#pine" x="320"  y="1020" width="55" height="110"/>
    <use href="#pine" x="420"  y="1040" width="50" height="100"/>
    <use href="#oak"  x="520"  y="1050" width="65" height="78"/>
    <use href="#pine" x="640"  y="1010" width="70" height="140"/>
    <use href="#pine" x="760"  y="1040" width="50" height="100"/>
    <use href="#oak"  x="860"  y="1050" width="70" height="84"/>
    <use href="#pine" x="980"  y="1020" width="55" height="110"/>
    <use href="#pine" x="1100" y="1040" width="65" height="130"/>
    <use href="#oak"  x="1220" y="1050" width="70" height="84"/>
    <use href="#pine" x="1340" y="1020" width="60" height="120"/>
    <use href="#pine" x="1460" y="1040" width="55" height="110"/>

    <use href="#mushroom" x="380"  y="780" width="26" height="26"/>
    <use href="#mushroom" x="520"  y="860" width="22" height="22"/>
    <use href="#mushroom" x="780"  y="930" width="28" height="28"/>
    <use href="#mushroom" x="1100" y="840" width="22" height="22"/>
    <use href="#mushroom" x="1260" y="910" width="26" height="26"/>
  </g>

  <!-- CASTLES -->
  <g transform="translate(430,120)" filter="url(#softShadow)">
    <use href="#castle" width="220" height="165"/>
    <text x="110" y="190" text-anchor="middle" font-family="Georgia, serif" font-style="italic"
          font-size="26" fill="#3a2a1a">Zamek Ogrodzieniec</text>
  </g>
  <g transform="translate(1020,90)" filter="url(#softShadow)">
    <use href="#castle" width="200" height="150"/>
    <text x="100" y="175" text-anchor="middle" font-family="Georgia, serif" font-style="italic"
          font-size="24" fill="#3a2a1a">Zamek Olsztyn</text>
  </g>
  <g transform="translate(260,520)" filter="url(#softShadow)">
    <use href="#castle" width="180" height="135"/>
    <text x="90" y="158" text-anchor="middle" font-family="Georgia, serif" font-style="italic"
          font-size="22" fill="#3a2a1a">Zamek Mirów</text>
  </g>
  <g transform="translate(520,540)" filter="url(#softShadow)">
    <use href="#castle" width="180" height="135"/>
    <text x="90" y="158" text-anchor="middle" font-family="Georgia, serif" font-style="italic"
          font-size="22" fill="#3a2a1a">Zamek Bobolice</text>
  </g>

  <!-- Stone-path spine & branches -->
  <g id="paths" fill="none" stroke="#8d6b3d" stroke-width="10" stroke-linecap="round" stroke-dasharray="14 10" opacity="0.9">
    <path d="M80,760 C260,760 340,810 560,830 S900,870 1120,860 1400,840 1540,820"/>
  </g>
  <g id="branches" fill="none" stroke="#8d6b3d" stroke-width="6" stroke-linecap="round" stroke-dasharray="8 8" opacity="0.95"></g>
  <g id="cottages"></g>

  <!-- Compass rose -->
  <g transform="translate(1350,960)" filter="url(#softShadow)">
    <use href="#compass" width="130" height="130"/>
  </g>

  <!-- Title cartouche -->
  <g transform="translate(560,200)" filter="url(#softShadow)">
    <path d="M0,0 H480 Q520,0 520,40 V80 Q520,120 480,120 H0 Q-40,120 -40,80 V40 Q-40,0 0,0 Z"
          fill="#f1e2b5" stroke="#5a4523" stroke-width="3"/>
    <text x="240" y="62" text-anchor="middle" font-family="Georgia, serif" font-size="36"
          fill="#3a2a1a" font-style="italic" font-weight="bold">Chatynkowo</text>
    <text x="240" y="96" text-anchor="middle" font-family="Georgia, serif" font-size="18"
          fill="#5a4523" font-style="italic">~ baśniowa mapa ukrytych chatynek ~</text>
  </g>
"""


def render_roll(cx, label):
    """Render a vertical scroll roll centred at x=cx: bulging coiled caps at
    top & bottom with a cylindrical body between them."""

    def coil(cy):
        # Strong outer cap, concentric coil rings with a slight drift to hint spiral,
        # dark hollow "eye" at the very centre.
        return f"""
    <!-- outer cap: rolled paper edge, bulges wider than the cylinder body -->
    <ellipse cx="{cx}" cy="{cy}" rx="{ROLL_CAP_RX}" ry="{ROLL_CAP_RY}"
             fill="url(#rollCapGrad)" stroke="#2a1806" stroke-width="1.4"/>
    <!-- outer rim highlight -->
    <path d="M{cx - ROLL_CAP_RX + 4},{cy - 2}
             Q{cx},{cy - ROLL_CAP_RY + 1} {cx + ROLL_CAP_RX - 4},{cy - 2}"
          fill="none" stroke="#f3d99a" stroke-width="1.2" opacity="0.55"/>
    <!-- Coil layers (from outer to inner) -->
    <ellipse cx="{cx}" cy="{cy}" rx="{ROLL_CAP_RX - 6}" ry="{ROLL_CAP_RY - 3}"
             fill="none" stroke="#6b4218" stroke-width="1.5"/>
    <ellipse cx="{cx + 1}" cy="{cy + 0.5}" rx="{ROLL_CAP_RX - 13}" ry="{ROLL_CAP_RY - 6}"
             fill="#d9a45a" stroke="#3a2308" stroke-width="1"/>
    <ellipse cx="{cx + 1.5}" cy="{cy + 0.5}" rx="{ROLL_CAP_RX - 18}" ry="{ROLL_CAP_RY - 8}"
             fill="none" stroke="#6b4218" stroke-width="1"/>
    <ellipse cx="{cx + 2}" cy="{cy + 1}" rx="{ROLL_CAP_RX - 24}" ry="{ROLL_CAP_RY - 10}"
             fill="#c48a3e" stroke="#3a2308" stroke-width="0.9"/>
    <ellipse cx="{cx + 2.5}" cy="{cy + 1}" rx="{ROLL_CAP_RX - 30}" ry="{ROLL_CAP_RY - 12}"
             fill="none" stroke="#6b4218" stroke-width="0.9"/>
    <!-- dark hollow eye in the centre of the spiral -->
    <ellipse cx="{cx + 3}" cy="{cy + 1.5}" rx="{max(3, ROLL_CAP_RX - 40)}" ry="{max(2, ROLL_CAP_RY - 14)}"
             fill="#1a0e04" stroke="#3a2308" stroke-width="0.6"/>"""

    x0 = cx - ROLL_RX
    body_h = ROLL_BOTTOM_Y - ROLL_TOP_Y
    # Horizontal wrap hints on the cylinder body: many faint lines
    wrap_lines = []
    y = ROLL_TOP_Y + 10
    while y < ROLL_BOTTOM_Y - 10:
        wrap_lines.append(
            f'<line x1="{x0 + 4}" y1="{y:.1f}" x2="{x0 + ROLL_RX * 2 - 4}" y2="{y:.1f}" '
            f'stroke="#2a1806" stroke-opacity="0.25" stroke-width="0.7"/>'
        )
        y += 14
    wrap_lines_str = "\n    ".join(wrap_lines)

    return f"""
  <!-- {label} roll -->
  <g>
    <!-- soft ground shadow below the roll -->
    <ellipse cx="{cx}" cy="{ROLL_BOTTOM_Y + 26}" rx="{ROLL_CAP_RX + 6}" ry="10"
             fill="#000" opacity="0.35"/>
    <!-- cylinder body with curvature gradient -->
    <rect x="{x0}" y="{ROLL_TOP_Y}" width="{ROLL_RX * 2}" height="{body_h}"
          fill="url(#rollBodyGrad)" stroke="#2a1806" stroke-width="1"/>
    {wrap_lines_str}
    <!-- darker shading on the outer curved edges of the cylinder -->
    <rect x="{x0}" y="{ROLL_TOP_Y}" width="14" height="{body_h}"
          fill="url(#rollEdgeShade)" opacity="0.95"/>
    <rect x="{x0 + ROLL_RX * 2 - 14}" y="{ROLL_TOP_Y}" width="14" height="{body_h}"
          fill="url(#rollEdgeShadeR)" opacity="0.95"/>
    <!-- top + bottom caps with coiled paper -->{coil(ROLL_TOP_Y)}{coil(ROLL_BOTTOM_Y)}
  </g>"""


def main():
    rnd = random.Random(42)
    body_d = build_body_path(rnd)
    stains = make_stains(rnd)

    stain_rects = "\n    ".join(
        f'<ellipse cx="{cx:.0f}" cy="{cy:.0f}" rx="{rx:.0f}" ry="{ry:.0f}" '
        f'transform="rotate({rot:.0f} {cx:.0f} {cy:.0f})" fill="#5a3a0f" opacity="{opac:.2f}"/>'
        for (cx, cy, rx, ry, rot, opac) in stains
    )

    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}" preserveAspectRatio="xMidYMid meet"
     role="img" aria-labelledby="mapTitle mapDesc">
  <title id="mapTitle">Baśniowa mapa-zwój Chatynkowa</title>
  <desc id="mapDesc">Pergaminowy zwój w stylu piracko-baśniowym. Na rozwiniętej karcie zaznaczono leśne ścieżki, chatynki Elfów oraz zamki Ogrodzieniec, Olsztyn, Bobolice i Mirów.</desc>

  <defs>
    <!-- Aged parchment fill: warm cream at centre, burnt tan near the edges -->
    <radialGradient id="parchmentFill" cx="50%" cy="50%" r="65%">
      <stop offset="0%"   stop-color="#f7e1ab"/>
      <stop offset="40%"  stop-color="#ebc787"/>
      <stop offset="75%"  stop-color="#b3823a"/>
      <stop offset="92%"  stop-color="#7a4f1f"/>
      <stop offset="100%" stop-color="#3a2308"/>
    </radialGradient>

    <!-- Inner-edge burnt vignette: dark charred rim inside the paper -->
    <radialGradient id="parchmentInnerBurn" cx="50%" cy="50%" r="58%">
      <stop offset="55%"  stop-color="#000" stop-opacity="0"/>
      <stop offset="85%"  stop-color="#3a2308" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#1a0e04" stop-opacity="0.85"/>
    </radialGradient>

    <!-- Cylinder body gradient (darker brown, suggests curvature) -->
    <linearGradient id="rollBodyGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#3a2308"/>
      <stop offset="20%"  stop-color="#7a4f1f"/>
      <stop offset="45%"  stop-color="#d4a55b"/>
      <stop offset="55%"  stop-color="#e6c98b"/>
      <stop offset="78%"  stop-color="#9c6a28"/>
      <stop offset="100%" stop-color="#2b1a0a"/>
    </linearGradient>

    <linearGradient id="rollEdgeShade" x1="0" y1="0" x2="1" y2="0">
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

    <!-- Existing map gradients/symbols/filters -->
    <linearGradient id="mistGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#ffffff" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#fff6c8" stop-opacity="0.9"/>
      <stop offset="60%"  stop-color="#fff6c8" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#fff6c8" stop-opacity="0"/>
    </radialGradient>

    <symbol id="pine" viewBox="0 0 40 80">
      <polygon points="20,2 30,28 24,28 34,54 24,54 38,78 2,78 16,54 6,54 16,28 10,28" fill="#2f5138" stroke="#1d3321" stroke-width="1.2"/>
      <rect x="17" y="76" width="6" height="4" fill="#3a2a1a"/>
    </symbol>
    <symbol id="oak" viewBox="0 0 50 60">
      <ellipse cx="25" cy="22" rx="24" ry="20" fill="#3a6b3e" stroke="#1f3f24" stroke-width="1.2"/>
      <rect x="22" y="40" width="6" height="18" fill="#3a2a1a"/>
    </symbol>
    <symbol id="mushroom" viewBox="0 0 24 24">
      <ellipse cx="12" cy="10" rx="10" ry="7" fill="#b83a3a" stroke="#5a1a1a" stroke-width="1"/>
      <circle cx="7"  cy="9"  r="1.4" fill="#fff"/>
      <circle cx="13" cy="7"  r="1.2" fill="#fff"/>
      <circle cx="16" cy="11" r="1.2" fill="#fff"/>
      <path d="M9 14 Q12 22 15 14 Z" fill="#f3e6c3" stroke="#5a1a1a" stroke-width="1"/>
    </symbol>
    <symbol id="castle" viewBox="0 0 160 120">
      <path d="M0,110 Q30,88 60,102 T120,96 Q148,106 160,112 L160,120 L0,120 Z" fill="#6d6256" stroke="#2c251b" stroke-width="1.6"/>
      <rect x="60" y="40" width="40" height="70" fill="#3a3226" stroke="#140e06" stroke-width="2"/>
      <path d="M60,40 h40 l-4,-10 h-6 v8 h-6 v-8 h-8 v8 h-6 v-8 h-6 z" fill="#3a3226" stroke="#140e06" stroke-width="2"/>
      <rect x="30" y="58" width="26" height="52" fill="#453a2b" stroke="#140e06" stroke-width="2"/>
      <path d="M30,58 h26 l-4,-8 h-4 v6 h-4 v-6 h-6 v6 h-4 v-6 h-4 z" fill="#453a2b" stroke="#140e06" stroke-width="2"/>
      <rect x="104" y="52" width="28" height="58" fill="#453a2b" stroke="#140e06" stroke-width="2"/>
      <path d="M104,52 h28 l-4,-8 h-4 v6 h-4 v-6 h-8 v6 h-4 v-6 h-4 z" fill="#453a2b" stroke="#140e06" stroke-width="2"/>
      <rect x="74" y="62" width="6" height="10" fill="#ffd36b"/>
      <rect x="84" y="62" width="6" height="10" fill="#ffd36b"/>
      <rect x="76" y="82" width="12" height="14" fill="#241a0a"/>
      <rect x="38" y="74" width="6" height="10" fill="#ffd36b"/>
      <rect x="114" y="70" width="6" height="10" fill="#ffd36b"/>
      <line x1="80" y1="24" x2="80" y2="8" stroke="#120a03" stroke-width="2"/>
      <path d="M80,8 L98,14 L80,18 Z" fill="#b83a3a" stroke="#2c0a0a" stroke-width="1"/>
    </symbol>
    <symbol id="compass" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="54" fill="#f1e2b5" stroke="#5a4523" stroke-width="2"/>
      <circle cx="60" cy="60" r="42" fill="none" stroke="#5a4523" stroke-width="1" stroke-dasharray="2 4"/>
      <polygon points="60,8 66,60 60,56 54,60" fill="#b83a3a" stroke="#2c0a0a" stroke-width="1"/>
      <polygon points="60,112 54,60 60,64 66,60" fill="#3a3226" stroke="#120a03" stroke-width="1"/>
      <polygon points="8,60 60,54 56,60 60,66" fill="#5a4523" stroke="#2c1a06" stroke-width="1"/>
      <polygon points="112,60 60,66 64,60 60,54" fill="#5a4523" stroke="#2c1a06" stroke-width="1"/>
      <text x="60" y="26" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#3a2a1a" font-style="italic">N</text>
      <text x="60" y="104" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#3a2a1a" font-style="italic">S</text>
      <text x="14" y="65" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#3a2a1a" font-style="italic">W</text>
      <text x="106" y="65" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#3a2a1a" font-style="italic">E</text>
    </symbol>

    <!-- Fibrous parchment texture via fractal noise -->
    <filter id="paperGrain" x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/>
      <feColorMatrix values="0 0 0 0 0.45
                             0 0 0 0 0.32
                             0 0 0 0 0.15
                             0 0 0 0.18 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>

    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
      <feOffset dx="2" dy="4" result="offsetblur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    <filter id="dropShadowBig" x="-10%" y="-10%" width="120%" height="130%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>
      <feOffset dx="0" dy="18" result="b"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    <clipPath id="parchmentClip">
      <path d="{body_d}"/>
    </clipPath>
  </defs>

  <!-- Ground shadow beneath the scroll -->
  <ellipse cx="{VW/2:.0f}" cy="{VH - 30:.0f}" rx="{(BODY_RIGHT_X - BODY_LEFT_X)/2 + 80:.0f}" ry="18" fill="#000" opacity="0.35"/>

  <!-- Parchment body -->
  <path d="{body_d}" fill="url(#parchmentFill)" filter="url(#dropShadowBig)"/>
  <!-- Fibrous paper grain overlay -->
  <path d="{body_d}" fill="#a57329" opacity="0.28" filter="url(#paperGrain)" pointer-events="none"/>

  <!-- Aged stains -->
  <g clip-path="url(#parchmentClip)" pointer-events="none">
    {stain_rects}
  </g>

  <!-- Inner map content (scaled to fit the parchment body with a margin) -->
  <svg x="{CONTENT_X}" y="{CONTENT_Y}" width="{CONTENT_W}" height="{CONTENT_H}"
       viewBox="0 0 {VW} {VH}" preserveAspectRatio="xMidYMid meet"
       clip-path="url(#parchmentClip)" overflow="visible">
{INNER_CONTENT}
  </svg>

  <!-- Burnt inner-edge vignette on top of content -->
  <path d="{body_d}" fill="url(#parchmentInnerBurn)" pointer-events="none" opacity="0.9"/>

  <!-- Scroll rolls (rendered on top to cover straight body ends) -->
{render_roll(LEFT_ROLL_CX,  "Left")}
{render_roll(RIGHT_ROLL_CX, "Right")}
</svg>
"""
    OUT.write_text(svg)
    print(f"Wrote {OUT} ({len(svg)} bytes)")


if __name__ == "__main__":
    main()
