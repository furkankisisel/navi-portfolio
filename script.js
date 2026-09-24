const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) entry.target.classList.add('visible');
}), { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

const stage = document.querySelector('.navi-stage');
const navi = document.querySelector('.navi');
const orb = document.querySelector('.cursor-orb');
const finePointer = window.matchMedia('(pointer: fine)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const readableSelector = [
  'h1', 'h2', 'h3', 'p', 'a', 'button', '.eyebrow', '.visual-label',
  '.navi-note', '.navi-hint', '.marquee-track', 'footer'
].join(',');

const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const firefly = { x: pointer.x, y: pointer.y };

function isOverReadableText(x, y) {
  const target = document.elementFromPoint(x, y);
  return Boolean(target && target.closest(readableSelector));
}

function updateFallbackNavi(event) {
  if (!stage || !navi) return;
  const rect = stage.getBoundingClientRect();
  const x = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
  const y = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
  navi.style.setProperty('--nx', `${Math.max(-14, Math.min(14, x * 26))}px`);
  navi.style.setProperty('--ny', `${Math.max(-9, Math.min(9, y * 16))}px`);
  navi.style.setProperty('--nr', `${Math.max(-3, Math.min(3, x * 6))}deg`);
}

if (orb && finePointer) {
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    orb.classList.add('is-visible');
    orb.classList.toggle('is-reading', isOverReadableText(event.clientX, event.clientY));
    updateFallbackNavi(event);
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', () => {
    orb.classList.remove('is-visible', 'is-reading');
  });

  document.documentElement.addEventListener('mouseenter', () => {
    orb.classList.add('is-visible');
  });

  const followFirefly = () => {
    const ease = reducedMotion ? 1 : 0.24;
    firefly.x += (pointer.x - firefly.x) * ease;
    firefly.y += (pointer.y - firefly.y) * ease;
    orb.style.transform = `translate3d(${firefly.x}px, ${firefly.y}px, 0) translate(-50%, -50%)`;
    window.requestAnimationFrame(followFirefly);
  };

  followFirefly();
} else if (orb) {
  orb.hidden = true;
}
