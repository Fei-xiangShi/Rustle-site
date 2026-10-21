// Regenerates site imagery from the Rustle repository.
// Usage: node scripts/generate-assets.mjs [path-to-rustle-repo]
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(process.argv[2] ?? path.join(root, '../../Rust/Rustle'));
const iconSrc = path.join(repo, 'assets/icons/icon.png');
const shotsSrc = path.join(repo, 'assets/screenshots');

if (!existsSync(iconSrc)) {
  console.error(`Rustle icon not found at ${iconSrc}`);
  process.exit(1);
}

const assetsDir = path.join(root, 'src/assets');
const publicDir = path.join(root, 'public');
await mkdir(path.join(assetsDir, 'screenshots'), { recursive: true });
await mkdir(publicDir, { recursive: true });

// Source icon for <Image>; 1024px is plenty for every rendered size.
await sharp(iconSrc).resize(1024, 1024).png({ compressionLevel: 9 }).toFile(path.join(assetsDir, 'icon.png'));

for (const name of ['lyrics_page', 'playlist', 'settings_page']) {
  const src = path.join(shotsSrc, `${name}.png`);
  if (existsSync(src)) await copyFile(src, path.join(assetsDir, 'screenshots', `${name}.png`));
}

const png = (size) => sharp(iconSrc).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
await writeFile(path.join(publicDir, 'favicon-32.png'), await png(32));
await writeFile(path.join(publicDir, 'apple-touch-icon.png'), await png(180));
await writeFile(path.join(publicDir, 'icon-192.png'), await png(192));
await writeFile(path.join(publicDir, 'icon-512.png'), await png(512));

// favicon.ico with embedded PNG frames (supported by every modern browser).
const frames = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) })));
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach(({ size, data }, i) => {
  const entry = 6 + i * 16;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(data.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += data.length;
});
await writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([header, ...frames.map((f) => f.data)]));

// Open Graph card: warm gradient, icon, and the lyrics page screenshot.
const W = 1200;
const H = 630;
const background = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="a" cx="18%" cy="20%" r="75%">
      <stop offset="0" stop-color="#8a3d1c"/>
      <stop offset="0.55" stop-color="#2a140c"/>
      <stop offset="1" stop-color="#0b0807"/>
    </radialGradient>
    <radialGradient id="b" cx="95%" cy="100%" r="60%">
      <stop offset="0" stop-color="#7a1f3d" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#0b0807" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#a)"/>
  <rect width="100%" height="100%" fill="url(#b)"/>
</svg>`);

const shotW = 760;
const shotH = Math.round((1028 / 1908) * shotW);
const radius = 18;
const shot = await sharp(path.join(shotsSrc, 'lyrics_page.png'))
  .resize(shotW, shotH)
  .composite([
    {
      input: Buffer.from(
        `<svg width="${shotW}" height="${shotH}"><rect width="${shotW}" height="${shotH}" rx="${radius}" ry="${radius}"/></svg>`,
      ),
      blend: 'dest-in',
    },
  ])
  .png()
  .toBuffer();
const shadow = await sharp({
  create: { width: shotW + 120, height: shotH + 120, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    {
      input: Buffer.from(
        `<svg width="${shotW}" height="${shotH}"><rect width="${shotW}" height="${shotH}" rx="${radius}" fill="#000" fill-opacity="0.65"/></svg>`,
      ),
      left: 60,
      top: 70,
    },
  ])
  .blur(28)
  .png()
  .toBuffer();
const icon = await png(132);
const text = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <style>
    .t { font-family: 'Georgia', 'Times New Roman', serif; fill: #f6efe7; }
    .s { font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', sans-serif; fill: #f6efe7; }
  </style>
  <text x="72" y="316" class="t" font-size="84">Rustle</text>
  <text x="74" y="378" class="s" font-size="30" fill-opacity="0.92">会呼吸的歌词，原生的速度。</text>
  <text x="74" y="424" class="s" font-size="20" fill-opacity="0.6">纯 Rust · GPU 渲染的桌面音乐播放器</text>
  <text x="74" y="560" class="s" font-size="18" fill-opacity="0.5">Windows · macOS · Linux</text>
</svg>`);

await sharp(background)
  .composite([
    { input: shadow, left: 520 - 60, top: 150 - 70 },
    { input: shot, left: 520, top: 150 },
    { input: icon, left: 66, top: 92 },
    { input: text, left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(publicDir, 'og.png'));

console.log('Assets generated from', repo);
