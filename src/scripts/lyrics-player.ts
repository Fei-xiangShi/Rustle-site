import '@applemusic-like-lyrics/core/style.css';
import { BackgroundRender, LyricPlayer, MeshGradientRenderer, type LyricLineMouseEvent } from '@applemusic-like-lyrics/core';
import { songs, type CoverKey } from '~/data/lyrics';
import { prefersReducedMotion } from './color';

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const fmt = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

/**
 * Drives AMLL's lyric player and background renderer with a simulated clock.
 * All lyric and background motion comes from AMLL itself.
 */
export function mountLyricsDemo(root: HTMLElement): void {
  const host = root.querySelector<HTMLElement>('[data-viewport]')!;
  const bgHost = root.querySelector<HTMLElement>('[data-bg]')!;
  const coverUrls = JSON.parse(root.dataset.covers!) as Record<CoverKey, string>;
  const titleEl = root.querySelector<HTMLElement>('[data-title]');
  const artistEl = root.querySelector<HTMLElement>('[data-artist]');
  const currentEl = root.querySelector<HTMLElement>('[data-current]');
  const totalEl = root.querySelector<HTMLElement>('[data-total]');
  const track = root.querySelector<HTMLElement>('[data-track]');
  const fill = root.querySelector<HTMLElement>('[data-fill]');
  const playBtn = root.querySelector<HTMLButtonElement>('[data-play]');
  const covers = [...root.querySelectorAll<HTMLElement>('[data-cover]')];
  const reduced = prefersReducedMotion();

  const player = new LyricPlayer();
  player.getElement().classList.add('demo-lyrics');
  // Tall groups (line + translation + background vocals) stay clear of the top fade.
  player.setAlignPosition(0.42);
  host.append(player.getElement());

  const bg = BackgroundRender.new(MeshGradientRenderer);
  bg.getElement().classList.add('demo-bg');
  bgHost.append(bg.getElement());
  bg.setHasLyric(true);
  if (reduced) {
    bg.setStaticMode(true);
    player.setEnableSpring(false);
  }

  let songIndex = 0;
  let time = 0;
  let playing = false;
  let userPaused = false;
  let inView = false;
  let raf = 0;
  let last = 0;
  let shownSecond = -1;

  const song = () => songs[songIndex];

  function paintProgress(): void {
    if (fill) fill.style.transform = `scaleX(${clamp01(time / song().duration)})`;
    const second = Math.floor(time);
    if (second === shownSecond) return;
    shownSecond = second;
    if (currentEl) currentEl.textContent = fmt(time);
    track?.setAttribute('aria-valuenow', String(second));
  }

  function frame(now: number): void {
    raf = 0;
    const delta = Math.min(100, now - last);
    last = now;
    if (playing) {
      time += delta / 1000;
      if (time >= song().duration + 1) {
        load(songIndex + 1);
        return;
      }
    }
    player.setCurrentTime(Math.round(time * 1000));
    player.update(delta);
    paintProgress();
    if (inView && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function kick(): void {
    if (raf || !inView || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function setPlaying(next: boolean): void {
    playing = next;
    if (next) player.resume();
    else player.pause();
    playBtn?.setAttribute('data-state', next ? 'playing' : 'paused');
    playBtn?.setAttribute('aria-label', (next ? playBtn.dataset.labelPause : playBtn.dataset.labelPlay) ?? '');
    kick();
  }

  function seek(seconds: number): void {
    time = Math.max(0, Math.min(song().duration, seconds));
    player.setCurrentTime(Math.round(time * 1000), true);
    userPaused = false;
    setPlaying(true);
  }

  function load(index: number): void {
    songIndex = (index + songs.length) % songs.length;
    const s = song();
    time = 0;
    shownSecond = -1;
    if (titleEl) titleEl.textContent = s.title;
    if (artistEl) artistEl.textContent = s.artist;
    if (totalEl) totalEl.textContent = fmt(s.duration);
    track?.setAttribute('aria-valuemax', String(Math.floor(s.duration)));
    covers.forEach((c, i) => c.toggleAttribute('data-active', i === songIndex));
    void bg.setAlbum(coverUrls[s.cover]);
    player.setLyricLines(s.lines, 0);
    player.update(0);
    paintProgress();
    kick();
  }

  player.addEventListener('line-click', (e) => {
    seek((e as LyricLineMouseEvent).line.getLine().startTime / 1000);
  });

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
      seek(clamp01((e.clientX - rect.left) / rect.width) * song().duration);
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

  document.addEventListener('visibilitychange', kick);
  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView) bg.resume();
      else bg.pause();
      if (inView && !userPaused) setPlaying(true);
      else if (!inView) setPlaying(false);
      kick();
    },
    { threshold: 0.25 },
  ).observe(root);

  load(0);
  root.dataset.ready = '';
}
