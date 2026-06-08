// Scroll-triggered reveal animations.
// Adds .is-visible to elements with [data-reveal] when they enter the viewport.
// Respects prefers-reduced-motion.

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const targets = document.querySelectorAll('[data-reveal]');

if (reduce) {
  for (const el of targets) el.classList.add('is-visible');
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );
  for (const el of targets) io.observe(el);
}
