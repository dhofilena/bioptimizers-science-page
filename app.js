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

  /* ---- Shared reveal observer ---------------------------------- */
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
  }

  /* ---- PIECE 03: phase spine (scroll-animated) ------------------ */
  function initSpine() {
    var spine = document.querySelector('[data-spine]');
    var phases = document.querySelectorAll('.phase[data-phase]');
    if (!spine || !phases.length) return;

    var steps = spine.querySelectorAll('[data-spine-step]');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var n = entry.target.getAttribute('data-phase');
        steps.forEach(function (s) {
          s.classList.toggle('is-active', s.getAttribute('data-spine-step') === n);
        });
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
