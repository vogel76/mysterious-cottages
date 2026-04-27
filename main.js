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

  function makeHotspot(c, onActivate) {
    const x = Number(c.mapX);
    const y = Number(c.mapY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
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
    btn.addEventListener('click', (e) => {
      // Don't let the click bubble up to the map-stage / map-zoom handlers.
      e.stopPropagation();
      onActivate(btn, c);
    });
    return btn;
  }

  function drawCottages() {
    const host = document.getElementById('mapHotspots');
    if (!host) return;
    host.innerHTML = '';

    const modal = document.getElementById('cottageModal');

    state.cottages.forEach((c) => {
      const btn = makeHotspot(c, (el, cot) => {
        el.classList.add('is-clicked');
        setTimeout(() => {
          openCottageModal(cot);
          const reset = () => {
            el.classList.remove('is-clicked');
            modal.removeEventListener('close', reset);
          };
          modal.addEventListener('close', reset);
        }, ZOOM_DELAY_MS);
      });
      if (btn) host.appendChild(btn);
    });

    drawZoomHotspots();
  }

  /* Zoom-mode hotspots: same positions, but click goes straight to the
     cottage modal — the map is already large, no extra zoom animation. */
  function drawZoomHotspots() {
    const host = document.getElementById('mapZoomHotspots');
    if (!host) return;
    host.innerHTML = '';
    state.cottages.forEach((c) => {
      const btn = makeHotspot(c, (_el, cot) => openCottageModal(cot));
      if (btn) host.appendChild(btn);
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

  /* ---------- Map zoom dialog ----------
     Click anywhere on the map (except a pin) to open the full-resolution
     map in a fullscreen scrollable dialog. Pins keep their own behaviour. */
  function wireMapZoom() {
    const stage = document.getElementById('mapStage');
    const dialog = document.getElementById('mapZoom');
    const scroll = document.getElementById('mapZoomScroll');
    const img = document.getElementById('mapZoomImg');
    const close = document.getElementById('mapZoomClose');
    const sourceImg = document.getElementById('mapImage');
    if (!stage || !dialog || !img || !close || !scroll || !sourceImg) return;

    function openZoom() {
      // Lazy-set src on first open so the (cached) image loads on demand.
      if (!img.getAttribute('src')) img.src = sourceImg.currentSrc || sourceImg.src;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      // Center the image once it's laid out.
      requestAnimationFrame(() => {
        scroll.scrollLeft = (scroll.scrollWidth  - scroll.clientWidth)  / 2;
        scroll.scrollTop  = (scroll.scrollHeight - scroll.clientHeight) / 2;
      });
    }
    function closeZoom() {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }

    stage.addEventListener('click', (e) => {
      // Pins have their own click handler; don't open the zoom for them.
      if (e.target.closest('.cottage-hotspot')) return;
      // Wait until the map image is actually loaded.
      if (!stage.classList.contains('has-image')) return;
      openZoom();
    });

    close.addEventListener('click', closeZoom);
    // Click on backdrop area (the dialog itself, outside the scroll container)
    // closes the zoom.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) closeZoom();
    });

    // Click-drag panning for desktop (touch already pans natively).
    let dragging = false;
    let startX = 0, startY = 0, startScrollX = 0, startScrollY = 0;
    scroll.addEventListener('pointerdown', (e) => {
      // Skip touch/pen — let the browser handle native scrolling/pinching.
      if (e.pointerType !== 'mouse') return;
      // Don't capture clicks that started on a pin — pointer capture would
      // re-route the pointerup to the scroll element and swallow the click.
      if (e.target.closest('.cottage-hotspot')) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startScrollX = scroll.scrollLeft; startScrollY = scroll.scrollTop;
      scroll.classList.add('is-dragging');
      scroll.setPointerCapture(e.pointerId);
    });
    scroll.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      scroll.scrollLeft = startScrollX - (e.clientX - startX);
      scroll.scrollTop  = startScrollY - (e.clientY - startY);
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      scroll.classList.remove('is-dragging');
      try { scroll.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    scroll.addEventListener('pointerup', endDrag);
    scroll.addEventListener('pointercancel', endDrag);
  }

  /* ---------- Hero slideshow ----------
     Crossfades through the cottage photos stacked inside .hero__slides. The
     .is-active class controls opacity; only one slide is opaque at a time. */
  function wireHeroSlideshow() {
    const slides = document.querySelectorAll('.hero__slide');
    if (slides.length < 2) return;
    const SLIDE_MS = 5000;
    let i = 0;
    // Make sure exactly one slide starts active (defensive — markup already
    // sets it on the first one).
    slides.forEach((s, idx) => s.classList.toggle('is-active', idx === 0));
    setInterval(() => {
      slides[i].classList.remove('is-active');
      i = (i + 1) % slides.length;
      slides[i].classList.add('is-active');
    }, SLIDE_MS);
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
    wireHeroSlideshow();
    wireHubButtons();
    wireModal();
    wireCodeForm();
    wireMapZoom();
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
