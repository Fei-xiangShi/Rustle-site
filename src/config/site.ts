export const SITE = {
  name: 'Rustle',
  repo: 'Fei-xiangShi/Rustle',
  /** Used when the GitHub API is unreachable at build time. */
  fallbackVersion: '0.5.5',
  license: 'AGPL-3.0-or-later',
  winget: 'winget install FeiXiangShi.Rustle',
  aurBin: 'yay -S rustle-bin',
  aurSource: 'yay -S rustle',
} as const;

export const GITHUB_URL = `https://github.com/${SITE.repo}`;
export const RELEASES_URL = `${GITHUB_URL}/releases/latest`;
export const ISSUES_URL = `${GITHUB_URL}/issues`;
export const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;

export const AUTHOR = {
  name: 'Fei_xiangShi',
  url: 'https://github.com/Fei-xiangShi',
} as const;

/** Search-console ownership tokens, injected at build time when set. */
export const VERIFICATION: Record<string, string | undefined> = {
  'google-site-verification': process.env.GOOGLE_SITE_VERIFICATION,
  'msvalidate.01': process.env.BING_SITE_VERIFICATION,
  'baidu-site-verification': process.env.BAIDU_SITE_VERIFICATION,
  '360-site-verification': process.env.SO360_SITE_VERIFICATION,
  'sogou_site_verification': process.env.SOGOU_SITE_VERIFICATION,
};
