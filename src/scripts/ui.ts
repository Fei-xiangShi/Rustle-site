import { MeshGradient } from './mesh-gradient';

export type Platform = 'windows' | 'macos' | 'linux';

export function detectPlatform(): Platform | null {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const source = `${nav.userAgentData?.platform ?? ''} ${navigator.userAgent}`.toLowerCase();
  if (/android|iphone|ipad|ipod/.test(source)) return null;
  if (source.includes('win')) return 'windows';
  if (source.includes('mac')) return 'macos';
  if (source.includes('linux') || source.includes('x11')) return 'linux';
  return null;
}

/** Point download CTAs at the visitor's platform and flag the matching card. */
function platformCtas(): void {
  const platform = detectPlatform();
  if (!platform) return;
  document.querySelectorAll<HTMLAnchorElement>('[data-os-cta]').forEach((a) => {
    const href = a.dataset[`href${platform[0].toUpperCase()}${platform.slice(1)}`];
    const label = a.dataset[`label${platform[0].toUpperCase()}${platform.slice(1)}`];
    if (href) a.href = href;
    const text = a.querySelector('[data-os-label]');
    if (label && text) text.textContent = label;
    a.querySelectorAll<HTMLElement>('[data-os-icon]').forEach((i) => (i.hidden = i.dataset.osIcon !== platform));
  });
  document.querySelector(`[data-platform="${platform}"]`)?.setAttribute('data-recommended', '');
}

function copyButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
    let timer = 0;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy ?? '');
      } catch {
        return;
      }
      btn.dataset.copied = '';
      btn.setAttribute('aria-label', btn.dataset.labelCopied ?? '');
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        delete btn.dataset.copied;
        btn.setAttribute('aria-label', btn.dataset.labelCopy ?? '');
      }, 1600);
    });
  });
}

function tabs(): void {
  document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((root) => {
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    const select = (index: number, focus = false) => {
      buttons.forEach((b, i) => {
        const on = i === index;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      panels.forEach((p, i) => p.toggleAttribute('data-active', i === index));
    };
    buttons.forEach((b, i) => {
      b.addEventListener('click', () => select(i));
      b.addEventListener('keydown', (e) => {
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        select((i + dir + buttons.length) % buttons.length, true);
      });
    });
  });
}

const KEY_NAMES: Record<string, string> = {
  ' ': 'Space',
  Control: 'Ctrl',
  Meta: 'Ctrl',
  ArrowRight: '→',
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
};

/** Keycaps in the shortcuts section light up as the matching keys are pressed. */
function keycaps(): void {
  const section = document.querySelector<HTMLElement>('[data-shortcuts]');
  if (!section) return;
  let inView = false;
  new IntersectionObserver(([e]) => (inView = e.isIntersecting), { threshold: 0.3 }).observe(section);
  const caps = (key: string) => section.querySelectorAll<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
  const name = (e: KeyboardEvent) => KEY_NAMES[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  window.addEventListener('keydown', (e) => {
    if (!inView) return;
    caps(name(e)).forEach((c) => c.setAttribute('data-pressed', ''));
  });
  window.addEventListener('keyup', (e) => {
    caps(name(e)).forEach((c) => c.removeAttribute('data-pressed'));
    if (e.key === 'Control' || e.key === 'Meta') caps('Ctrl').forEach((c) => c.removeAttribute('data-pressed'));
  });
  window.addEventListener('blur', () => section.querySelectorAll('[data-pressed]').forEach((c) => c.removeAttribute('data-pressed')));
}

function mobileMenu(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const panel = document.querySelector<HTMLElement>('[data-menu]');
  if (!toggle || !panel) return;
  const set = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    panel.toggleAttribute('data-open', open);
    document.documentElement.toggleAttribute('data-menu-open', open);
  };
  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('rustle:navigate', () => set(false));
  window.addEventListener('keydown', (e) => e.key === 'Escape' && set(false));
}

/** Bento card: cover swatches drive a small mesh gradient. */
function flowCard(): void {
  const root = document.querySelector<HTMLElement>('[data-flow-card]');
  const canvas = root?.querySelector<HTMLCanvasElement>('canvas');
  if (!root || !canvas) return;
  const swatches = [...root.querySelectorAll<HTMLButtonElement>('[data-palette]')];
  const palettes = swatches.map((s) => JSON.parse(s.dataset.palette!) as string[]);
  const mesh = MeshGradient.create(canvas, palettes[0], { speed: 1.1, resolution: 0.35 });
  if (!mesh) return;
  let index = 0;
  let auto = 0;
  const select = (i: number) => {
    index = i;
    swatches.forEach((s, k) => s.setAttribute('aria-pressed', String(k === i)));
    mesh.setPalette(palettes[i], 1800);
  };
  const schedule = () => {
    clearInterval(auto);
    auto = window.setInterval(() => select((index + 1) % palettes.length), 4800);
  };
  swatches.forEach((s, i) =>
    s.addEventListener('click', () => {
      select(i);
      schedule();
    }),
  );
  schedule();
}

/** Soft light that follows the pointer across cards. */
function spotlight(): void {
  document.querySelectorAll<HTMLElement>('[data-spotlight]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

export function initUi(): void {
  spotlight();
  platformCtas();
  copyButtons();
  tabs();
  keycaps();
  mobileMenu();
  flowCard();
}
