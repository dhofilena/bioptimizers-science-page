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

  /* ---- PIECE 02: MANIFESTO — the first dark beat -----------------
     This section does not use the shared reveal. Three reasons, all of
     them the same reason: a 900ms expo fade over 28px is invisible, and
     this is the moment the page changes register.

       THE CUT      the seam scales in from the left, 780ms.
       THE CLIMB    every fragment of the sentence is measured into its
                    REAL rendered lines, and each line rises 118% of its
                    own height out of its own mask, 60ms behind the one
                    above it. Transform only — no opacity anywhere in it.
                    The lines are re-measured on resize, because a line
                    break is a fact about the viewport, not about markup.
       THE WIPE     80,648 is uncovered by a --vital bar that sweeps on
                    from the left and off to the right (CSS: mf-wipe).
       THE DRIFT    the leaf ground is parallaxed against scroll position
                    so the dark is a place, not a band.

     One rAF-throttled scroll listener does the drift AND arms the
     reveal from geometry — no second observer, and no 2.5s timer that
     can fire the sequence at a reader who never got here.

     Order of operations matters: .is-armed goes on BEFORE the lines are
     built, so every line is born already inside its mask. If this
     function never runs, or reduced motion is on, the CSS resting state
     is the finished composition — visibility is the floor. ---------- */
  function initManifesto() {
    var sec = document.querySelector('[data-manifesto]');
    if (!sec) return;
    if (reduceMotion.matches) return;      // the authored still, untouched

    var tex = sec.querySelector('[data-mf="texture"]');
    var title = sec.querySelector('.manifesto__title');
    var authored = sec.querySelectorAll('.manifesto__title .mf-line__i');
    var START = 180, LINE = 60, GROUP = 120, TALLY = 260;
    var revealed = false, settled = false, lastStart = START;

    /* Split one fragment into the lines the browser actually drew.
       Words go in as probes, their offsetTop groups them, and the groups
       come back out as masked lines. The plain text is parked on the
       element so a resize can start over from the source string. */
    function linesOf(el) {
      var text = el.getAttribute('data-mf-text');
      if (text === null) {
        text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        el.setAttribute('data-mf-text', text);
      }
      var words = text.split(' ');
      if (!words[0]) return [];

      var probes = [], i;
      el.textContent = '';
      for (i = 0; i < words.length; i++) {
        var probe = document.createElement('span');
        probe.textContent = words[i];
        el.appendChild(probe);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        probes.push(probe);
      }

      var rows = [], top = null;
      for (i = 0; i < probes.length; i++) {
        var y = probes[i].offsetTop;                 // one layout, then reads
        if (top === null || Math.abs(y - top) > 1) { rows.push([]); top = y; }
        rows[rows.length - 1].push(probes[i].textContent);
      }

      el.textContent = '';
      var inners = [];
      for (i = 0; i < rows.length; i++) {
        var mask = document.createElement('span');
        var inner = document.createElement('span');
        mask.className = 'mf-line';
        inner.className = 'mf-line__i';
        inner.textContent = rows[i].join(' ');
        mask.appendChild(inner);
        // A whitespace node between two block boxes renders as nothing, but
        // it keeps the sentence a sentence for anything that reads the DOM
        // instead of the layout — selection, serialisation, assistive tech.
        if (i) el.appendChild(document.createTextNode(' '));
        el.appendChild(mask);
        inners.push(inner);
      }
      return inners;
    }

    /* Delays are cumulative over whatever the measurement produced, so the
       sentence always arrives in reading order — two lines on a wide
       screen or five on a narrow one. */
    function choreograph() {
      var t = START;
      sec.querySelectorAll('[data-mf-split], [data-mf-tally]').forEach(function (unit) {
        if (unit.hasAttribute('data-mf-tally')) {
          unit.style.setProperty('--mf-d', t + 'ms');
          t += TALLY + GROUP;
          return;
        }
        linesOf(unit).forEach(function (inner) {
          inner.style.setProperty('--mf-d', t + 'ms');
          t += LINE;
        });
        t += GROUP;
      });
      // The rule under the sentence is drawn from the title's own --mf-d;
      // the two authored title lines then override it with their own.
      if (title) { title.style.setProperty('--mf-d', t + 'ms'); t += 140; }
      // The title is authored as two lines: it is a composition, not a wrap.
      authored.forEach(function (inner) {
        inner.style.setProperty('--mf-d', t + 'ms');
        t += LINE + 20;
      });
      lastStart = t;
    }

    function reveal() {
      if (revealed) return;
      revealed = true;
      sec.classList.add('is-in');
      // Drop the transitions once the last line has landed: from here the
      // composition is just a picture, and a resize may re-measure it
      // without anything replaying.
      window.setTimeout(function () {
        settled = true;
        sec.classList.add('is-settled');
      }, lastStart + 900);
    }

    // If the OS setting flips mid-session, stop everything and leave the
    // finished composition standing.
    function disarm() {
      sec.classList.remove('is-armed', 'is-in', 'is-settled');
      if (tex) tex.style.transform = 'translate3d(0,0,0) scale(1.18)';
    }

    var ticking = false;
    function frame() {
      ticking = false;
      if (reduceMotion.matches) { disarm(); return; }
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var r = sec.getBoundingClientRect();
      if (r.bottom < -240 || r.top > vh + 240) return;
      // The sentence starts climbing once the dark owns the lower fifth of
      // the screen — the reader is inside the new register by then.
      if (!revealed && r.top < vh * 0.8 && r.bottom > vh * 0.2) reveal();
      if (tex) {
        var p = (vh - r.top) / (vh + r.height);
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        var drift = Math.min(64, r.height * 0.06);
        tex.style.transform =
          'translate3d(0,' + ((p - 0.5) * 2 * drift).toFixed(1) + 'px,0) scale(1.18)';
      }
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    }

    var resizeTimer = null, lastW = 0;
    function onResize() {
      // Mid-sequence is the one moment a re-measure would be felt, so wait.
      if (revealed && !settled) return;
      var w = document.documentElement.clientWidth;
      if (w === lastW) return;
      lastW = w;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(choreograph, 180);
    }

    sec.classList.add('is-armed');     // before the lines exist, never after
    choreograph();
    lastW = document.documentElement.clientWidth;
    frame();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('load', function () { onResize(); onScroll(); }, { once: true });
    reduceMotion.addEventListener('change', function (e) { if (e.matches) disarm(); });
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

  /* ---- PIECE 09: the tally (count once, ruling its own line) ----
     The count is the one figure on this page that earns an animation, so
     it does not run alone: the 2px rule under it is scrubbed by the same
     frame loop, and finishes ruling at the exact instant the number lands
     on 80,648. Number and line are one gesture, ~1500ms. ------------- */
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

    function ruleFor(el) {
      var id = el.getAttribute('data-count-rule');
      return id ? document.getElementById(id) : null;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        io.unobserve(el);
        var target = parseInt(el.getAttribute('data-count'), 10);
        var final = el.textContent;
        var rule = ruleFor(el);
        var start = null;
        var DUR = 1500;
        function tick(ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / DUR, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          if (p < 1) {
            el.textContent = Math.round(target * eased).toLocaleString('en-US');
            if (rule) rule.style.transform = 'scaleX(' + eased.toFixed(4) + ')';
            requestAnimationFrame(tick);
          } else {
            el.textContent = final;    // restore the exact source string
            if (rule) rule.style.transform = '';
          }
        }
        requestAnimationFrame(tick);
      });
    }, {
      // Fire while the figure is still just below the fold. Resetting a
      // six-digit number to "0" in front of the reader looks like a bug;
      // this way the tally is already running by the time it is on screen,
      // and the trigger is close enough to the edge that a figure can never
      // be left sitting at zero.
      rootMargin: '0px 0px 8% 0px', threshold: 0
    });

    Array.prototype.forEach.call(nums, function (n) {
      // Anything already on screen at load keeps its final value: there is
      // no way to count up to a number the reader is already looking at.
      var b = n.getBoundingClientRect();
      if (b.top < (window.innerHeight || document.documentElement.clientHeight)) return;
      var rule = ruleFor(n);
      if (rule) rule.style.transform = 'scaleX(0)';
      io.observe(n);
    });
  }

  /* ---- PIECE 09: the register ----------------------------------
     Five ruled entries, each one written into the wall as you reach it:
     the rule draws left to right (620ms), then the row wipes up from
     behind it (520ms, travelling its own full height inside an overflow
     clip — 72-96px, not the page's shared 28px nudge). Entries that
     arrive together within one burst are stepped 70ms apart so a fast
     scroll still cascades instead of firing as one slab.

     Resting CSS is the finished wall. Only entries still below the fold
     are armed, so nothing the reader can already see ever blinks out. -- */
  function initNumberWall() {
    var wall = document.querySelector('[data-tally]');
    if (!wall || reduceMotion.matches) return;
    if (!('IntersectionObserver' in window)) return;   // leave it finished

    var vh = window.innerHeight || document.documentElement.clientHeight;
    var armed = [];
    Array.prototype.forEach.call(wall.querySelectorAll('[data-entry]'), function (el) {
      if (el.getBoundingClientRect().top < vh) return;
      el.classList.add('is-armed');
      armed.push(el);
    });
    if (!armed.length) return;

    var last = -1e6, burst = 0;
    function play(el) {
      if (el.classList.contains('is-in')) return;
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      burst = (now - last < 150) ? burst + 1 : 0;
      last = now;
      el.style.setProperty('--rd', (burst * 70) + 'ms');
      el.classList.add('is-in');
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        play(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
    armed.forEach(function (el) { io.observe(el); });

    // Same floor the shared reveal system keeps: an armed entry is hidden
    // copy, and hidden copy must never be the final state.
    function sweep() {
      var h = window.innerHeight || document.documentElement.clientHeight;
      armed.forEach(function (el) {
        if (el.classList.contains('is-in')) return;
        var b = el.getBoundingClientRect();
        if (b.top < h && b.bottom > 0) { io.unobserve(el); play(el); }
      });
    }
    window.addEventListener('load', sweep, { once: true });
    window.addEventListener('hashchange', function () { setTimeout(sweep, 60); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) sweep(); });
  }

  /* ---- Boot ----------------------------------------------------- */
  function boot() {
    // PIECE 07 runs either way: under reduced motion it only measures its
    // full-bleed offset and leaves the finished composition standing.
    initSynergy();
    // PIECE 02 owns its own motion and its own scroll listener; under
    // reduced motion it returns immediately and the still stands.
    initManifesto();
    if (reduceMotion.matches) { revealAllImmediately(); return; }
    initReveals();
    initSpine();
    initCounters();
    initNumberWall();
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
