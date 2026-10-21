import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { prefersReducedMotion } from './color';

gsap.registerPlugin(ScrollTrigger);

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

function setupSmoothScroll(): void {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function heroIntro(): void {
  const chars = gsap.utils.toArray<HTMLElement>('[data-hero-char]');
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.fromTo(
    '[data-hero-fade]',
    { opacity: 0, y: 16, filter: 'blur(6px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, stagger: 0.08 },
    0.1,
  );
  // Lyric-style light-up: each character brightens and settles in sequence.
  tl.fromTo(
    chars,
    { opacity: 0.12, y: '0.12em', filter: 'blur(10px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, stagger: 0.045 },
    0.25,
  );
  tl.fromTo(
    '[data-hero-after]',
    { opacity: 0, y: 20, filter: 'blur(8px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, stagger: 0.1, clearProps: 'filter' },
    0.9,
  );

  const shot = document.querySelector('[data-hero-shot]');
  if (shot) {
    tl.fromTo(shot, { opacity: 0, y: 80 }, { opacity: 1, y: 0, duration: 1.8 }, 0.9);
    gsap.fromTo(
      shot,
      { rotateX: 22, scale: 0.9 },
      {
        rotateX: 0,
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: shot, start: 'top 95%', end: 'top 25%', scrub: true },
      },
    );
  }

  const glow = document.querySelector('[data-hero-mesh]');
  if (glow) {
    gsap.to(glow, {
      yPercent: 18,
      opacity: 0.35,
      ease: 'none',
      scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true },
    });
  }
}

function reveals(): void {
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => {
      // A long jump (anchor link, scrollbar drag) hands over every element it
      // skipped; only stagger what is actually on screen and show the rest now.
      const visible = batch.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      });
      const skipped = batch.filter((el) => !visible.includes(el));
      if (skipped.length) gsap.set(skipped, { opacity: 1 });
      if (!visible.length) return;
      gsap.fromTo(
        visible,
        { opacity: 0, y: 32, filter: 'blur(8px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1.2,
          ease: 'expo.out',
          stagger: Math.min(0.09, 0.7 / Math.max(1, visible.length)),
          clearProps: 'filter,transform',
        },
      );
    },
  });
}

function manifesto(): void {
  const el = document.querySelector<HTMLElement>('[data-manifesto]');
  if (!el) return;
  const parts = el.querySelectorAll('[data-m]');
  gsap.fromTo(
    parts,
    { opacity: 0.14 },
    {
      opacity: 1,
      ease: 'none',
      stagger: 0.12,
      scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 45%', scrub: 0.6 },
    },
  );
}

function counters(): void {
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target) || target === 0) return;
    const state = { v: 0 };
    el.textContent = '0';
    ScrollTrigger.create({
      trigger: el,
      start: 'top 92%',
      once: true,
      onEnter: () =>
        gsap.to(state, {
          v: target,
          duration: target > 100 ? 1.8 : 1.2,
          ease: 'expo.out',
          onUpdate: () => (el.textContent = String(Math.round(state.v))),
        }),
    });
  });
}

export function initMotion(): void {
  setupNav();
  if (prefersReducedMotion()) return;
  setupSmoothScroll();
  heroIntro();
  reveals();
  manifesto();
  counters();
  // Layout settles after fonts and images; keep trigger positions honest.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}
