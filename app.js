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

    // Path 2b: THE SWEEP HAS TO RUN WHILE THE READER SCROLLS, and until this
    // was added it only ran at init, load, hashchange and bfcache restore.
    //
    // That gap had teeth. An element parked outside its own overflow:hidden
    // mask — which is exactly what a masked "climb" reveal is at rest — has a
    // permanently ZERO intersection rect, because IntersectionObserver
    // intersects against ancestor clip rects. It can never satisfy any
    // threshold, so the observer alone will never reveal it. The floor below
    // only reaches down 1.5 viewports, so anything further into the page than
    // that stayed hidden forever on a normal visit. Living Proof's lede — two
    // sentences, the page's persuasion payoff, ~13,000px down — rendered as a
    // blank band. Deep-linking fired sweepVisible and masked it, which is why
    // every fragment-based capture looked correct.
    //
    // sweepVisible measures the UNCLIPPED rect, so it sees what the observer
    // structurally cannot. One rAF-throttled listener, and it takes itself off
    // the moment nothing is left hidden.
    // Throttled on a TIMESTAMP, not on requestAnimationFrame. rAF was the
    // obvious choice and it was wrong: rAF is driven by the rendering
    // lifecycle, which is the very thing that stops in a backgrounded or
    // non-compositing tab — the same condition that silences
    // IntersectionObserver. A floor whose trigger fails under exactly the
    // conditions it exists to survive is not a floor. Measured with rAF
    // throttling in a non-compositing tab: 38 of 44 elements stayed hidden
    // through a full scroll of the page.
    var lastSweep = 0;
    function onScrollSweep() {
      var now = Date.now();
      if (now - lastSweep < 100) return;
      lastSweep = now;
      sweepVisible();
      if (!document.querySelector('[data-reveal]:not(.is-in)')) {
        window.removeEventListener('scroll', onScrollSweep);
      }
    }
    window.addEventListener('scroll', onScrollSweep, { passive: true });

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
    /* WAVE 3 — TIME NOW RUNS IN READING ORDER. The h2 moved to the head of
       the section, so it also moved to the head of the sequence: the greeting
       climbs first (~180ms in, not ~1.45s), the rule under it is drawn next,
       and only then does the sentence start. Previously the section's own
       title was the last thing to arrive in it. */
    function choreograph() {
      var t = START;
      // The title is authored as two lines: it is a composition, not a wrap.
      authored.forEach(function (inner) {
        inner.style.setProperty('--mf-d', t + 'ms');
        t += LINE + 20;
      });
      // The rule under the greeting is drawn from the title's own --mf-d; the
      // two authored lines above carry their own, so nothing inherits this.
      if (title) { title.style.setProperty('--mf-d', t + 'ms'); t += 140; }
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

  /* ---- PIECE 03: phase spine — NAVIGATION -----------------------
     The spine is five real in-page links now, so this function has
     three jobs, and the first one is the one it used not to have:

       1. TRAVEL. A click is a jump: smooth (unless reduced motion),
          hash updated, and FOCUS MOVED to the phase. Everything here
          is an enhancement of an <a href="#phase-n"> that already
          works with the script deleted — the browser jumps and, since
          each .phase carries tabindex="-1", the browser also lands
          focus there by itself. We are only making it smooth and
          keeping the URL honest.
       2. STATE. Mark the active step and mirror it as aria-current on
          the ANCHOR, where assistive tech actually reaches it. Round 1
          set aria-current inside an aria-hidden container, so the page
          had exactly one aria-current and nothing on earth could see
          it.
       3. PROGRESS. Grow the rail fill. Still transform-only, still no
          scroll listener — but the scale is now MEASURED against the
          active row's marker rather than fractioned idx/(n-1), so the
          head of the fill and the drawn marker are the same point even
          when "Never-Ending Evolution" takes two lines and the rows
          stop being evenly spaced.
     ------------------------------------------------------------- */
  function initSpine() {
    var spine = document.querySelector('[data-spine]');
    var phases = document.querySelectorAll('.phase[data-phase]');
    if (!spine || !phases.length) return;

    var steps = spine.querySelectorAll('[data-spine-step]');
    var rail = spine.querySelector('.spine__rail');
    var fill = spine.querySelector('[data-spine-fill]');

    // Where the active row's marker sits, as a 0–1 position along the rail.
    // The marker is a ::before whose `top` is authored in em, so read it back
    // rather than restating the number here and letting the two drift.
    function progressFor(link) {
      if (!rail || !link) return null;
      var railBox = rail.getBoundingClientRect();
      if (!railBox.height) return null;                 // mobile: rail is display:none
      var linkBox = link.getBoundingClientRect();
      var markTop = 0;
      try { markTop = parseFloat(window.getComputedStyle(link, '::before').top) || 0; } catch (e) {}
      var k = (linkBox.top + markTop + 1 - railBox.top) / railBox.height;
      return Math.max(0, Math.min(1, k));
    }

    function setActive(n) {
      var idx = 0, activeLink = null;
      steps.forEach(function (s, i) {
        var on = s.getAttribute('data-spine-step') === n;
        var link = s.querySelector('[data-spine-link]');
        s.classList.toggle('is-active', on);
        // Colour alone cannot carry state (WCAG 1.4.1) — weight and the drawn
        // marker carry it too — and assistive tech needs a programmatic
        // equivalent of "you are here", ON the focusable thing.
        if (link) {
          if (on) { link.setAttribute('aria-current', 'step'); }
          else { link.removeAttribute('aria-current'); }
        }
        if (on) { idx = i; activeLink = link; }
      });
      // scaleY, not height: the rail is an auto-height absolute box, so a
      // percentage height never resolved and the fill measured 0px at all
      // five phases. This also keeps us to transform-only animation.
      if (fill && steps.length > 1) {
        var k = progressFor(activeLink);
        if (k === null) k = idx / (steps.length - 1);
        fill.style.transform = 'scaleY(' + k + ')';
      }
    }

    /* ---- 1. TRAVEL ---- */
    spine.addEventListener('click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('[data-spine-link]') : null;
      if (!link || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      var id = (link.getAttribute('href') || '').slice(1);
      var target = id && document.getElementById(id);
      if (!target) return;                       // let the browser have its go
      e.preventDefault();
      setActive(link.getAttribute('data-spine-link'));   // answer the click at once
      if (window.history && window.history.pushState) window.history.pushState(null, '', '#' + id);
      target.scrollIntoView({
        behavior: reduceMotion.matches ? 'auto' : 'smooth',
        block: 'start'
      });
      // preventScroll, or the focus call re-jumps the page and kills the
      // smooth travel it was supposed to accompany.
      try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
    });

    /* ---- 2/3. STATE + PROGRESS ---- */
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
    // The fill is measured, so a reflow (resize, a label rewrapping, the
    // shell growing past a clamp) has to be re-measured or the head of the
    // line stops landing on its marker.
    window.addEventListener('resize', function () { setTimeout(syncFromScroll, 120); });
  }

  /* ---- PIECE 07: SYNERGY — the mechanism, scrubbed by scroll ----
     The one scene on this page driven by scroll POSITION rather than a
     timer. A 250vh block holds a 100svh sticky stage, so there are
     ~1.5 viewport heights of travel; p is where you are inside that.

     WHAT IS ANIMATED, AND WHAT IS NOT. The CHASSIS — the plate rules,
     the vessels and their arrows, the leader lines, all three names, the
     chart's own labels and THE WHOLE PLACARD, equation included — is
     never touched. It is drawn by CSS and it is there at p=0, which is
     the answer to the round-2 note that arriving at the most important
     section of the page showed a completely empty dark-green viewport.
     What the scroll moves is the MATERIAL running through the rig, and
     only that.

     R4 — THE EQUATION STOPPED BEING ANIMATED, AND THAT IS THE POINT.
     Round 3 staggered "1 + 1 =" in at p 0.72–0.90 and then landed the
     "5" last, on a back-out, directly above the surplus. Producing the
     equation AT THE END OF THE MEASUREMENT is the strongest possible
     statement that the measurement produced it — which is exactly the
     read-out reading that made the figure contradict itself. A stated
     principle is not computed, so it is simply there, complete, from the
     first frame: claim first, evidence after. The "5" is still the
     largest, brightest, only-orange glyph in the scene; it is the climax
     by design rather than by timing.

     THE PAGE'S ONE OVERSHOOT MOVED WITH IT — off the numeral and onto
     the measured surplus, where an instrument going past a ruled level
     and settling above it is not decoration, it is the claim.

       p 0.04–0.20   stage 1 charges: the acid bed fills, its column
                     rises to one contribution on the shared axis.
       p 0.18–0.28   the conduit to stage 2 runs.
       p 0.26–0.42   stage 2: nutrients released, and a second column of
                     exactly the same height. Peers.
       p 0.40–0.50   the conduit to stage 3 runs.
       p 0.48–0.64   stage 3: the population takes the vessel wall; the
                     third column, again one contribution.
       p 0.62–0.72   the outlet elbows DOWN into the total. The apparatus
                     discharges into the thing that measures it.
       p 0.68–0.80   the total rises to the sum-of-parts level.
       p 0.74–0.82   that level is ruled across the plate and named —
                     the total meets it exactly. Nothing exceeds it yet.
       p 0.82–0.96   the surplus grows PAST the ruled level, in orange,
                     on a back-out: it goes over, and settles over.
       p 0.90–1.00   the caption.

     PLAYBACK IS THE SEQUENCE. See cue() below — each specimen is held at
     frame 0 and plays ONCE when its own stage opens.

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
      scene.style.setProperty('--syn-pull', (-r.left) + 'px');
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

    // On a narrow stage the chain turns 90° and runs down the page, so the
    // conduits have to fill on the other axis. THE STYLESHEET OWNS THAT
    // DECISION — it is a container query on the stage, not a viewport
    // breakpoint, so there is no number here to keep in sync with it and get
    // wrong. We read back which way the conduit is actually drawn: horizontal
    // runs carry a top border, vertical ones carry a left border. One
    // computed-style read per remeasure, never per frame.
    var geo = { vw: 0, vertical: false };
    function remeasure() {
      if (!measureBleed()) return;
      geo.vw = document.documentElement.clientWidth;
      var pipe = E['flow-1'] && E['flow-1'].parentElement;
      geo.vertical = pipe ? parseFloat(getComputedStyle(pipe).borderTopWidth) === 0 : false;
    }

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
    // Ease-out-cubic, not the stylesheet's expo-out. A scrub is pushed by the
    // reader, and expo-out spends 90% of its travel in the first 10% of the
    // gesture — under a finger it would arrive instantly and then feel dead
    // for the rest of the scroll. Scrubbed values get a curve you can push.
    function eo(t) { return 1 - Math.pow(1 - t, 3); }
    function mix(a, b, t) { return a + (b - a) * t; }
    // THE PAGE'S ONLY OVERSHOOT, and it stays that way. A play control in
    // PIECE 11 used to run a back-out too; the coherence pass took it off,
    // because if everything that appears overshoots then overshoot stops
    // meaning "more came out than went in" — which is the entire claim this
    // one gesture exists to make.
    //
    // R4 MOVED IT off the "5" and onto the surplus. On a numeral an
    // overshoot is a flourish; on a measured bar crossing a ruled level it
    // is the sentence the figure is there to say, and it is the way a real
    // instrument answers — past the mark, then settling above it. s is 1.9
    // rather than 2.2 because this one has to read as a needle settling,
    // not as a bounce.
    function backOut(t) {
      var s = 1.9, u = t - 1;
      return 1 + (s + 1) * u * u * u + s * u * u;
    }

    // Four verbs, and every one of them is a transform or an opacity.
    // A vessel's SPECIMEN charging in. It settles from 1.06 DOWN to 1 rather
    // than growing from 0.9 up: the bed is now a clipping frame with real
    // footage in it, and any scale below 1 would pull the matter off the
    // vessel wall and show a rim of empty --deep all the way round while it
    // arrived. Scaling down into place keeps the frame covered at every
    // instant, and reads as material settling rather than a box shrinking.
    function charge(n, t) {
      if (!n) return;
      var s = (1.06 - 0.06 * t).toFixed(4);
      n.style.transform = 'scale3d(' + s + ',' + s + ',1)';
      n.style.opacity = t.toFixed(3);
    }
    // A yield column. The whole chart turns 90° on a narrow stage, so a
    // column grows UP on the wide plate and RIGHT on the phone one — same
    // `geo.vertical` read that already steers the conduits, so there is
    // still exactly one place that knows which way the figure is drawn,
    // and it is the stylesheet.
    function rise(n, t) {
      if (!n) return;
      n.style.transform = geo.vertical
        ? 'scale3d(' + t.toFixed(4) + ',1,1)'
        : 'scale3d(1,' + t.toFixed(4) + ',1)';
    }
    function run(n, t) {                          // material along a conduit
      if (!n) return;
      n.style.transform = geo.vertical
        ? 'scale3d(1,' + t.toFixed(4) + ',1)'
        : 'scale3d(' + t.toFixed(4) + ',1,1)';
    }
    // A rule drawn across the plate — which on the phone is a rule drawn
    // DOWN it, because the sum-of-parts level is a vertical dashed line
    // there. Same flip, same single source of truth.
    function wipe(n, t) {
      if (!n) return;
      n.style.transform = geo.vertical
        ? 'scale3d(1,' + t.toFixed(4) + ',1)'
        : 'scale3d(' + t.toFixed(4) + ',1,1)';
    }
    function arrive(n, y, o) {                    // type settling in
      if (!n) return;
      n.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
      n.style.opacity = o.toFixed(3);
    }

    // Where each stage OPENS. One array, read by both the drawing and the
    // footage, so the build and the playback cannot drift apart — which is
    // the entire round-3 failure this replaces.
    var STAGE = [0.04, 0.26, 0.48];

    function render(p) {
      var s1 = eo(seg(p, STAGE[0], 0.17)), y1 = eo(seg(p, 0.09, 0.20));
      var f1 = eo(seg(p, 0.18, 0.28));
      var s2 = eo(seg(p, STAGE[1], 0.38)), y2 = eo(seg(p, 0.31, 0.42));
      var f2 = eo(seg(p, 0.40, 0.50));
      var s3 = eo(seg(p, STAGE[2], 0.59)), y3 = eo(seg(p, 0.53, 0.64));
      var f3 = eo(seg(p, 0.62, 0.72));

      charge(E['bed-1'], s1); rise(E['bar-1'], y1); run(E['flow-1'], f1);
      charge(E['bed-2'], s2); rise(E['bar-2'], y2); run(E['flow-2'], f2);
      charge(E['bed-3'], s3); rise(E['bar-3'], y3); run(E['flow-3'], f3);
      cue(0, p >= STAGE[0]); cue(1, p >= STAGE[1]); cue(2, p >= STAGE[2]);

      // The total rises and stops DEAD on the ruled level, which is drawn
      // and named the moment it is met. Only then does anything exceed it.
      rise(E['bar-parts'], eo(seg(p, 0.68, 0.80)));
      var tR = eo(seg(p, 0.74, 0.82));
      wipe(E.ref, tR);
      arrive(E.reflabel, mix(8, 0, tR), tR);

      // THE ONE OVERSHOOT ON THIS PAGE. It goes past the level it is being
      // measured against and settles above it — which is the claim.
      rise(E['bar-surplus'], backOut(seg(p, 0.82, 0.96)));

      var tC = eo(seg(p, 0.90, 1.0));
      arrive(E.cap, mix(14, 0, tC), tC);
    }

    var ticking = false, last = -1;
    function frame() {
      ticking = false;
      // If the OS setting flips mid-session, stop scrubbing and leave the
      // finished composition standing rather than wherever the scroll was.
      // Includes the specimens: the clips have to stop too, not just the
      // scrub. settle() parks them on their LAST frame rather than pausing
      // them where they were or rewinding them to an empty vessel — the
      // finished still is the end of the process, which is the same frame
      // the poster carries.
      if (reduceMotion.matches) { settle(); scene.classList.remove('is-live'); render(1); return; }
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

    /* THE SPECIMENS. This code is below the reduced-motion return above, and
       that placement IS the reduced-motion guarantee: a reader who asked for
       less motion never reaches it, so nothing ever calls play() and the
       vessels stand on their poster frames. The markup carries no `autoplay`
       attribute for the same reason one level down — with scripts off, there
       is nothing to start the clips at all.

       R4 — PLAYBACK IS THE SEQUENCE NOW. Round 3 started all three clips from
       ONE observer on the whole scene, 300px early, on `loop`, with no
       per-stage reset. So the three vessels the scroll fades in one at a time
       were all already running, at whatever phase the reader's scroll speed
       happened to land them on: the build said "first this, then this, then
       this" and the footage said "everything has been happening the whole
       time". In a figure whose entire argument is SEQUENCE, the motion
       contradicted the drawing.

       Each clip is now held at frame 0 and cued by its OWN stage: on the
       stage opening it seeks to 0 and starts; on the stage closing (a reader
       scrubbing back up) it pauses and rewinds to 0. So what a vessel is
       doing is always exactly what the build says it is doing, at any scroll
       position and at any scroll speed.

       R5 — and once started, it LOOPS. R4 let each clip settle on its last
       frame, which fixed the contradiction above but left the reader looking
       at three static images at the end of the sequence. On luminance-on-black
       culture footage a frozen frame does not read as "resolved", it reads as
       dead, which is the opposite of what this figure claims about the
       material. Looping costs the sequence nothing, because what is gated is
       the FIRST play: a vessel still cannot start before its own stage opens,
       so the reveal is still first-this-then-this, and the reader simply ends
       it with three live specimens instead of three corpses.

       Two separate concerns, deliberately not merged:
         visible  — bytes and decoding. The clips ship preload="none", so a
                    reader who never scrolls this far downloads three posters
                    and no video. The observer promotes them ~300px early and
                    pauses everything the moment the scene leaves, so three
                    videos are never decoding behind the rest of the page.
         onStage  — whether this specimen's stage has been reached at all.
       A clip plays only where both are true. */
    var vids = [E['bed-1'], E['bed-2'], E['bed-3']];
    var onStage = [false, false, false];
    var visible = false, halted = false;

    // These are living cultures shot as luminance on black, and a clip parked
    // on its last frame reads as a dead specimen — the figure's whole claim is
    // that this material is doing something. So each vessel LOOPS.
    //
    // The loop is set here in script rather than as a `loop` attribute in the
    // markup on purpose: the attribute would also be true with scripts off and
    // under reduced motion, and this figure's contract in both of those states
    // is one still frame. Set in JS, the looping cannot outlive the conditions
    // that justify it.
    //
    // What loops is only the RESTING behaviour. The first play of each vessel
    // is still gated to its own stage, so the staged reveal survives intact:
    // acid opens at p=0.04, enzyme at 0.26, colony at 0.48, and each one keeps
    // running from the moment its stage opens. The reader ends the sequence
    // with three live specimens rather than three corpses.
    function start(v) {
      v.loop = true;
      // Autoplay can still be refused (power saving, engine policy). The
      // refusal is not an error worth surfacing: the poster is the settle
      // frame, so the scene simply stays as drawn.
      var q = v.play();
      if (q && q.catch) { q.catch(function () {}); }
    }
    function cue(i, on) {
      var v = vids[i];
      if (halted || !v || onStage[i] === on) return;
      onStage[i] = on;
      // Seeking an element with no data yet is harmless — it is a no-op until
      // metadata lands, and play() starts from 0 regardless.
      try { v.currentTime = 0; } catch (e) {}
      if (on) { if (visible) start(v); }
      else if (!v.paused) { v.pause(); }
    }
    function specimens(on) {
      visible = on;
      for (var i = 0; i < vids.length; i++) {
        var v = vids[i];
        if (!v) continue;
        if (on) {
          if (v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
          // Resume only what the scroll says should be running. A stage the
          // reader has not reached stays on frame 0.
          if (onStage[i] && v.paused && !v.ended) { start(v); }
        } else if (!v.paused) {
          v.pause();
        }
      }
    }
    // Reduced motion, arriving mid-session. Every clip stops ON ITS LAST
    // FRAME — the resolved specimen — because that, and not frame 0 and not
    // wherever the scroll happened to be, is the finished still this figure
    // promises in three other places (no-JS, the poster, and the CSS resting
    // state). A clip with no metadata yet is left alone: it is still showing
    // its poster, which is that same frame.
    function settle() {
      halted = true;
      for (var i = 0; i < vids.length; i++) {
        var v = vids[i];
        if (!v) continue;
        // Clearing the loop FIRST matters: pausing a looping clip still leaves
        // it armed, and any later resume would start it running again in a
        // mode the reader has just asked not to see.
        v.loop = false;
        if (!v.paused) v.pause();
        if (v.duration > 0 && isFinite(v.duration) && v.currentTime < v.duration - 0.06) {
          try { v.currentTime = v.duration - 0.05; } catch (e) {}
        }
      }
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        specimens(entries[entries.length - 1].isIntersecting);
      }, { rootMargin: '300px 0px' }).observe(scene);
    } else {
      specimens(true);
    }

    scene.classList.add('is-live');
    remeasure();
    frame();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('load', onResize, { once: true });
    // Fonts and lazy images change the read-out's height, which changes where
    // the plate sits. ResizeObserver also covers the viewport changing
    // without a usable resize event.
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
          // Ease-out-cubic: a count is a value being read, not an object
          // arriving, and the stylesheet's expo-out would land the number in
          // the first 150ms and then rule the line at nothing for 1.35s.
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

  /* ---- PIECE 11: INSIDE THE BIOLAB -----------------------------
     Two jobs, both of which the stylesheet genuinely cannot do.

     1. The roster stagger is an index, not a hand-written delay.
        :nth-child() would hard-code the count; Seed's equivalent
        board runs nineteen people across four columns, and this
        one should survive growing to that without a CSS edit.

     2. The poster control is gated on the poster. That image is
        lazy and full-bleed, so on a slow connection the reveal can
        fire while the frame is still empty — and the reader gets a
        dark disc and a green arrow floating on nothing, promising
        a film that visibly is not there. The gate is opt-in: CSS
        only hides the control once this function has marked the
        link, so if the script never runs the control still shows.
     -------------------------------------------------------------- */
  function initLab() {
    var roster = document.querySelector('[data-roster]');
    if (roster) {
      Array.prototype.forEach.call(roster.children, function (li, i) {
        li.style.setProperty('--i', i);
      });
    }

    var film = document.querySelector('[data-film]');
    if (!film) return;
    var img = film.querySelector('img');
    if (!img) return;

    film.classList.add('js-film');
    function ready() { film.classList.add('is-ready'); }

    // An image that failed still resolves the gate. A broken poster is
    // a bad look; a permanently invisible play control is a dead end.
    if (img.complete && img.naturalWidth) { ready(); return; }
    img.addEventListener('load', ready, { once: true });
    img.addEventListener('error', ready, { once: true });
    // Floor: decode events can be missed on bfcache restore.
    window.addEventListener('load', ready, { once: true });
    setTimeout(ready, 3000);
  }

  /* ---- PLATE MOTION: the phase photographs, alive on arrival ------
     Three of the phase plates are the first frame of a clip. The clip
     plays ONCE when the reader arrives at it and settles on its last
     frame; leaving the plate rewinds it, so coming back plays it again
     rather than presenting a corpse.

     Deliberately NOT the same rule as PIECE 07. There the footage is
     scrubbed by scroll position because the sequence IS the argument.
     Here the footage is atmosphere: it runs at its own speed, once, and
     then gets out of the way of the prose beside it.

     Every failure path lands on the photograph, which is never removed:
       - reduced motion   -> returns below, before preload is ever set,
                             so not one byte of video is requested
       - scripts off      -> preload="none" and no autoplay attribute
       - autoplay refused -> play() rejects, 'playing' never fires, and
                             .is-on is never added
     `.is-on` is added on the PLAYING event rather than next to the
     play() call, so the layer cannot become visible while it is still a
     black rectangle waiting on the first frame. */
  function initPlateMotion() {
    var vids = [].slice.call(document.querySelectorAll('[data-plate-motion]'));
    if (!vids.length || !('IntersectionObserver' in window)) return;
    if (reduceMotion.matches) return;

    function stop(v) {
      if (!v.paused) v.pause();
      v.classList.remove('is-on');
      try { v.currentTime = 0; } catch (e) {}
    }

    vids.forEach(function (v) {
      v.addEventListener('playing', function () { v.classList.add('is-on'); });
    });

    // Fetch a little before the plate arrives so the first frame is ready
    // when it does, but never on a page the reader does not scroll.
    var plateWarm = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var v = e.target;
        if (v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
      });
    }, { rootMargin: '400px 0px' });
    vids.forEach(function (v) { plateWarm.observe(v); });

    // Play when the plate is properly on screen, not when one pixel of it is.
    var platePlay = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (v.ended || !v.paused) return;
          try { v.currentTime = 0; } catch (err) {}
          var q = v.play();
          // A refusal is not an error worth surfacing - the photograph is
          // already the finished picture.
          if (q && q.catch) q.catch(function () {});
        } else {
          stop(v);
        }
      });
    }, { threshold: 0.4 });
    vids.forEach(function (v) { platePlay.observe(v); });

    // The setting can flip mid-session. Drop back to the photograph.
    var onFlip = function () { if (reduceMotion.matches) vids.forEach(stop); };
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onFlip);
    else if (reduceMotion.addListener) reduceMotion.addListener(onFlip);
  }

  /* ---- Boot ----------------------------------------------------- */
  function boot() {
    // PIECE 11 runs in both motion modes: the stagger indices and the
    // poster gate are structure, not animation.
    initLab();
    // PIECE 07 runs either way: under reduced motion it only measures its
    // full-bleed offset and leaves the finished composition standing.
    initSynergy();
    // PIECE 02 owns its own motion and its own scroll listener; under
    // reduced motion it returns immediately and the still stands.
    initManifesto();
    // PIECE 03 RUNS IN BOTH MOTION MODES. It used to sit below the
    // reduced-motion early return, which was defensible while the spine was
    // an animated progress bar and indefensible the moment it became
    // navigation: a reduced-motion reader deep-linked to #phase-4 got a spine
    // still reading "01 The Standard", no aria-current on the phase they were
    // in, and no click handling. Measured before the fix — reduced motion,
    // /#phase-4, scrollY 5665, phase 4 filling the screen, spine says 01.
    // Its own motion is already neutral here: the fill's transition is zeroed
    // by the global reduced-motion rule, and the jump asks for 'auto'.
    initSpine();
    // Returns immediately under reduced motion, before any preload is set.
    initPlateMotion();
    if (reduceMotion.matches) { revealAllImmediately(); return; }
    initReveals();
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
