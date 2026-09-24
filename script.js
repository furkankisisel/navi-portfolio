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
  const trail = skillChips.map(() => ({ x: 0, y: 0 }));
  const pointerHistory = [];
  const historyGap = 8;
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const canFollow = finePointer && !reducedMotion;
  let tracking = false;
  let skillState = 'appearing';
  let frame;
  let scatterTimer;
  let initialGatherTimer;
  let scatterAnchor = { x: 0, y: 0 };

  skillChips.forEach((chip, index) => chip.style.setProperty('--order', index));
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    if (skillState === 'scattered' && Math.hypot(mouse.x - scatterAnchor.x, mouse.y - scatterAnchor.y) > 18) {
      gatherFromScatter();
    }
  }, { passive: true });

  const inView = (rect) => rect.bottom > window.innerHeight * 0.7 && rect.top < window.innerHeight * 0.8;
  const updateSkillVisibility = () => {
    skillOrbit.classList.toggle('is-offscreen', !inView(skillOrbit.getBoundingClientRect()));
  };
  window.addEventListener('scroll', updateSkillVisibility, { passive: true });
  window.addEventListener('resize', updateSkillVisibility);
  updateSkillVisibility();

  const follow = () => {
    if (tracking) {
      const rect = skillOrbit.getBoundingClientRect();
      if (!inView(rect)) {
        frame = window.requestAnimationFrame(follow);
        return;
      }
      const radius = skillChips[0].offsetWidth / 2 + 8;
      const x = Math.max(radius, Math.min(window.innerWidth - radius, mouse.x)) - rect.left;
      const y = Math.max(radius, Math.min(window.innerHeight - radius, mouse.y)) - rect.top;
      pointerHistory.unshift({ x, y });
      pointerHistory.length = Math.min(pointerHistory.length, skillChips.length * historyGap + 1);

      trail.forEach((dot, index) => {
        const delayedTarget = pointerHistory[Math.min(index * historyGap, pointerHistory.length - 1)];
        const easing = index === 0 ? 0.045 : 0.032;
        dot.x += (delayedTarget.x - dot.x) * easing;
        dot.y += (delayedTarget.y - dot.y) * easing;
        const chip = skillChips[index];
        chip.style.setProperty('--snake-x', `${dot.x - chip.offsetWidth / 2}px`);
        chip.style.setProperty('--snake-y', `${dot.y - chip.offsetHeight / 2}px`);
      });
    }
    frame = window.requestAnimationFrame(follow);
  };

  const gatherFromScatter = () => {
    if (skillState !== 'scattered') return;
    const rect = skillOrbit.getBoundingClientRect();
    skillChips.forEach((chip, index) => {
      const chipRect = chip.getBoundingClientRect();
      trail[index].x = chipRect.left - rect.left + chipRect.width / 2;
      trail[index].y = chipRect.top - rect.top + chipRect.height / 2;
      chip.style.setProperty('--snake-x', `${trail[index].x - chip.offsetWidth / 2}px`);
      chip.style.setProperty('--snake-y', `${trail[index].y - chip.offsetHeight / 2}px`);
    });
    skillOrbit.classList.remove('is-scattering');
    skillOrbit.classList.add('is-gathering');
    pointerHistory.length = 0;
    skillState = 'following';
    tracking = true;
  };

  const scatter = () => {
    if (reducedMotion || !skillOrbit.classList.contains('is-revealed')) return;
    window.clearTimeout(scatterTimer);
    window.clearTimeout(initialGatherTimer);
    tracking = false;
    pointerHistory.length = 0;
    skillState = 'exploding';
    scatterAnchor = { x: mouse.x, y: mouse.y };
    const rect = skillOrbit.getBoundingClientRect();
    const mobile = window.innerWidth <= 760;
    skillChips.forEach((chip, index) => {
      const chipRect = chip.getBoundingClientRect();
      const fromX = chipRect.left - rect.left + chipRect.width / 2 - chip.offsetWidth / 2;
      const fromY = chipRect.top - rect.top + chipRect.height / 2 - chip.offsetHeight / 2;
      const styles = getComputedStyle(chip);
      const percentX = parseFloat(styles.getPropertyValue(mobile ? '--mobile-x' : '--start-x'));
      const percentY = parseFloat(styles.getPropertyValue(mobile ? '--mobile-y' : '--start-y'));
      const x = Math.max(8, Math.min(rect.width - chip.offsetWidth - 8, rect.width * (percentX + (Math.random() - .5) * 6) / 100));
      const y = Math.max(8, Math.min(rect.height - chip.offsetHeight - 8, rect.height * (percentY + (Math.random() - .5) * 6) / 100));
      const angle = Math.atan2(y - fromY, x - fromX) || index * Math.PI * 2 / skillChips.length;
      const impulse = 34 + Math.random() * 24;
      chip.style.setProperty('--burst-from-x', `${fromX}px`);
      chip.style.setProperty('--burst-from-y', `${fromY}px`);
      chip.style.setProperty('--burst-mid-x', `${x + Math.cos(angle) * impulse}px`);
      chip.style.setProperty('--burst-mid-y', `${y + Math.sin(angle) * impulse}px`);
      chip.style.setProperty('--scatter-x', `${x}px`);
      chip.style.setProperty('--scatter-y', `${y}px`);
      chip.style.setProperty('--scatter-r', `${(Math.random() - .5) * 22}deg`);
    });
    skillOrbit.classList.remove('is-gathering', 'is-scattering', 'is-exploding');
    void skillOrbit.offsetWidth;
    skillOrbit.classList.add('is-exploding');

    scatterTimer = window.setTimeout(() => {
      skillOrbit.classList.remove('is-exploding');
      skillOrbit.classList.add('is-scattering');
      skillState = 'scattered';
      if (Math.hypot(mouse.x - scatterAnchor.x, mouse.y - scatterAnchor.y) > 18) gatherFromScatter();
    }, 840);
  };

  window.addEventListener('click', (event) => {
    if (!inView(skillOrbit.getBoundingClientRect())) return;
    if (event.target.closest('a, button, input, label, select, textarea')) return;
    scatter();
  });

  const appear = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    appear.disconnect();
    skillOrbit.classList.add('is-revealed');
    if (!canFollow) return;
    frame = window.requestAnimationFrame(follow);
    initialGatherTimer = window.setTimeout(() => {
      if (skillState === 'exploding' || skillState === 'scattered') return;
      const rect = skillOrbit.getBoundingClientRect();
      skillChips.forEach((chip, index) => {
        const chipRect = chip.getBoundingClientRect();
        trail[index].x = chipRect.left - rect.left + chipRect.width / 2;
        trail[index].y = chipRect.top - rect.top + chipRect.height / 2;
        chip.style.setProperty('--snake-x', `${trail[index].x - chipRect.width / 2}px`);
        chip.style.setProperty('--snake-y', `${trail[index].y - chipRect.height / 2}px`);
      });
      skillOrbit.classList.add('is-gathering');
      pointerHistory.length = 0;
      skillState = 'following';
      tracking = true;
    }, 950);
  }, { threshold: 0.35 });

  appear.observe(skillOrbit);
  window.addEventListener('pagehide', () => {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(scatterTimer);
    window.clearTimeout(initialGatherTimer);
  }, { once: true });
}

const navBar = document.querySelector('.nav');
const navMenu = navBar?.querySelector('nav');
const heroSection = document.querySelector('.hero');
const navSections = [...document.querySelectorAll('#hakkimda, #beceriler, #projeler, #iletisim')];

if (navBar && navMenu && heroSection) {
  const brand = navBar.querySelector('.brand');
  const links = [...navMenu.querySelectorAll('a[href^="#"]')];
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
  brand.addEventListener('click', (event) => {
    if (!navBar.classList.contains('is-scrolled')) return;
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
