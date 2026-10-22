import type { APIRoute } from 'astro';
import { GITHUB_URL, SITE } from '~/config/site';
import { getDict } from '~/i18n';
import { getRelease } from '~/lib/release';

// https://llmstxt.org — a plain-text brief for AI search and answer engines.
export const GET: APIRoute = async ({ site }) => {
  const zh = getDict('zh');
  const en = getDict('en');
  const release = await getRelease();
  const home = new URL('/', site);
  const a = release.assets;

  const body = `# ${SITE.name}

> ${en.meta.description}

${zh.meta.description}

## Key facts

- Latest version: v${release.version}${release.publishedAt ? ` (${release.publishedAt.slice(0, 10)})` : ''}
- Platforms: Windows (x86_64), macOS 10.13+ (Apple Silicon, Intel), Linux (AppImage, AUR)
- License: ${SITE.license}, free with no ads
- Built with: Rust, iced, wgpu, cosmic-text, rodio, Symphonia, cpal, SQLx, Tokio
- Third-party client, not affiliated with NetEase Cloud Music

## Features

${en.lyrics.points.map((p) => `- ${p.title}: ${p.desc}`).join('\n')}
- ${en.bento.flow.title}: ${en.bento.flow.desc}
${en.audio.features.map((f) => `- ${f.title}: ${f.desc}`).join('\n')}
- ${en.library.cloud.title}: ${en.library.cloud.desc}
- ${en.library.local.title}: ${en.library.local.desc}
- ${en.library.formats.title}: ${en.library.formats.desc}

## Download

- Windows installer (MSI): ${a.windowsMsi.url}
- Windows portable (EXE): ${a.windowsExe.url}
- macOS Apple Silicon (DMG): ${a.macArm.url}
- macOS Intel (DMG): ${a.macIntel.url}
- Linux (AppImage): ${a.linux.url}
- winget: \`${SITE.winget}\`
- Arch Linux: \`${SITE.aurBin}\` or \`${SITE.aurSource}\`

## FAQ

${en.faq.items.map((i) => `### ${i.q}\n\n${i.a}`).join('\n\n')}

## Links

- [Website (中文)](${home.href})
- [Website (English)](${new URL('/en/', site).href})
- [Source code](${GITHUB_URL})
- [Releases](${release.pageUrl})
`;

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
