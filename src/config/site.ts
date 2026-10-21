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
