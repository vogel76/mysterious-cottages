/* ---------- Chatynkowo — fairytale map & cottage loader ---------- */
(() => {
  'use strict';

  const COTTAGES_URL = 'data/cottages.json';
  const MD_DIR       = 'cottages';

  const state = {
    cottages: [],
  };

  /* ---------- Load cottages ---------- */
  async function loadCottages() {
    const res = await fetch(COTTAGES_URL);
    state.cottages = await res.json();
  }

  /* ---------- Cottage hotspots (image overlay) ----------
     The map is a bitmap at assets/img/map-base.png. For each cottage, we
     place a transparent <button> at its mapX/mapY position (expressed as a
     PERCENTAGE of the image in data/cottages.json). CSS gives it a gold
     pulsing glow on hover/focus and an animated zoom on click. */
  const ZOOM_DELAY_MS = 360;  // matches the .is-clicked CSS transition

  function drawCottages() {
    const host = document.getElementById('mapHotspots');
    if (!host) return;
    host.innerHTML = '';

    const modal = document.getElementById('cottageModal');

    state.cottages.forEach((c) => {
      const x = Number(c.mapX);
      const y = Number(c.mapY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cottage-hotspot';
      btn.dataset.slug  = c.slug;
      btn.dataset.label = c.title;
      btn.setAttribute(
        'aria-label',
        `${c.title}. Kliknij, aby otworzyć opis i nawigację.`
      );
      btn.style.left = x + '%';
      btn.style.top  = y + '%';

      const activate = () => {
        btn.classList.add('is-clicked');
        setTimeout(() => {
          openCottageModal(c);
          const reset = () => {
            btn.classList.remove('is-clicked');
            modal.removeEventListener('close', reset);
          };
          modal.addEventListener('close', reset);
        }, ZOOM_DELAY_MS);
      };

      btn.addEventListener('click', activate);
      host.appendChild(btn);
    });
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

  /* ---------- Hub buttons (toggle collapsible sections) ----------
     Each .hub__btn carries data-target with the id of the section it controls.
     At most ONE panel may be open at a time: clicking another button closes
     whichever panel is currently visible before opening the new one. */
  function wireHubButtons() {
    const buttons = Array.from(document.querySelectorAll('.hub__btn'));
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.target;
        const panel = document.getElementById(id);
        if (!panel) return;
        const willOpen = panel.hasAttribute('hidden');
        // Close every panel + reset every button.
        buttons.forEach((b) => {
          const p = document.getElementById(b.dataset.target);
          if (p) p.setAttribute('hidden', '');
          b.setAttribute('aria-expanded', 'false');
        });
        if (willOpen) {
          panel.removeAttribute('hidden');
          btn.setAttribute('aria-expanded', 'true');
          // Defer scroll so the layout settles after the panel becomes visible.
          requestAnimationFrame(() => {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      });
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
    // Wire UI affordances first so toggles work even if data loading fails.
    wireHubButtons();
    wireModal();
    wireCodeForm();
    try {
      await loadCottages();
      drawCottages();
    } catch (err) {
      console.error('[Chatynkowo] init failed', err);
      const host = document.getElementById('mapHotspots');
      if (host) host.innerHTML =
        `<p style="padding:2rem;color:#f5e6b8;background:rgba(0,0,0,.6);">
           Nie udało się wczytać chatynek. Otwórz stronę przez serwer HTTP
           (np. <code>python3 -m http.server</code>).
         </p>`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
