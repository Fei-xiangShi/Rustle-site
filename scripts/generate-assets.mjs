// Regenerates site imagery: icons from the Rustle repository, Open Graph cards
// from the app screenshots in src/assets/screenshots, and demo album covers.
// Usage: node scripts/generate-assets.mjs [path-to-rustle-repo]
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(process.argv[2] ?? path.join(root, '../../Rust/Rustle'));
const iconSrc = path.join(repo, 'assets/icons/icon.png');

if (!existsSync(iconSrc)) {
  console.error(`Rustle icon not found at ${iconSrc}`);
  process.exit(1);
}

const assetsDir = path.join(root, 'src/assets');
const publicDir = path.join(root, 'public');
await mkdir(publicDir, { recursive: true });

// Source icon for <Image>; 1024px is plenty for every rendered size.
await sharp(iconSrc).resize(1024, 1024).png({ compressionLevel: 9 }).toFile(path.join(assetsDir, 'icon.png'));

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

// Open Graph cards (zh + en): warm gradient, icon, tagline and the lyrics view.
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
      <stop offset="0" stop-color="#5b2a86" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#0b0807" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#a)"/>
  <rect width="100%" height="100%" fill="url(#b)"/>
</svg>`);

const shotW = 760;
const shotH = Math.round((1350 / 2400) * shotW);
const radius = 18;
const shot = await sharp(path.join(assetsDir, 'screenshots', 'lyrics.png'))
  .resize(shotW, shotH)
  .composite([
    {
      input: Buffer.from(`<svg width="${shotW}" height="${shotH}"><rect width="${shotW}" height="${shotH}" rx="${radius}" ry="${radius}"/></svg>`),
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

const cards = {
  'og.png': ['会呼吸的歌词，原生的速度。', '开源免费的网易云音乐第三方桌面播放器', 30],
  'og-en.png': ['Lyrics that breathe. Native speed.', 'Open-source desktop music player', 25],
};
for (const [file, [tagline, sub, size]] of Object.entries(cards)) {
  const text = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <style>
    .t { font-family: 'Georgia', 'Times New Roman', serif; fill: #f6efe7; }
    .s { font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Segoe UI', sans-serif; fill: #f6efe7; }
  </style>
  <text x="72" y="316" class="t" font-size="84">Rustle</text>
  <text x="74" y="378" class="s" font-size="${size}" fill-opacity="0.92">${tagline}</text>
  <text x="74" y="424" class="s" font-size="20" fill-opacity="0.6">${sub}</text>
  <text x="74" y="560" class="s" font-size="18" fill-opacity="0.5">Windows · macOS · Linux</text>
</svg>`);
  await sharp(background)
    .composite([
      { input: shadow, left: 520 - 60, top: 168 - 70 },
      { input: shot, left: 520, top: 168 },
      { input: icon, left: 66, top: 92 },
      { input: text, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, file));
}

// Demo album covers for the AMLL lyrics player (its background samples them).
await mkdir(path.join(assetsDir, 'covers'), { recursive: true });
// Crop inside the squircle so the cover is full-bleed.
const iconSize = (await sharp(iconSrc).metadata()).width ?? 2048;
const inset = Math.round(iconSize * 0.19);
await sharp(iconSrc)
  .flatten({ background: '#d27c3c' })
  .extract({ left: inset, top: inset, width: iconSize - inset * 2, height: iconSize - inset * 2 })
  .resize(640, 640)
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(path.join(assetsDir, 'covers', 'leaves-in-motion.jpg'));
await sharp(
  Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#081a2b"/>
      <stop offset="0.5" stop-color="#14506a"/>
      <stop offset="1" stop-color="#5fb3c4"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#f4ead6" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#f4ead6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#06121f" stop-opacity="0"/>
      <stop offset="1" stop-color="#06121f"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" fill="url(#sky)"/>
  <circle cx="440" cy="190" r="170" fill="url(#glow)"/>
  <circle cx="440" cy="190" r="84" fill="#f4ead6"/>
  <rect y="370" width="640" height="270" fill="url(#ground)"/>
  <rect x="52" y="532" width="536" height="1.5" fill="#ffffff" fill-opacity="0.35"/>
  <text x="52" y="598" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="52" fill="#ffffff" fill-opacity="0.92">Blue Hour</text>
</svg>`),
)
  .jpeg({ quality: 88, mozjpeg: true })
  .toFile(path.join(assetsDir, 'covers', 'blue-hour.jpg'));

console.log('Assets generated from', repo);
