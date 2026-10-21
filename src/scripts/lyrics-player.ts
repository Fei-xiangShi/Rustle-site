import { songs, type DemoSong, type DemoWord } from '~/data/lyrics';
import { prefersReducedMotion } from './color';
import { MeshGradient } from './mesh-gradient';

interface Fill {
  el: HTMLElement;
  start: number;
  end: number;
  glow: boolean;
  p: number;
  g: number;
}

interface Item {
  kind: 'line' | 'dots';
  start: number;
  end: number;
  el: HTMLElement;
  fills: Fill[];
  dots: HTMLElement[];
  top: number;
  y: number;
  vy: number;
  target: number;
  pending: number;
  releaseAt: number;
  scale: number;
  vs: number;
  blur: number;
  opacity: number;
}

const INTERLUDE_MIN = 3.2;
const GAP = 6;
const ANCHOR = 0.3;
const STAGGER_MS = 50;
const STIFFNESS = 110;
const DAMPING = 17;
const INACTIVE_SCALE = 0.955;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const fmt = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

export function mountLyricsDemo(root: HTMLElement): void {
  const viewport = root.querySelector<HTMLElement>('[data-viewport]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-mesh]');
  const titleEl = root.querySelector<HTMLElement>('[data-title]');
  const artistEl = root.querySelector<HTMLElement>('[data-artist]');
  const currentEl = root.querySelector<HTMLElement>('[data-current]');
  const totalEl = root.querySelector<HTMLElement>('[data-total]');
  const track = root.querySelector<HTMLElement>('[data-track]');
  const fill = root.querySelector<HTMLElement>('[data-fill]');
  const playBtn = root.querySelector<HTMLButtonElement>('[data-play]');
  const covers = [...root.querySelectorAll<HTMLElement>('[data-cover]')];
  const reduced = prefersReducedMotion();

  const mesh = canvas ? MeshGradient.create(canvas, songs[0].palette, { speed: 0.9, resolution: 0.4 }) : null;

  let songIndex = 0;
  let song: DemoSong = songs[0];
  let time = 0;
  let playing = false;
  let userPaused = false;
  let inView = false;
  let hovering = false;
  let items: Item[] = [];
  let active = -1;
  let viewportH = 0;
  let raf = 0;
  let last = 0;
  let shownSecond = -1;

  function makeFills(container: HTMLElement, words: DemoWord[], into: Fill[]): void {
    words.forEach((w, i) => {
      if (i > 0) container.append(' ');
      const span = document.createElement('span');
      span.className = 'lx-word';
      if (w.glow) {
        span.dataset.glow = '';
        const chars = [...w.text];
        const step = (w.end - w.start) / chars.length;
        chars.forEach((ch, k) => {
          const c = document.createElement('span');
          c.className = 'lx-char';
          c.textContent = ch;
          span.append(c);
          into.push({ el: c, start: w.start + step * k, end: w.start + step * (k + 1.6), glow: true, p: -1, g: -1 });
        });
      } else {
        span.textContent = w.text;
        into.push({ el: span, start: w.start, end: w.end, glow: false, p: -1, g: -1 });
      }
      container.append(span);
    });
  }

  function makeItem(kind: Item['kind'], start: number, end: number, el: HTMLElement): Item {
    return {
      kind,
      start,
      end,
      el,
      fills: [],
      dots: [],
      top: 0,
      y: 0,
      vy: 0,
      target: 0,
      pending: 0,
      releaseAt: 0,
      scale: INACTIVE_SCALE,
      vs: 0,
      blur: -1,
      opacity: -1,
    };
  }

  function build(): void {
    viewport.replaceChildren();
    items = [];
    let prevEnd = 0;
    song.lines.forEach((ln, index) => {
      if (index > 0 && ln.start - prevEnd >= INTERLUDE_MIN) {
        const el = document.createElement('div');
        el.className = 'lx-line';
        el.setAttribute('aria-hidden', 'true');
        const dots = document.createElement('div');
        dots.className = 'lx-dots';
        dots.append(...[0, 1, 2].map(() => document.createElement('span')));
        el.append(dots);
        const item = makeItem('dots', prevEnd, ln.start - 0.25, el);
        item.dots = [...dots.children] as HTMLElement[];
        el.addEventListener('click', () => seek(item.start));
        items.push(item);
      }

      const el = document.createElement('div');
      el.className = 'lx-line';
      if (ln.duet) el.dataset.duet = '';
      const item = makeItem('line', ln.start, ln.end, el);
      const main = document.createElement('div');
      main.className = 'lx-main';
      makeFills(main, ln.words, item.fills);
      el.append(main);
      if (ln.bg) {
        const bg = document.createElement('div');
        bg.className = 'lx-main lx-bg';
        makeFills(bg, ln.bg, item.fills);
        el.append(bg);
      }
      if (ln.translation) {
        const tr = document.createElement('div');
        tr.className = 'lx-trans';
        tr.textContent = ln.translation;
        el.append(tr);
      }
      el.addEventListener('click', () => seek(ln.start - 0.05));
      items.push(item);
      prevEnd = Math.max(ln.end, ln.bg?.at(-1)?.end ?? 0);
    });
    viewport.append(...items.map((it) => it.el));
    active = -1;
  }

  function layout(): void {
    viewportH = viewport.clientHeight;
    let y = 0;
    for (const it of items) {
      it.top = y;
      y += it.el.offsetHeight + GAP;
    }
    retarget(true);
    // Place lines now: the loop only runs once the demo is properly in view.
    step(performance.now(), 0);
    kick();
  }

  function retarget(snap: boolean): void {
    const anchorIndex = Math.max(0, active);
    const offset = (items[anchorIndex]?.top ?? 0) - viewportH * ANCHOR;
    const now = performance.now();
    items.forEach((it, i) => {
      it.pending = it.top - offset;
      if (snap || reduced) {
        it.y = it.target = it.pending;
        it.vy = 0;
        it.releaseAt = 0;
      } else {
        it.releaseAt = now + Math.max(0, i - anchorIndex + 1) * STAGGER_MS;
      }
    });
  }

  function findActive(t: number): number {
    let idx = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i].start <= t) idx = i;
      else break;
    }
    return idx;
  }

  function resetFills(it: Item | undefined): void {
    if (!it) return;
    for (const f of it.fills) {
      if (f.p !== 0) f.el.style.setProperty('--p', '0');
      if (f.g !== 0) f.el.style.setProperty('--g', '0');
      f.p = 0;
      f.g = 0;
    }
    it.dots.forEach((d) => {
      d.style.setProperty('--p', '0');
      d.style.setProperty('--s', '0');
    });
  }

  function paintActive(it: Item): void {
    if (it.kind === 'dots') {
      const progress = clamp01((time - it.start) / (it.end - it.start));
      const breath = 0.5 + 0.5 * Math.sin(time * Math.PI * 1.25);
      const fade = clamp01((1 - progress) / 0.12);
      it.dots.forEach((d, k) => {
        d.style.setProperty('--p', clamp01(progress * 3 - k).toFixed(3));
        d.style.setProperty('--s', (breath * fade).toFixed(3));
      });
      return;
    }
    for (const f of it.fills) {
      const p = Math.round(clamp01((time - f.start) / (f.end - f.start)) * 1000) / 1000;
      if (p !== f.p) {
        f.el.style.setProperty('--p', String(p));
        f.p = p;
      }
      if (f.glow) {
        const g = Math.round(Math.sin(Math.PI * clamp01((time - f.start) / (f.end - f.start + 0.9))) * 1000) / 1000;
        if (g !== f.g) {
          f.el.style.setProperty('--g', String(g));
          f.g = g;
        }
      }
    }
  }

  function step(now: number, dt: number): boolean {
    const idx = findActive(time);
    if (idx !== active) {
      resetFills(items[active]);
      active = idx;
      retarget(false);
    }
    if (items[active]) paintActive(items[active]);

    let settled = true;
    items.forEach((it, i) => {
      if (now >= it.releaseAt) it.target = it.pending;
      const scaleTarget = i === active ? 1 : INACTIVE_SCALE;
      if (reduced) {
        it.y = it.target;
        it.scale = scaleTarget;
      } else {
        it.vy += (-STIFFNESS * (it.y - it.target) - DAMPING * it.vy) * dt;
        it.y += it.vy * dt;
        it.vs += (-STIFFNESS * (it.scale - scaleTarget) - DAMPING * it.vs) * dt;
        it.scale += it.vs * dt;
        if (Math.abs(it.y - it.target) > 0.2 || Math.abs(it.vy) > 0.2 || it.target !== it.pending) settled = false;
        if (Math.abs(it.scale - scaleTarget) > 0.0005) settled = false;
      }
      it.el.style.transform = `translate3d(0, ${it.y.toFixed(2)}px, 0) scale(${it.scale.toFixed(4)})`;

      const d = active < 0 ? i + 1 : Math.abs(i - active);
      const blur = hovering || reduced || d === 0 ? 0 : Math.min(d, 4) * 1.15;
      const opacity = d === 0 ? 1 : Math.max(0.3, 1 - d * 0.17);
      if (blur !== it.blur) {
        it.el.style.filter = blur ? `blur(${blur}px)` : 'none';
        it.blur = blur;
      }
      if (opacity !== it.opacity) {
        it.el.style.opacity = String(opacity);
        it.opacity = opacity;
      }
    });
    return settled;
  }

  function paintProgress(): void {
    if (fill) fill.style.transform = `scaleX(${clamp01(time / song.duration)})`;
    const second = Math.floor(time);
    if (second !== shownSecond) {
      shownSecond = second;
      if (currentEl) currentEl.textContent = fmt(time);
      track?.setAttribute('aria-valuenow', String(second));
    }
  }

  function frame(now: number): void {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing) {
      time += dt;
      if (time >= song.duration + 1) {
        load(songIndex + 1);
        return;
      }
    }
    const settled = step(now, dt);
    paintProgress();
    if (inView && !document.hidden && (playing || !settled)) raf = requestAnimationFrame(frame);
  }

  function kick(): void {
    if (raf || !inView) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function setPlaying(next: boolean): void {
    playing = next;
    playBtn?.setAttribute('data-state', next ? 'playing' : 'paused');
    playBtn?.setAttribute('aria-label', (next ? playBtn.dataset.labelPause : playBtn.dataset.labelPlay) ?? '');
    kick();
  }

  function seek(t: number): void {
    time = Math.max(0, Math.min(song.duration, t));
    userPaused = false;
    setPlaying(true);
  }

  function load(index: number): void {
    songIndex = (index + songs.length) % songs.length;
    song = songs[songIndex];
    time = 0;
    shownSecond = -1;
    if (titleEl) titleEl.textContent = song.title;
    if (artistEl) artistEl.textContent = song.artist;
    if (totalEl) totalEl.textContent = fmt(song.duration);
    track?.setAttribute('aria-valuemax', String(Math.floor(song.duration)));
    covers.forEach((c, i) => c.toggleAttribute('data-active', i === songIndex));
    mesh?.setPalette(song.palette, 2400);
    build();
    layout();
  }

  root.querySelector('[data-prev]')?.addEventListener('click', () => {
    if (time > 3) seek(0);
    else load(songIndex - 1);
  });
  root.querySelector('[data-next]')?.addEventListener('click', () => load(songIndex + 1));
  playBtn?.addEventListener('click', () => {
    userPaused = playing;
    setPlaying(!playing);
  });

  if (track) {
    const seekTo = (e: PointerEvent) => {
      const rect = track.getBoundingClientRect();
      seek(clamp01((e.clientX - rect.left) / rect.width) * song.duration);
    };
    track.addEventListener('pointerdown', (e) => {
      track.setPointerCapture(e.pointerId);
      seekTo(e);
      const move = (ev: PointerEvent) => seekTo(ev);
      track.addEventListener('pointermove', move);
      track.addEventListener('pointerup', () => track.removeEventListener('pointermove', move), { once: true });
    });
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') seek(time + 5);
      else if (e.key === 'ArrowLeft') seek(time - 5);
      else return;
      e.preventDefault();
    });
  }

  viewport.addEventListener('pointerenter', () => {
    hovering = true;
    kick();
  });
  viewport.addEventListener('pointerleave', () => {
    hovering = false;
    kick();
  });

  new ResizeObserver(() => layout()).observe(viewport);
  document.fonts?.ready.then(() => layout());
  document.addEventListener('visibilitychange', kick);
  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView && !userPaused) setPlaying(true);
      else if (!inView) setPlaying(false);
      kick();
    },
    { threshold: 0.25 },
  ).observe(root);

  load(0);
}
