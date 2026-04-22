/* ---------- Chatynkowo — fairytale map & cottage loader ---------- */
(() => {
  'use strict';

  const COTTAGES_URL = 'data/cottages.json';
  const MAP_URL      = 'assets/map/forest-map.svg';
  const MD_DIR       = 'cottages';

  /* Map projection bounds (lat/lng → SVG x/y).
     Chosen so all castles + cottages fit in the 1600×1200 SVG nicely. */
  const BOUNDS = {
    latMin: 50.15, latMax: 50.78,   // inverted: north=top
    lngMin: 19.24, lngMax: 19.70,
    svgW: 1600,    svgH: 1200,
    padX: 140,     padY: 220
  };

  const state = {
    cottages: [],
    svgRoot: null
  };

  /* ---------- Coordinate projection ---------- */
  function project(lat, lng) {
    const { latMin, latMax, lngMin, lngMax, svgW, svgH, padX, padY } = BOUNDS;
    const x = padX + (lng - lngMin) / (lngMax - lngMin) * (svgW - 2 * padX);
    const y = padY + (latMax - lat) / (latMax - latMin) * (svgH - 2 * padY);
    return { x, y };
  }

  /* ---------- Fetch + inject the map SVG ---------- */
  async function loadMap() {
    const res = await fetch(MAP_URL);
    const text = await res.text();
    const stage = document.getElementById('mapStage');
    stage.innerHTML = text;
    state.svgRoot = stage.querySelector('svg');
  }

  /* ---------- Load cottages ---------- */
  async function loadCottages() {
    const res = await fetch(COTTAGES_URL);
    state.cottages = await res.json();
  }

  /* ---------- Draw paths & cottage markers ---------- */
  function slugSafe(s) {
    return s.toLowerCase()
      .replaceAll('ą','a').replaceAll('ć','c').replaceAll('ę','e')
      .replaceAll('ł','l').replaceAll('ń','n').replaceAll('ó','o')
      .replaceAll('ś','s').replaceAll('ź','z').replaceAll('ż','z')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function drawCottages() {
    if (!state.svgRoot) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const cottagesLayer = state.svgRoot.querySelector('#cottages');
    const branchesLayer = state.svgRoot.querySelector('#branches');
    cottagesLayer.innerHTML = '';
    branchesLayer.innerHTML = '';

    // Entry points along the "forest edge spine" where branches emerge.
    const entryPoints = [
      { x: 140,  y: 770 },  { x: 380,  y: 800 },  { x: 620, y: 830 },
      { x: 860,  y: 860 },  { x: 1100, y: 860 },  { x: 1340, y: 840 },
      { x: 1520, y: 820 }
    ];

    state.cottages.forEach((c, i) => {
      const p = project(c.lat, c.lng);
      // Nearest entry point
      let near = entryPoints[0], best = Infinity;
      for (const ep of entryPoints) {
        const d = Math.hypot(ep.x - p.x, ep.y - p.y);
        if (d < best) { best = d; near = ep; }
      }

      // Curved stone path from entry to cottage
      const midX = (near.x + p.x) / 2 + (i % 2 === 0 ? 30 : -30);
      const midY = (near.y + p.y) / 2 + (i % 3 === 0 ? -40 : 30);
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', `M${near.x},${near.y} Q${midX},${midY} ${p.x},${p.y}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#8d6b3d');
      path.setAttribute('stroke-width', '6');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-dasharray', '6 8');
      path.setAttribute('opacity', '0.95');
      branchesLayer.appendChild(path);

      // Cottage marker: small house glyph
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'cottage-marker');
      g.setAttribute('transform', `translate(${p.x - 22},${p.y - 34})`);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `${c.title}. Kliknij, aby otworzyć opis i nawigację.`);
      g.dataset.slug = c.slug;

      g.innerHTML = `
        <rect x="6"  y="20" width="32" height="24" fill="#f3e0b2" stroke="#3a2a1a" stroke-width="1.6"/>
        <polygon class="cottage-roof" points="2,22 22,2 42,22" fill="#b83a3a" stroke="#3a2a1a" stroke-width="1.6"/>
        <rect x="18" y="30" width="8" height="14" fill="#6d4a14" stroke="#3a2a1a" stroke-width="1"/>
        <rect x="8"  y="26" width="6" height="6" fill="#ffd36b" stroke="#3a2a1a" stroke-width="1"/>
        <rect x="30" y="26" width="6" height="6" fill="#ffd36b" stroke="#3a2a1a" stroke-width="1"/>
        <rect x="28" y="6" width="4" height="10" fill="#3a2a1a"/>
        <circle cx="22" cy="52" r="2" fill="#3a2a1a"/>
      `;

      // Tooltip label (pop-up-like, shown always for legibility)
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('class', 'cottage-label');
      label.setAttribute('x', p.x);
      label.setAttribute('y', p.y + 20);
      label.setAttribute('text-anchor', 'middle');
      label.textContent = c.title.replace(/^Chatynka\s+/, '');

      g.addEventListener('click', () => openCottageModal(c));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCottageModal(c); }
      });

      cottagesLayer.appendChild(g);
      cottagesLayer.appendChild(label);
    });
  }

  /* ---------- Cottage index ---------- */
  function buildCottageIndex() {
    const ul = document.getElementById('cottageIndex');
    ul.innerHTML = '';
    for (const c of state.cottages) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#mapa';
      a.textContent = c.title;
      a.addEventListener('click', (e) => { e.preventDefault(); openCottageModal(c); });
      li.appendChild(a);
      ul.appendChild(li);
    }
  }

  /* ---------- Cottage detail modal ---------- */
  async function openCottageModal(c) {
    const modal = document.getElementById('cottageModal');
    const content = document.getElementById('modalContent');
    const dir = document.getElementById('modalDirections');
    const osm = document.getElementById('modalOsm');
    const md = document.getElementById('modalMd');

    const mdUrl = `${MD_DIR}/${c.slug}.md`;
    dir.href = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving`;
    osm.href = `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=16/${c.lat}/${c.lng}`;
    md.href = mdUrl;
    md.setAttribute('download', `${c.slug}.md`);

    content.innerHTML = '<p><em>Ładuję opowieść…</em></p>';

    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');

    try {
      const res = await fetch(mdUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let raw = await res.text();
      // Strip YAML frontmatter
      raw = raw.replace(/^---[\s\S]*?---\s*/, '');
      const html = (window.marked ? window.marked.parse(raw) : escapeHtml(raw));
      content.innerHTML = html;
    } catch (err) {
      content.innerHTML = `<p>Nie udało się wczytać opowieści. <a href="${mdUrl}">Otwórz plik Markdown</a>.</p>`;
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function wireModal() {
    const modal = document.getElementById('cottageModal');
    const close = document.getElementById('modalClose');
    close.addEventListener('click', () => modal.close ? modal.close() : modal.removeAttribute('open'));
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                     e.clientY >= rect.top  && e.clientY <= rect.bottom;
      if (!inside) modal.close();
    });
  }

  /* ---------- 4-digit code form ---------- */
  function wireCodeForm() {
    const form = document.getElementById('codeForm');
    const input = document.getElementById('historiaKod');
    const out = document.getElementById('codeResult');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (input.value || '').trim();
      if (!/^\d{4}$/.test(v)) {
        out.textContent = 'Podaj prawidłowy 4-cyfrowy kod znaleziony na tabliczce Chatynki.';
        return;
      }
      // Deterministic pick of a cottage based on the code — whimsical mapping.
      const idx = parseInt(v, 10) % state.cottages.length;
      const c = state.cottages[idx];
      out.innerHTML = `✨ Magia ożywa… Elf z <strong>${c.title}</strong> chce Ci coś opowiedzieć.`;
      openCottageModal(c);
    });
  }

  /* ---------- Boot ---------- */
  async function init() {
    try {
      await Promise.all([loadMap(), loadCottages()]);
      drawCottages();
      buildCottageIndex();
      wireModal();
      wireCodeForm();
    } catch (err) {
      console.error('[Chatynkowo] init failed', err);
      const stage = document.getElementById('mapStage');
      if (stage) stage.innerHTML =
        `<p style="padding:2rem;color:#f5e6b8">Nie udało się wczytać mapy. Otwórz stronę przez serwer HTTP (np. <code>python3 -m http.server</code>) — przeglądarki blokują lokalny <code>fetch()</code> z <code>file://</code>.</p>`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
