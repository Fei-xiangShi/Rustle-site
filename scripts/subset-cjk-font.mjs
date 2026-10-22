// Builds a Noto Serif SC subset containing only the CJK characters that are set
// in the display face (hero, section titles, manifesto…), so Chinese headings
// cost one small woff2 instead of dozens of unicode-range slices. Runs before
// every build; if Google Fonts is unreachable the previous file is kept.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'src/assets/fonts');
const fontFile = path.join(outDir, 'noto-serif-sc-subset.woff2');
const charsFile = path.join(outDir, 'noto-serif-sc-subset.txt');
const FAMILY = 'Noto Serif SC:wght@500';
// CJK punctuation, unified ideographs and full-width forms (matches the
// unicode-range declared in astro.config.mjs).
const CJK = /[　-〿一-鿿＀-￯]/gu;

/** Every string rendered with `font-display` / `.section-title`. */
function displayStrings(d) {
  return [
    ...d.hero.titleLines,
    d.manifesto,
    d.nav.lyrics,
    d.nav.features,
    d.nav.audio,
    d.nav.library,
    d.nav.download,
    d.lyrics.title,
    d.bento.title,
    d.bento.flow.title,
    d.audio.title,
    d.library.title,
    d.gallery.title,
    d.shortcuts.title,
    d.faq.title,
    d.download.title,
    d.source.title,
    d.notFound.title,
  ];
}

async function sourceText() {
  try {
    // Node strips TypeScript types natively (22.18+ / 23.6+).
    const dicts = await Promise.all(
      ['zh', 'en'].map((n) => import(pathToFileURL(path.join(root, `src/i18n/${n}.ts`)).href).then((m) => m.default)),
    );
    return dicts.flatMap(displayStrings).join('');
  } catch (error) {
    console.warn('[cjk-font] cannot import dictionaries, subsetting all copy instead:', error.message);
    const files = ['src/i18n/zh.ts', 'src/i18n/en.ts'];
    return (await Promise.all(files.map((f) => readFile(path.join(root, f), 'utf8')))).join('');
  }
}

const chars = [...new Set((await sourceText()).match(CJK) ?? [])].sort().join('');

if (existsSync(fontFile) && existsSync(charsFile) && (await readFile(charsFile, 'utf8')) === chars) {
  console.log(`[cjk-font] up to date (${chars.length} glyphs)`);
  process.exit(0);
}

try {
  const query = new URLSearchParams({ family: FAMILY, text: chars, display: 'swap' });
  const css = await fetch(`https://fonts.googleapis.com/css2?${query}`, {
    // A modern UA makes Google answer with woff2.
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36' },
    signal: AbortSignal.timeout(15000),
  }).then((r) => {
    if (!r.ok) throw new Error(`css2 responded ${r.status}`);
    return r.text();
  });
  const url = css.match(/url\((https:[^)]+)\)/)?.[1];
  if (!url) throw new Error('no font url in css2 response');
  const font = Buffer.from(await fetch(url, { signal: AbortSignal.timeout(15000) }).then((r) => r.arrayBuffer()));

  await mkdir(outDir, { recursive: true });
  await writeFile(fontFile, font);
  await writeFile(charsFile, chars);
  console.log(`[cjk-font] ${chars.length} glyphs → ${(font.length / 1024).toFixed(1)} KB`);
} catch (error) {
  if (!existsSync(fontFile)) {
    console.error('[cjk-font] failed and no previous subset exists:', error.message);
    process.exit(1);
  }
  console.warn('[cjk-font] keeping previous subset:', error.message);
}
