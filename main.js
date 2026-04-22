/* ---------- Chatynkowo — fairytale map & cottage loader ---------- */
(() => {
  'use strict';

  const COTTAGES_URL = 'data/cottages.json';
  const MAP_URL      = 'assets/map/forest-map.svg';
  const MD_DIR       = 'cottages';

  const state = {
    cottages: [],
    svgRoot: null
  };

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

  /* ---------- Interactive cottage overlay ----------
     Visible cottage icons + labels are rendered statically into forest-map.svg
     at each cottage's mapX/mapY. This function layers a transparent clickable
     hit-circle on top of each one, so users can hover, click or
     keyboard-activate the cottage.

     When a cottage is activated we:
       1. Move its static group to the end of #cottages-static so it paints
          on top of everything else (SVG has no z-index).
       2. Add .is-clicked — CSS scales the group up (transform: scale(3))
          with a soft spring transition.
       3. After the zoom animation finishes, open the modal with the
          cottage's description and driving directions.
       4. When the modal closes, remove .is-clicked so the pin shrinks back. */
  const ZOOM_DELAY_MS = 320;  // roughly matches the CSS transition

  function drawCottages() {
    if (!state.svgRoot) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const cottagesLayer = state.svgRoot.querySelector('#cottages');
    if (!cottagesLayer) return;
    cottagesLayer.innerHTML = '';

    const modal = document.getElementById('cottageModal');

    state.cottages.forEach((c) => {
      const x = Number(c.mapX);
      const y = Number(c.mapY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const staticGroup = state.svgRoot.querySelector(
        `#cottages-static [data-slug="${c.slug}"]`
      );

      const hit = document.createElementNS(svgNS, 'circle');
      hit.setAttribute('cx', String(x));
      hit.setAttribute('cy', String(y + 10));
      hit.setAttribute('r',  '46');
      hit.setAttribute('fill', 'transparent');
      hit.setAttribute('class', 'cottage-hit');
      hit.setAttribute('tabindex', '0');
      hit.setAttribute('role', 'button');
      hit.setAttribute('aria-label', `${c.title}. Kliknij, aby otworzyć opis i nawigację.`);
      hit.dataset.slug = c.slug;

      const activate = () => {
        if (staticGroup) {
          // Raise to top of layer
          staticGroup.parentNode.appendChild(staticGroup);
          staticGroup.classList.add('is-clicked');
          staticGroup.classList.remove('is-hover');
          setTimeout(() => openCottageModal(c), ZOOM_DELAY_MS);
          // Clean up the zoom when the modal is closed for any reason.
          const reset = () => {
            staticGroup.classList.remove('is-clicked');
            modal.removeEventListener('close', reset);
          };
          modal.addEventListener('close', reset);
        } else {
          openCottageModal(c);
        }
      };

      hit.addEventListener('click', activate);
      hit.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
      if (staticGroup) {
        hit.addEventListener('mouseenter', () => staticGroup.classList.add('is-hover'));
        hit.addEventListener('mouseleave', () => staticGroup.classList.remove('is-hover'));
        hit.addEventListener('focus',      () => staticGroup.classList.add('is-hover'));
        hit.addEventListener('blur',       () => staticGroup.classList.remove('is-hover'));
      }
      cottagesLayer.appendChild(hit);
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
