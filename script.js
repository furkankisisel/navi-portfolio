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
  '.navi-note', '.navi-hint'
].join(',');

const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
const firefly = { x: pointer.x, y: pointer.y };
let lensTarget = null;

function getReadableTarget(x, y) {
  const target = document.elementFromPoint(x, y);
  return target?.closest(readableSelector) || null;
}

function updateLensTarget(nextTarget) {
  if (lensTarget === nextTarget) return;
  lensTarget?.classList.remove('is-lens-target');
  lensTarget = nextTarget;
  lensTarget?.classList.add('is-lens-target');
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
    const readableTarget = getReadableTarget(event.clientX, event.clientY);
    orb.classList.toggle('is-reading', Boolean(readableTarget));
    updateLensTarget(readableTarget);
    updateFallbackNavi(event);
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', () => {
    orb.classList.remove('is-visible', 'is-reading');
    updateLensTarget(null);
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

const rotatingRole = document.querySelector('.hero-rotating');
const roles = [
  'mobil deneyimlere',
  'yapay zekâya',
  'güvenli bağlantılara',
  'akıllı sistemlere'
];

if (rotatingRole && !reducedMotion) {
  let roleIndex = 0;
  window.setInterval(() => {
    const outgoing = rotatingRole.querySelector('.hero-phrase');
    const incoming = document.createElement('span');
    incoming.className = 'hero-phrase is-entering';
    roleIndex = (roleIndex + 1) % roles.length;
    incoming.textContent = roles[roleIndex];
    outgoing.setAttribute('aria-hidden', 'true');
    rotatingRole.append(incoming);
    window.requestAnimationFrame(() => {
      outgoing.classList.add('is-leaving');
      incoming.classList.remove('is-entering');
    });
    window.setTimeout(() => outgoing.remove(), 760);
  }, 3400);
}

const skillOrbit = document.querySelector('.skill-orbit');
const skillChips = [...document.querySelectorAll('.skill-chip')];

if (skillOrbit && skillChips.length) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const network = document.createElementNS(svgNS, 'svg');
  network.setAttribute('class', 'constellation-lines');
  network.setAttribute('aria-hidden', 'true');
  skillOrbit.prepend(network);
  const signal = document.createElement('span');
  signal.className = 'constellation-signal';
  signal.setAttribute('aria-hidden', 'true');
  skillOrbit.append(signal);

  const lines = Array.from({ length: 11 }, () => {
    const line = document.createElementNS(svgNS, 'line');
    network.append(line);
    return line;
  });
  let frame = 0;
  let lastPointer = null;

  const positionChips = () => {
    const mobile = window.innerWidth <= 760;
    skillChips.forEach((chip, index) => {
      const styles = getComputedStyle(chip);
      chip.style.setProperty('--order', index);
      chip.style.setProperty('--const-x', styles.getPropertyValue(mobile ? '--mobile-x' : '--start-x'));
      chip.style.setProperty('--const-y', styles.getPropertyValue(mobile ? '--mobile-y' : '--start-y'));
      chip.style.setProperty('--float-delay', `${-index * .41}s`);
      chip.style.setProperty('--float-duration', `${6.5 + (index % 5) * .72}s`);
    });
  };

  const clearNetwork = () => {
    lines.forEach((line) => line.classList.remove('is-visible'));
    skillChips.forEach((chip) => chip.classList.remove('is-near'));
    signal.classList.remove('is-visible');
  };

  const drawNetwork = () => {
    frame = 0;
    if (!lastPointer || !finePointer || reducedMotion) return;
    const rect = skillOrbit.getBoundingClientRect();
    if (lastPointer.x < rect.left || lastPointer.x > rect.right || lastPointer.y < rect.top || lastPointer.y > rect.bottom) {
      clearNetwork();
      return;
    }
    const pointer = { x: lastPointer.x - rect.left, y: lastPointer.y - rect.top };
    const nodes = skillChips.map((chip, index) => {
      const chipRect = chip.getBoundingClientRect();
      const x = chipRect.left - rect.left + chipRect.width / 2;
      const y = chipRect.top - rect.top + chipRect.height / 2;
      return { chip, index, x, y, distance: Math.hypot(x - pointer.x, y - pointer.y) };
    }).filter((node) => node.distance < 310).sort((a, b) => a.distance - b.distance).slice(0, 6);

    signal.style.setProperty('--signal-x', `${pointer.x}px`);
    signal.style.setProperty('--signal-y', `${pointer.y}px`);
    signal.classList.toggle('is-visible', nodes.length > 0);
    skillChips.forEach((chip) => chip.classList.remove('is-near'));
    nodes.forEach((node) => node.chip.classList.add('is-near'));

    const links = [];
    nodes.forEach((node) => links.push({ from: pointer, to: node }));
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < 250) links.push({ from: nodes[i], to: nodes[j] });
      }
    }
    lines.forEach((line, index) => {
      const link = links[index];
      if (!link) return line.classList.remove('is-visible');
      line.setAttribute('x1', link.from.x);
      line.setAttribute('y1', link.from.y);
      line.setAttribute('x2', link.to.x);
      line.setAttribute('y2', link.to.y);
      line.classList.add('is-visible');
    });
  };

  const scheduleNetwork = () => {
    if (!frame) frame = window.requestAnimationFrame(drawNetwork);
  };

  positionChips();
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    lastPointer = { x: event.clientX, y: event.clientY };
    scheduleNetwork();
  }, { passive: true });
  skillOrbit.addEventListener('pointerleave', clearNetwork);
  window.addEventListener('resize', () => {
    positionChips();
    scheduleNetwork();
  });

  skillOrbit.addEventListener('click', (event) => {
    if (event.target.closest('a, button, input, label, select, textarea')) return;
    const bounds = skillOrbit.getBoundingClientRect();
    const mobile = window.innerWidth <= 760;
    const edge = mobile ? 12 : 8;
    skillOrbit.classList.remove('is-reflowing');
    skillChips.forEach((chip, index) => {
      const x = edge + Math.random() * (100 - edge * 2);
      const y = edge + Math.random() * (100 - edge * 2);
      chip.style.setProperty('--const-x', `${x}%`);
      chip.style.setProperty('--const-y', `${y}%`);
      chip.style.setProperty('--reflow-delay', `${index * 22}ms`);
    });
    void bounds.width;
    skillOrbit.classList.add('is-reflowing');
    window.setTimeout(() => skillOrbit.classList.remove('is-reflowing'), 780);
    scheduleNetwork();
  });

  const appear = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    skillOrbit.classList.add('is-revealed');
    appear.disconnect();
  }, { threshold: 0.25 });
  appear.observe(skillOrbit);
  window.addEventListener('pagehide', () => window.cancelAnimationFrame(frame), { once: true });
}

const navBar = document.querySelector('.nav');
const navMenu = navBar?.querySelector('nav');
const heroSection = document.querySelector('.hero');
const navSections = [...document.querySelectorAll('#hakkimda, #beceriler, #projeler, #iletisim')];

const contactForm = document.querySelector('[data-contact-form]');
if (contactForm) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    const fields = new FormData(contactForm);
    const name = fields.get('name').trim();
    const email = fields.get('email').trim();
    const message = fields.get('message').trim();
    const subject = `Portfolyo üzerinden mesaj — ${name}`;
    const body = `Merhaba Furkan,\n\n${message}\n\n— ${name}\n${email}`;
    window.location.href = `mailto:corporate.furkan@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

if (navBar && navMenu && heroSection) {
  const brand = navBar.querySelector('.brand');
  const links = [...navMenu.querySelectorAll('a[href^="#"]')];
  const hoverCapable = window.matchMedia('(hover: hover)');
  let navFrame = 0;
  let navOpen = false;

  const updateNavigation = () => {
    navFrame = 0;
    const pastHero = heroSection.getBoundingClientRect().bottom <= 150;
    if (!pastHero) navOpen = false;
    navBar.classList.toggle('is-scrolled', pastHero);
    navBar.classList.toggle('is-collapsed', pastHero && !navOpen);
    brand.setAttribute('aria-expanded', String(pastHero && navOpen));
    brand.setAttribute('aria-label', pastHero ? `Furkan Çalık — menüyü ${navOpen ? 'kapat' : 'aç'}` : 'Furkan Çalık — başa dön');

    const current = pastHero
      ? [...navSections].reverse().find((section) => section.getBoundingClientRect().top <= window.innerHeight * .38)
      : null;
    const activeLink = links.find((link) => link.hash === `#${current?.id}`);
    links.forEach((link) => {
      if (link === activeLink) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });

    if (activeLink) {
      const menuRect = navMenu.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      navMenu.style.setProperty('--indicator-x', `${linkRect.left - menuRect.left}px`);
      navMenu.style.setProperty('--indicator-y', `${linkRect.top - menuRect.top}px`);
      navMenu.style.setProperty('--indicator-w', `${linkRect.width}px`);
      navMenu.style.setProperty('--indicator-h', `${linkRect.height}px`);
    }
    navMenu.classList.toggle('has-active', Boolean(activeLink));
  };

  const scheduleNavigation = () => {
    if (!navFrame) navFrame = window.requestAnimationFrame(updateNavigation);
  };
  navBar.addEventListener('mouseenter', () => {
    if (!hoverCapable.matches || !navBar.classList.contains('is-scrolled')) return;
    navOpen = true;
    updateNavigation();
  });
  navBar.addEventListener('mouseleave', () => {
    if (!hoverCapable.matches || !navOpen) return;
    navOpen = false;
    updateNavigation();
  });
  navBar.addEventListener('focusin', () => {
    if (!navBar.classList.contains('is-scrolled')) return;
    navOpen = true;
    updateNavigation();
  });
  navBar.addEventListener('focusout', () => {
    window.requestAnimationFrame(() => {
      if (!hoverCapable.matches && navBar.contains(document.activeElement)) return;
      if (!navBar.contains(document.activeElement) && navOpen) {
        navOpen = false;
        updateNavigation();
      }
    });
  });
  brand.addEventListener('click', (event) => {
    if (!navBar.classList.contains('is-scrolled') || hoverCapable.matches) return;
    event.preventDefault();
    navOpen = !navOpen;
    updateNavigation();
  });
  links.forEach((link) => link.addEventListener('click', () => {
    navOpen = false;
    scheduleNavigation();
  }));
  document.addEventListener('click', (event) => {
    if (navOpen && !navBar.contains(event.target)) {
      navOpen = false;
      updateNavigation();
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navOpen) {
      navOpen = false;
      updateNavigation();
      brand.focus();
    }
  });
  window.addEventListener('scroll', scheduleNavigation, { passive: true });
  window.addEventListener('resize', scheduleNavigation);
  new ResizeObserver(scheduleNavigation).observe(navBar);
  updateNavigation();
}
