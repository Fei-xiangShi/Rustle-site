import { RELEASES_URL, SITE } from '~/config/site';

export type AssetKey = 'windowsMsi' | 'windowsExe' | 'macArm' | 'macIntel' | 'linux';

export interface ReleaseAsset {
  name: string;
  url: string;
  /** Bytes; null when only the fallback link is known. */
  size: number | null;
}

export interface ReleaseInfo {
  version: string;
  publishedAt: string | null;
  pageUrl: string;
  checksumsUrl: string | null;
  assets: Record<AssetKey, ReleaseAsset>;
}

const MATCHERS: Record<AssetKey, RegExp> = {
  windowsMsi: /windows.*\.msi$/i,
  windowsExe: /windows.*\.exe$/i,
  macArm: /macos-(arm64|aarch64).*\.dmg$/i,
  macIntel: /macos-(x86_64|x64|intel).*\.dmg$/i,
  linux: /linux.*\.appimage$/i,
};

// Version-less artifact names resolve through GitHub's /latest/download redirect.
const STABLE_NAMES: Record<AssetKey, string | null> = {
  windowsMsi: null,
  windowsExe: 'rustle-windows-x86_64.exe',
  macArm: 'rustle-macos-arm64.dmg',
  macIntel: 'rustle-macos-x86_64.dmg',
  linux: 'rustle-linux-x86_64.AppImage',
};

function fallback(): ReleaseInfo {
  const assets = Object.fromEntries(
    (Object.keys(STABLE_NAMES) as AssetKey[]).map((key) => {
      const name = STABLE_NAMES[key];
      return [
        key,
        name
          ? { name, url: `${RELEASES_URL}/download/${name}`, size: null }
          : { name: 'Rustle.msi', url: RELEASES_URL, size: null },
      ];
    }),
  ) as Record<AssetKey, ReleaseAsset>;
  return {
    version: SITE.fallbackVersion,
    publishedAt: null,
    pageUrl: RELEASES_URL,
    checksumsUrl: null,
    assets,
  };
}

interface GithubRelease {
  tag_name: string;
  html_url: string;
  published_at: string | null;
  assets: { name: string; size: number; browser_download_url: string }[];
}

async function load(): Promise<ReleaseInfo> {
  const base = fallback();
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'rustle-site-build',
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`https://api.github.com/repos/${SITE.repo}/releases/latest`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
    const data = (await res.json()) as GithubRelease;

    const assets = { ...base.assets };
    for (const key of Object.keys(MATCHERS) as AssetKey[]) {
      const hit = data.assets.find((a) => MATCHERS[key].test(a.name));
      if (hit) assets[key] = { name: hit.name, url: hit.browser_download_url, size: hit.size };
    }
    const sums = data.assets.find((a) => /sha256sums/i.test(a.name));

    return {
      version: data.tag_name.replace(/^v/, ''),
      publishedAt: data.published_at,
      pageUrl: data.html_url,
      checksumsUrl: sums?.browser_download_url ?? null,
      assets,
    };
  } catch (error) {
    console.warn(`[release] falling back to v${base.version}:`, (error as Error).message);
    return base;
  }
}

let cached: Promise<ReleaseInfo> | undefined;

/** Latest GitHub release, fetched once per build. */
export function getRelease(): Promise<ReleaseInfo> {
  cached ??= load();
  return cached;
}

export function formatSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
