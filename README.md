# Rustle 官网

[Rustle](https://github.com/Fei-xiangShi/Rustle) 的产品官网：纯静态站点，可直接托管到 Cloudflare Workers（静态资源）或 Cloudflare Pages。

- **Astro 7** 静态输出 + **Tailwind CSS v4**，CSS 内联、首屏入场动画纯 CSS 实现
- **歌词演示**：[AMLL](https://github.com/Steve-xmh/applemusic-like-lyrics) 的 `LyricPlayer` 与 `BackgroundRender`（按封面取色的网格渐变），接近视口时才按需加载
- **Lenis** 平滑滚动；滚动显现用单个 IntersectionObserver + CSS 过渡，视差 / 逐字点亮为轻量滚动驱动
- **音频引擎演示**：128 条对数频谱（柱状 / 折线）、L/R 电平、可拖拽 10 段 EQ（预设与应用 `EqualizerPreset` 一致）
- **中英双语**：`/` 为简体中文，`/en/` 为英文
- **构建期拉取 GitHub Release**：版本号、发布日期、各平台安装包直链与体积；接口不可用时回退到 `releases/latest`

## SEO

- 每种语言独立的 title / description / keywords、canonical、`hreflang`（含 `x-default`）、OG / Twitter 卡片（中英文各一张分享图）
- JSON-LD `@graph`：`WebSite`、`Person`、`SoftwareApplication`（版本、下载直链、截图、功能列表、免费 Offer）、`WebPage`、`FAQPage`
- 页面内常见问题（FAQ）可见文本，与结构化数据一致
- `robots` 允许大图预览与完整摘要；百度 `no-transform` / `applicable-device`；Atom 版本订阅
- `sitemap-index.xml`（含 hreflang、lastmod、changefreq、priority）、`robots.txt`、[`llms.txt`](https://llmstxt.org)
- IndexNow 密钥文件与推送脚本；可选百度普通收录推送
- 性能：中文标题字体按实际用字子集化（约 18 KB，`unicode-range` 限定 CJK）、拉丁字体度量匹配回退（无布局偏移）、首屏以下区块 `content-visibility: auto`、WebGL 与 AMLL 延迟到空闲或接近视口时初始化

## 开发

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm check        # 类型检查
pnpm build        # 输出到 dist/
pnpm preview      # 预览 dist/
```

## 部署

### Cloudflare Workers（静态资源，推荐）

`wrangler.jsonc` 已配置为纯静态资源 Worker（无脚本），`_headers` 中设置了长缓存与安全头，404 走 `404.html`。

```bash
pnpm deploy              # 构建并 wrangler deploy
pnpm preview:worker      # 构建后用 wrangler dev 本地模拟
```

Workers Builds 控制台：构建命令 `pnpm run build`，部署命令 `npx wrangler deploy`。

### Cloudflare Pages

```bash
pnpm deploy:pages        # 构建并 wrangler pages deploy dist
```

或在 Pages 控制台连接仓库：构建命令 `pnpm run build`，输出目录 `dist`。

### 部署后通知搜索引擎

```bash
pnpm submit              # IndexNow（Bing / Yandex 等）；设置 BAIDU_PUSH_TOKEN 时同时推送百度
```

### 构建变量（均可选）

| 变量 | 作用 |
| :-- | :-- |
| `SITE_URL` | 站点根地址，用于 canonical、hreflang、OG、sitemap、robots.txt 与 llms.txt，默认 `https://rustle.fxs.life` |
| `GITHUB_TOKEN` | 构建时请求 GitHub Release API 用，避免匿名限流 |
| `GOOGLE_SITE_VERIFICATION` | Google Search Console 验证码 |
| `BING_SITE_VERIFICATION` | Bing Webmaster 验证码（`msvalidate.01`） |
| `BAIDU_SITE_VERIFICATION` | 百度搜索资源平台验证码 |
| `SO360_SITE_VERIFICATION` | 360 站长平台验证码 |
| `SOGOU_SITE_VERIFICATION` | 搜狗站长平台验证码 |
| `BAIDU_PUSH_TOKEN` | `pnpm submit` 使用的百度普通收录 token |

## 内容与素材

| 位置 | 内容 |
| :-- | :-- |
| `src/i18n/zh.ts` / `en.ts` | 全部页面文案（含 SEO 标题、描述、关键词与 FAQ） |
| `src/config/site.ts` | 仓库地址、包管理器命令、回退版本号、作者与站长验证 |
| `src/assets/screenshots/` | 应用截图：歌词页（首屏）、首页、音频引擎 |
| `src/data/lyrics.ts` | 演示歌词（原创）与封面 |
| `src/scripts/audio-engine.ts` | EQ 预设数值（与应用 `settings.rs` 同步） |
| `scripts/generate-assets.mjs` | 从 Rustle 仓库生成图标与 favicon，并用截图合成中英文 OG 分享图、演示封面：`pnpm assets [rustle 仓库路径]` |
| `scripts/subset-cjk-font.mjs` | 按标题类文案生成 Noto Serif SC 子集，`dev` / `build` 前自动运行；离线时沿用已有文件 |

## 许可

歌词演示使用的 `@applemusic-like-lyrics/core` 以 AGPL-3.0 授权。
