/* ============================================================
   BIOptimizers — Breakthrough Science
   FOUNDATION. Shared scroll orchestration. Builder agents extend
   inside their own PIECE block; do not rewrite the shared core.

   Rules that are not negotiable:
   - Animate transform and opacity ONLY. Never layout properties.
   - Every effect is gated on prefers-reduced-motion.
   - One IntersectionObserver for reveals; do not spawn more.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- Reduced motion: mark everything present, wire nothing. ---- */
  function revealAllImmediately() {
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.classList.add('is-in');
    });
  }

  /* ---- Shared reveal observer ----------------------------------
     Hiding content until an observer says otherwise is a promise the
     page has to keep. If the observer misses — a deep link that jumps
     past it, a bfcache restore, a browser that throttles callbacks —
     the reader gets a blank page and no way to recover. So the reveal
     is the enhancement and VISIBILITY IS THE FLOOR: three independent
     paths can reveal an element, and the last one always fires.
     -------------------------------------------------------------- */
  function initReveals() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) { revealAllImmediately(); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);          // reveal once, then rest
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    els.forEach(function (el) { io.observe(el); });

    // Path 2: anything already on screen is revealed now, without waiting
    // for a callback. Covers the hash-jump case, where the scroll happens
    // before the observer has a position to measure against.
    function sweepVisible() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      els.forEach(function (el) {
        if (el.classList.contains('is-in')) return;
        var b = el.getBoundingClientRect();
        if (b.top < vh && b.bottom > 0) { el.classList.add('is-in'); io.unobserve(el); }
      });
    }
    sweepVisible();
    window.addEventListener('load', sweepVisible, { once: true });
    window.addEventListener('hashchange', function () { setTimeout(sweepVisible, 60); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) sweepVisible(); });

    // Path 3: the floor. If anything is still hidden after 2.5s, the
    // observer is not doing its job and copy must not stay invisible.
    setTimeout(function () {
      var stuck = document.querySelectorAll('[data-reveal]:not(.is-in)');
      if (!stuck.length) return;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      stuck.forEach(function (el) {
        var b = el.getBoundingClientRect();
        if (b.top < vh * 1.5) { el.classList.add('is-in'); io.unobserve(el); }
      });
    }, 2500);
  }

  /* ---- PIECE 03: phase spine (scroll-animated) ------------------
     Two jobs: mark the active step, and grow the rail fill so the
     reader can see how far through the five phases they are. The
     fill is driven off the active index rather than raw scroll
     position — it stays in lockstep with the labels that way, and
     costs no scroll listener. ------------------------------------ */
  function initSpine() {
    var spine = document.querySelector('[data-spine]');
    var phases = document.querySelectorAll('.phase[data-phase]');
    if (!spine || !phases.length) return;

    var steps = spine.querySelectorAll('[data-spine-step]');
    var fill = spine.querySelector('[data-spine-fill]');

    function setActive(n) {
      var idx = 0;
      steps.forEach(function (s, i) {
        var on = s.getAttribute('data-spine-step') === n;
        s.classList.toggle('is-active', on);
        // Colour alone cannot carry state (WCAG 1.4.1), and assistive tech
        // needs a programmatic equivalent of "you are here".
        if (on) { s.setAttribute('aria-current', 'step'); idx = i; }
        else { s.removeAttribute('aria-current'); }
      });
      // scaleY, not height: the rail is an auto-height absolute box, so a
      // percentage height never resolved and the fill measured 0px at all
      // five phases. This also keeps us to transform-only animation.
      if (fill && steps.length > 1) {
        fill.style.transform = 'scaleY(' + (idx / (steps.length - 1)) + ')';
      }
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        setActive(entry.target.getAttribute('data-phase'));
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    phases.forEach(function (p) { io.observe(p); });

    // The observer only speaks after a real scroll, so a deep link to
    // #phase-4 left the spine reading "01 The Standard" — every anchor in
    // the brief was broken. Resolve the active phase from geometry instead.
    function syncFromScroll() {
      var mid = window.innerHeight / 2, best = null, bestDist = Infinity;
      phases.forEach(function (p) {
        var b = p.getBoundingClientRect();
        var d = Math.abs((b.top + b.bottom) / 2 - mid);
        if (b.bottom > 0 && b.top < window.innerHeight && d < bestDist) { bestDist = d; best = p; }
      });
      if (best) setActive(best.getAttribute('data-phase'));
    }
    syncFromScroll();
    window.addEventListener('load', syncFromScroll, { once: true });
    window.addEventListener('hashchange', function () { setTimeout(syncFromScroll, 60); });
  }

  /* ---- PIECE 07: SYNERGY — the mechanism, scrubbed by scroll ----
     The one scene on this page driven by scroll POSITION rather than a
     timer. A 250vh block holds a 100svh sticky stage, so there are
     ~1.5 viewport heights of travel; p is where you are inside that.

       p 0.00–0.18  BEAT 1  HCL Breakthrough and MassZymes arrive from
                            opposite edges of the screen.
       p 0.18–0.38  BEAT 2  they converge until they overlap.
       p 0.34–0.58          out of the intersection a third form resolves
                            at 1.85x the diameter of either input, larger
                            than the two of them put together — the overlap
                            yields more than the union, which is literally
                            the claim. It is Probiotic Breakthrough: the
                            thing acid and enzymes make possible.
       p 0.50–0.64          the diagram recedes and hands off.
       p 0.54–0.72  BEAT 3  "The Formula", then 1 + 1 = staggered in.
       p 0.66–0.82          the "5" lands LATE, OVERSIZED and on a
                            back-out curve — it overshoots and settles,
                            deliberately not the page's expo-out.
       p 0.86–1.00          hold. ~20vh of stillness before release.

     Rules kept: transform and opacity only, one rAF per scroll event,
     and the CSS resting state is already the finished composition, so a
     reader who never gets here still gets the picture. ------------- */
  function initSynergy() {
    var scene = document.querySelector('[data-synergy]');
    if (!scene) return;

    var E = {};
    scene.querySelectorAll('[data-syn]').forEach(function (n) {
      E[n.getAttribute('data-syn')] = n;
    });
    var glyphs = scene.querySelectorAll('[data-syn-glyph]');
    if (!E.bleed || !E.stage) return;

    /* Full bleed without touching the shared grid. The scene box stays in
       flow; its canvas is offset left by exactly the scene's own distance
       from the viewport edge. `left` on a relatively positioned box shifts
       paint, not layout, so this measurement never chases its own result. */
    function measureBleed() {
      var vw = document.documentElement.clientWidth;
      // A viewport reports 0 mid-resize in some engines. Writing that would
      // collapse the canvas to nothing, so keep the last good measurement.
      if (!vw) return false;
      var r = scene.getBoundingClientRect();
      scene.style.setProperty('--syn-bleed', r.left + 'px');
      scene.style.setProperty('--syn-vw', vw + 'px');
      return true;
    }

    // Readers who asked for less motion get the final still, full-bleed,
    // at its natural height. No pinning, no listeners, nothing to scrub.
    if (reduceMotion.matches) {
      measureBleed();
      window.addEventListener('resize', measureBleed);
      return;
    }

    var geo = { vw: 0, d: 0, shift: 0 };
    function remeasure() {
      if (!measureBleed()) return;
      geo.vw = document.documentElement.clientWidth;
      // offsetWidth is the laid-out width and ignores our transforms.
      geo.d = (E['disc-a'] && E['disc-a'].offsetWidth) || 200;
      // The equation does not exist yet during beats 1-2, so the diagram
      // alone would sit high in an off-balance stage. Offset the column by
      // exactly enough to centre the part that IS visible, then let it
      // settle back to zero as the equation arrives.
      var gap = parseFloat(getComputedStyle(E.inner).rowGap) || 0;
      var head = (E.eyebrow ? E.eyebrow.offsetHeight : 0) + gap +
                 (E.venn ? E.venn.offsetHeight : 0);
      geo.shift = Math.max(0, Math.round((E.inner.offsetHeight - head) / 2));
    }

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
    function eo(t) { return 1 - Math.pow(1 - t, 3); }          // the page's voice
    function mix(a, b, t) { return a + (b - a) * t; }
    function backOut(t) {                                       // the "5" only
      var s = 2.2, u = t - 1;
      return 1 + (s + 1) * u * u * u + s * u * u;
    }
    function put(n, x, y, s, o) {
      if (!n) return;
      n.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)' +
                          (s === 1 ? '' : ' scale(' + s.toFixed(4) + ')');
      n.style.opacity = o.toFixed(3);
    }

    function render(p) {
      var d = geo.d, vw = geo.vw;
      var apart = d * 0.62;      // beat 1 rest: clear of each other
      var conv = d * 0.34;       // beat 2 rest: overlapping by 0.32d

      var tIn = eo(seg(p, 0.00, 0.18));
      var tSlide = eo(seg(p, 0.03, 0.22));
      var tCv = eo(seg(p, 0.18, 0.38));
      var tGrow = eo(seg(p, 0.34, 0.54));
      var tName = eo(seg(p, 0.46, 0.58));
      var tHand = eo(seg(p, 0.50, 0.64));
      var tForm = eo(seg(p, 0.54, 0.63));
      var tTail = eo(seg(p, 0.74, 0.83));
      var tSum = eo(seg(p, 0.78, 0.86));
      var tTop = eo(seg(p, 0.00, 0.12));

      put(E.eyebrow, 0, mix(16, 0, tTop), 1, tTop);

      // BEAT 1 into BEAT 2, as one continuous journey per input.
      put(E['disc-a'], mix(-(vw / 2 + d), -apart, tIn) + tCv * (apart - conv), 0, 1, 1);
      put(E['disc-b'], mix((vw / 2 + d), apart, tIn) - tCv * (apart - conv), 0, 1, 1);
      put(E['label-a'], mix(-vw * 0.22, 0, tSlide), 0, 1, tSlide);
      put(E['label-b'], mix(vw * 0.22, 0, tSlide), 0, 1, tSlide);

      // The surplus, born at the centre of the lens.
      put(E['disc-c'], 0, 0, 0.10 + 0.90 * tGrow, clamp01(tGrow * 1.8));
      put(E['label-c'], 0, mix(16, 0, tName), 1, tName);

      // Hand-off: the diagram steps back, it does not leave.
      put(E.venn, 0, -6 * tHand, 1 - 0.10 * tHand, 1);
      if (E.field) E.field.style.opacity = (1 - 0.40 * tHand).toFixed(3);
      put(E.inner, 0, geo.shift * (1 - tHand), 1, 1);

      // BEAT 3.
      put(E['eq-label'], 0, mix(14, 0, tForm), 1, tForm);
      for (var i = 0; i < glyphs.length; i++) {
        var g = eo(seg(p, 0.58 + i * 0.02, 0.70 + i * 0.02));
        put(glyphs[i], 0, mix(20, 0, g), 1, g);
      }
      var b5 = backOut(seg(p, 0.66, 0.82));
      put(E.five, 0, mix(-34, 0, b5), 0.34 + 0.66 * b5, clamp01(seg(p, 0.66, 0.74) * 1.2));

      put(E.tail, 0, mix(14, 0, tTail), 1, tTail);
      put(E.sum, 0, mix(14, 0, tSum), 1, tSum);
    }

    var ticking = false, last = -1;
    function frame() {
      ticking = false;
      // If the OS setting flips mid-session, stop scrubbing and leave the
      // finished composition standing rather than wherever the scroll was.
      if (reduceMotion.matches) { scene.classList.remove('is-live'); render(1); return; }
      // Self-heal. A resize event can arrive while the viewport still reports
      // zero, and no second event follows; the scene would then be pinned at
      // the wrong width forever. Two integer compares a frame is cheaper than
      // trusting the event.
      if (document.documentElement.clientWidth !== geo.vw) { remeasure(); last = -1; }
      var r = E.bleed.getBoundingClientRect();
      var travel = r.height - E.stage.offsetHeight;
      // travel <= 0 means the stage was never pinned (short viewport, or the
      // reduced-motion stylesheet won). Show the finished composition.
      var p = travel > 0 ? clamp01(-r.top / travel) : 1;
      if (Math.abs(p - last) < 0.0004) return;
      last = p;
      render(p);
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    }
    function onResize() { remeasure(); last = -1; onScroll(); }

    scene.classList.add('is-live');
    remeasure();
    frame();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('load', onResize, { once: true });
    // Fonts and lazy images change the equation's height, which is what the
    // early lift is measured against. ResizeObserver also covers the viewport
    // changing without a usable resize event.
    if ('ResizeObserver' in window) {
      new ResizeObserver(onResize).observe(document.documentElement);
    }
  }

  /* ---- PIECE 09: stat counters (count once, then rest) ---------- */
  function initCounters() {
    var nums = document.querySelectorAll('[data-count]');
    if (!nums.length || reduceMotion.matches) return;

    // A small number counting from zero spends most of its animation reading
    // "0 Formulation Phases", which looks broken rather than impressive.
    // Counting only earns its place on figures big enough to feel like a tally.
    nums = Array.prototype.filter.call(nums, function (el) {
      return parseInt(el.getAttribute('data-count'), 10) >= 1000;
    });
    if (!nums.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var target = parseInt(el.getAttribute('data-count'), 10);
        var final = el.textContent;
        var start = null;
        var DUR = 1400;
        function tick(ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / DUR, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          if (p < 1) {
            el.textContent = Math.round(target * eased).toLocaleString('en-US');
            requestAnimationFrame(tick);
          } else {
            el.textContent = final;    // restore the exact source string
          }
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });

    Array.prototype.forEach.call(nums, function (n) { io.observe(n); });
  }

  /* ---- Boot ----------------------------------------------------- */
  function boot() {
    // PIECE 07 runs either way: under reduced motion it only measures its
    // full-bleed offset and leaves the finished composition standing.
    initSynergy();
    if (reduceMotion.matches) { revealAllImmediately(); return; }
    initReveals();
    initSpine();
    initCounters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // If the user flips the OS setting mid-session, respect it immediately.
  reduceMotion.addEventListener('change', function (e) {
    if (e.matches) revealAllImmediately();
  });
})();
