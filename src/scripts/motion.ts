import Lenis from 'lenis';
import { prefersReducedMotion } from './color';

let lenis: Lenis | null = null;

export function scrollToTarget(target: string | HTMLElement): void {
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.4 });
  else el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function setupNav(): void {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!nav) return;
  const update = () => nav.toggleAttribute('data-scrolled', window.scrollY > 24);
  update();
  window.addEventListener('scroll', update, { passive: true });

  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href')!;
    if (hash.length < 2) return;
    const el = document.querySelector<HTMLElement>(hash);
    if (!el) return;
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('rustle:navigate'));
    scrollToTarget(el);
    history.replaceState(null, '', hash);
  });
}

/**
 * Scroll reveals run on one IntersectionObserver plus CSS transitions (see
 * global.css), so startup never measures layout for dozens of triggers.
 */
function reveals(): void {
  const io = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach((e, i) => {
          const el = e.target as HTMLElement;
          el.style.setProperty('--rd', `${Math.min(i * 0.08, 0.6)}s`);
          el.dataset.revealed = '';
          io.unobserve(el);
        });
    },
    { rootMargin: '0px 0px -12% 0px' },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
}

interface Scrub {
  /** Element whose document position defines the range (never transformed by the scrub). */
  anchor: Element;
  /** Scroll range from the anchor's document top/bottom and the viewport height. */
  range: (top: number, bottom: number, vh: number) => [number, number];
  apply: (progress: number) => void;
  start: number;
  end: number;
  last: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Scroll-linked effects: a few elements, measured on resize, applied per frame. */
function scrubs(): void {
  const list: Scrub[] = [];
  const add = (anchor: Element | null | undefined, range: Scrub['range'], apply: Scrub['apply']) => {
    if (anchor) list.push({ anchor, range, apply, start: 0, end: 1, last: -1 });
  };

  // Hero screenshot flattens from a tilt as it rises into view.
  const shot = document.querySelector<HTMLElement>('[data-hero-shot]');
  add(
    shot?.parentElement,
    (top, _bottom, vh) => [top - vh * 0.95, top - vh * 0.25],
    (p) => {
      shot!.style.transform = `rotateX(${(22 * (1 - p)).toFixed(2)}deg) scale(${(0.9 + 0.1 * p).toFixed(4)})`;
    },
  );

  // Hero glow drifts down and fades while the hero scrolls away.
  const glow = document.querySelector<HTMLElement>('[data-hero-mesh]');
  add(
    glow && document.querySelector('[data-hero]'),
    (top, bottom) => [top, bottom],
    (p) => {
      glow!.style.transform = `translateY(${(18 * p).toFixed(2)}%)`;
      glow!.style.opacity = (1 - 0.65 * p).toFixed(3);
    },
  );

  // Manifesto lights up word by word, like a lyric line being sung.
  const manifesto = document.querySelector<HTMLElement>('[data-manifesto]');
  const parts = manifesto ? [...manifesto.querySelectorAll<HTMLElement>('[data-m]')] : [];
  const spread = 3;
  add(
    manifesto,
    (top, bottom, vh) => [top - vh * 0.78, bottom - vh * 0.45],
    (p) =>
      parts.forEach((el, i) => {
        el.style.opacity = (0.4 + 0.6 * clamp01((p * (parts.length + spread) - i) / spread)).toFixed(3);
      }),
  );

  const update = () => {
    const y = window.scrollY;
    for (const s of list) {
      const p = clamp01((y - s.start) / Math.max(1, s.end - s.start));
      if (Math.abs(p - s.last) < 0.0005) continue;
      s.last = p;
      s.apply(p);
    }
  };
  const measure = () => {
    const vh = window.innerHeight;
    for (const s of list) {
      const r = s.anchor.getBoundingClientRect();
      [s.start, s.end] = s.range(r.top + window.scrollY, r.bottom + window.scrollY, vh);
      s.last = -1;
    }
    update();
  };

  let queued = false;
  window.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        update();
      });
    },
    { passive: true },
  );
  // Layout settles after fonts and images; the body observer re-measures then.
  new ResizeObserver(() => requestAnimationFrame(measure)).observe(document.body);
}

export function initMotion(): void {
  setupNav();
  if (prefersReducedMotion()) return;
  reveals();
  scrubs();
  // Lenis measures the document on construction; let first layout finish on its own.
  const startLenis = () => (lenis = new Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true }));
  if ('requestIdleCallback' in window) requestIdleCallback(startLenis, { timeout: 1500 });
  else setTimeout(startLenis, 300);
}
