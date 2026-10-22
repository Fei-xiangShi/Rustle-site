import { easeOutCubic, prefersReducedMotion } from './color';

/** Mirrors `EqualizerPreset::values()` in apps/rustle-desktop/src/features/settings.rs. */
export const EQ_PRESETS: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  pop: [-1, -1, 0, 2, 4, 4, 2, 0, -1, -1],
  rock: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  jazz: [3, 2, 1, 2, -2, -2, 0, 1, 2, 3],
  classical: [0, 0, 0, 0, 0, 0, -2, -3, -3, -4],
  electronic: [4, 3, 1, 0, -2, 2, 1, 2, 4, 4],
  hiphop: [5, 4, 2, 3, -1, -1, 2, -1, 2, 3],
  acoustic: [4, 3, 2, 1, 2, 2, 3, 3, 3, 2],
  bass: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
  vocal: [-2, -2, 0, 3, 5, 5, 4, 2, 0, -2],
};

export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

/** SVG geometry shared with AudioSection.astro. */
export const EQ_VIEW = { width: 1000, height: 250, left: 90, right: 950, edgeL: 46, edgeR: 994, floor: 214, mid: 112, half: 92, max: 12 };
export const bandX = (i: number) => EQ_VIEW.left + (i * (EQ_VIEW.right - EQ_VIEW.left)) / (EQ_BANDS.length - 1);
const gainY = (g: number) => EQ_VIEW.mid - (g / EQ_VIEW.max) * EQ_VIEW.half;

const gauss = (x: number, w: number) => Math.exp(-(x * x) / (2 * w * w));
const MELODY = [220, 261.63, 329.63, 293.66, 246.94, 329.63, 392, 349.23];
const BEAT = 60 / 118;

function curvePath(points: [number, number][]): string {
  const pts: [number, number][] = [[EQ_VIEW.edgeL, points[0][1]], ...points, [EQ_VIEW.edgeR, points.at(-1)![1]]];
  let d = `M${pts[0][0]},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0]},${p2[1].toFixed(2)}`;
  }
  return d;
}

export function mountAudioEngine(root: HTMLElement): void {
  const reduced = prefersReducedMotion();
  const canvas = root.querySelector<HTMLCanvasElement>('[data-spectrum]')!;
  const ctx = canvas.getContext('2d')!;
  const svg = root.querySelector<SVGSVGElement>('[data-eq]')!;
  const linePath = svg.querySelector<SVGPathElement>('[data-eq-line]')!;
  const fillPath = svg.querySelector<SVGPathElement>('[data-eq-fill]')!;
  const handles = [...svg.querySelectorAll<SVGGElement>('[data-band]')];
  const tip = svg.querySelector<SVGGElement>('[data-eq-tip]');
  const tipText = tip?.querySelector('text');
  const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  const presetLabel = root.querySelector<HTMLElement>('[data-preset-name]');
  const preamp = root.querySelector<HTMLInputElement>('[data-preamp]');
  const preampOut = root.querySelector<HTMLElement>('[data-preamp-value]');
  const modeButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-mode]')];
  const meterFills = [...root.querySelectorAll<HTMLElement>('[data-meter-fill]')];
  const meterPeaks = [...root.querySelectorAll<HTMLElement>('[data-meter-peak]')];
  const meterDb = root.querySelector<HTMLElement>('[data-meter-db]');

  let gains = [...EQ_PRESETS.flat];
  let tween: { from: number[]; to: number[]; start: number } | null = null;
  let preampDb = 0;
  let mode: 'bars' | 'line' = 'bars';
  let count = 0;
  let freqs: number[] = [];
  let levels = new Float32Array(0);
  let peaks = new Float32Array(0);
  let holds = new Float32Array(0);
  const meter = [0, 0];
  const meterPeak = [0, 0];
  let time = 3.2;
  let last = 0;
  let raf = 0;
  let inView = false;
  let lastDbPaint = 0;

  // ---- equalizer ----
  function gainAt(f: number): number {
    const x = Math.log2(f / EQ_BANDS[0]);
    if (x <= 0) return gains[0];
    const i = Math.min(EQ_BANDS.length - 2, Math.floor(x));
    const k = Math.min(1, x - i);
    return gains[i] + (gains[i + 1] - gains[i]) * k;
  }

  function paintEq(): void {
    const pts = gains.map((g, i) => [bandX(i), gainY(g)] as [number, number]);
    const d = curvePath(pts);
    linePath.setAttribute('d', d);
    fillPath.setAttribute('d', `${d} L${EQ_VIEW.edgeR},${EQ_VIEW.floor} L${EQ_VIEW.edgeL},${EQ_VIEW.floor} Z`);
    handles.forEach((h, i) => h.setAttribute('transform', `translate(${pts[i][0]} ${pts[i][1].toFixed(2)})`));
  }

  function selectPreset(name: string | null): void {
    presetButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === name)));
    if (presetLabel) {
      const btn = presetButtons.find((b) => b.dataset.preset === name);
      presetLabel.textContent = btn?.textContent?.trim() ?? presetLabel.dataset.custom ?? '';
    }
  }

  function applyPreset(name: string): void {
    selectPreset(name);
    tween = { from: [...gains], to: [...EQ_PRESETS[name]], start: performance.now() };
    if (reduced) {
      gains = [...tween.to];
      tween = null;
      paintEq();
    }
    kick(true);
  }

  presetButtons.forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset!)));

  function showTip(i: number | null): void {
    if (!tip || !tipText) return;
    if (i == null) {
      tip.style.opacity = '0';
      return;
    }
    const g = gains[i];
    tipText.textContent = `${g > 0 ? '+' : ''}${g.toFixed(1)} dB`;
    tip.setAttribute('transform', `translate(${bandX(i)} ${gainY(g) - 26})`);
    tip.style.opacity = '1';
  }

  handles.forEach((h, i) => {
    const toGain = (e: PointerEvent) => {
      const m = svg.getScreenCTM();
      if (!m) return;
      const y = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()).y;
      const g = Math.round(((EQ_VIEW.mid - y) / EQ_VIEW.half) * EQ_VIEW.max * 2) / 2;
      gains[i] = Math.max(-EQ_VIEW.max, Math.min(EQ_VIEW.max, g));
      tween = null;
      selectPreset(null);
      paintEq();
      showTip(i);
      kick(true);
    };
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      h.dataset.dragging = '';
      toGain(e);
      const move = (ev: PointerEvent) => toGain(ev);
      h.addEventListener('pointermove', move);
      h.addEventListener(
        'pointerup',
        () => {
          h.removeEventListener('pointermove', move);
          delete h.dataset.dragging;
          showTip(null);
        },
        { once: true },
      );
    });
    h.addEventListener('pointerenter', () => showTip(i));
    h.addEventListener('pointerleave', () => h.dataset.dragging === undefined && showTip(null));
    h.addEventListener('keydown', (e) => {
      const delta = e.key === 'ArrowUp' ? 0.5 : e.key === 'ArrowDown' ? -0.5 : 0;
      if (!delta) return;
      e.preventDefault();
      gains[i] = Math.max(-EQ_VIEW.max, Math.min(EQ_VIEW.max, gains[i] + delta));
      tween = null;
      selectPreset(null);
      paintEq();
      showTip(i);
      h.setAttribute('aria-valuenow', String(gains[i]));
      kick(true);
    });
    h.addEventListener('blur', () => showTip(null));
  });

  preamp?.addEventListener('input', () => {
    preampDb = Number(preamp.value);
    if (preampOut) preampOut.textContent = `${preampDb > 0 ? '+' : ''}${preampDb.toFixed(1)} dB`;
    kick(true);
  });

  modeButtons.forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode as typeof mode;
      modeButtons.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      kick(true);
    }),
  );

  // ---- spectrum ----
  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    allocate(Math.max(48, Math.min(128, Math.floor(w / 7))));
    kick(true);
  }

  // Log-spaced bins, 20 Hz – 20 kHz.
  function allocate(n: number): void {
    if (n === count) return;
    count = n;
    freqs = Array.from({ length: n }, (_, k) => 20 * 1000 ** (k / (n - 1)));
    levels = new Float32Array(n);
    peaks = new Float32Array(n);
    holds = new Float32Array(n);
  }

  function simulate(dt: number): void {
    const t = time;
    const beatPhase = t % BEAT;
    const beatIndex = Math.floor(t / BEAT);
    const kickEnv = Math.exp(-beatPhase * 9);
    const snare = beatIndex % 2 === 1 ? Math.exp(-beatPhase * 7) : 0;
    const hat = Math.exp(-(t % (BEAT / 2)) * 20);
    const f0 = MELODY[beatIndex % MELODY.length];
    const note = 0.55 + 0.45 * Math.exp(-beatPhase * 3);
    let energy = 0;

    for (let k = 0; k < count; k++) {
      const f = freqs[k];
      const oct = Math.log2(f / 100);
      let db = f < 100 ? -24 : -18 - 3.6 * oct;
      db += 22 * kickEnv * gauss(Math.log2(f / 58), 0.8);
      db += 13 * snare * (gauss(Math.log2(f / 220), 0.6) + 0.75 * gauss(Math.log2(f / 3600), 1.2));
      db += 13 * hat * gauss(Math.log2(f / 9500), 0.8);
      db += 15 * gauss(Math.log2(f / (f0 / 2)), 0.1);
      for (let h = 1; h <= 6; h++) db += ((19 * note) / h ** 0.65) * gauss(Math.log2(f / (f0 * h)), 0.07);
      db += (Math.random() - 0.5) * 4.5;
      db += gainAt(f) + preampDb;

      const target = Math.max(0, Math.min(1, (db + 54) / 54));
      const rate = target > levels[k] ? 32 : 7;
      levels[k] += (target - levels[k]) * Math.min(1, dt * rate);
      if (levels[k] >= peaks[k]) {
        peaks[k] = levels[k];
        holds[k] = 0.4;
      } else if ((holds[k] -= dt) < 0) {
        peaks[k] = Math.max(levels[k], peaks[k] - dt * 0.55);
      }
      energy += levels[k] * levels[k];
    }

    const rms = Math.sqrt(energy / count);
    const lr = [rms * (0.96 + 0.04 * Math.sin(t * 6.1)), rms * (0.96 + 0.04 * Math.cos(t * 4.7))];
    lr.forEach((v, i) => {
      const target = Math.min(1, v * 1.25 + kickEnv * 0.12);
      meter[i] += (target - meter[i]) * Math.min(1, dt * (target > meter[i] ? 25 : 6));
      meterPeak[i] = Math.max(meter[i], meterPeak[i] - dt * 0.35);
    });
  }

  function draw(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,240,225,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = Math.round((h * i) / 4) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, 'rgba(224,100,60,0.9)');
    grad.addColorStop(0.5, 'rgba(240,163,94,0.95)');
    grad.addColorStop(1, 'rgba(255,230,196,1)');
    const gap = w / count > 5 ? 2 : 1;
    const bw = Math.max(1, (w - gap * (count - 1)) / count);
    const radius = Math.min(bw / 2, 3);

    if (mode === 'bars') {
      ctx.fillStyle = grad;
      for (let k = 0; k < count; k++) {
        const bh = Math.max(2, levels[k] * (h - 6));
        const x = k * (bw + gap);
        ctx.beginPath();
        ctx.roundRect(x, h - bh, bw, bh, [radius, radius, 0, 0]);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,244,232,0.75)';
      for (let k = 0; k < count; k++) {
        const y = h - Math.max(2, peaks[k] * (h - 6)) - 4;
        ctx.fillRect(k * (bw + gap), y, bw, 1.5);
      }
    } else {
      const xs = (k: number) => k * (bw + gap) + bw / 2;
      const ys = (k: number) => h - Math.max(2, levels[k] * (h - 6));
      ctx.beginPath();
      ctx.moveTo(xs(0), ys(0));
      for (let k = 1; k < count; k++) {
        const mx = (xs(k - 1) + xs(k)) / 2;
        const my = (ys(k - 1) + ys(k)) / 2;
        ctx.quadraticCurveTo(xs(k - 1), ys(k - 1), mx, my);
      }
      ctx.lineTo(xs(count - 1), ys(count - 1));
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f7c58e';
      ctx.shadowColor = 'rgba(240,163,94,0.8)';
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
      fillGrad.addColorStop(0, 'rgba(240,163,94,0.35)');
      fillGrad.addColorStop(1, 'rgba(224,100,60,0)');
      ctx.fillStyle = fillGrad;
      ctx.fill();
    }

    meterFills.forEach((el, i) => (el.style.transform = `scaleY(${meter[i].toFixed(3)})`));
    meterPeaks.forEach((el, i) => (el.style.bottom = `${(meterPeak[i] * 100).toFixed(2)}%`));
    const now = performance.now();
    if (meterDb && now - lastDbPaint > 120) {
      lastDbPaint = now;
      const db = 20 * Math.log10(Math.max(1e-4, (meter[0] + meter[1]) / 2)) - 2;
      meterDb.textContent = `${db.toFixed(1)} dB`;
    }
  }

  function frame(now: number): void {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (tween) {
      const k = easeOutCubic(Math.min(1, (now - tween.start) / 650));
      gains = tween.from.map((g, i) => g + (tween!.to[i] - g) * k);
      paintEq();
      if (k >= 1) tween = null;
    }
    if (!reduced) time += dt;
    simulate(reduced ? 0.05 : dt);
    draw();
    if (inView && !document.hidden && (!reduced || tween)) raf = requestAnimationFrame(frame);
  }

  function kick(force = false): void {
    if (raf || (!inView && !force)) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    kick();
  }).observe(root);
  document.addEventListener('visibilitychange', () => kick());

  // No layout reads or frames at mount; the ResizeObserver and the in-view
  // observer take over once the panel is actually on screen.
  allocate(128);
  gains = [...EQ_PRESETS.pop];
  selectPreset('pop');
  paintEq();
}
