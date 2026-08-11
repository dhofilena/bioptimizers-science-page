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
        if (on) idx = i;
      });
      if (fill && steps.length > 1) {
        fill.style.height = (idx / (steps.length - 1) * 100) + '%';
      }
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        setActive(entry.target.getAttribute('data-phase'));
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    phases.forEach(function (p) { io.observe(p); });
  }

  /* ---- PIECE 09: stat counters (count once, then rest) ---------- */
  function initCounters() {
    var nums = document.querySelectorAll('[data-count]');
    if (!nums.length || reduceMotion.matches) return;

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

    nums.forEach(function (n) { io.observe(n); });
  }

  /* ---- Boot ----------------------------------------------------- */
  function boot() {
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
