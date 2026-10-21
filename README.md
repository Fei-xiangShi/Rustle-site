# Rustle 官网

[Rustle](https://github.com/Fei-xiangShi/Rustle) 的产品官网：纯静态站点，可直接托管到 Cloudflare Workers（静态资源）或 Cloudflare Pages。

- **Astro 7** 静态输出 + **Tailwind CSS v4**
- **GSAP ScrollTrigger + Lenis**：滚动入场、逐字点亮、透视展平
- **WebGL 网格渐变**：复刻应用里「随封面流动的背景」，OKLab 空间过渡调色板
- **歌词演示**：逐词渐变点亮、长音辉光、每行独立弹簧 + 错峰滚动、景深模糊、对唱 / 和声 / 间奏 / 翻译
- **音频引擎演示**：128 条对数频谱（柱状 / 折线）、L/R 电平、可拖拽 10 段 EQ（预设与应用 `EqualizerPreset` 一致）
- **中英双语**：`/` 为简体中文，`/en/` 为英文
- **构建期拉取 GitHub Release**：版本号、发布日期、各平台安装包直链与体积；接口不可用时回退到 `releases/latest`

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

### Cloudflare Pages

```bash
pnpm deploy:pages        # 构建并 wrangler pages deploy dist
```

或在 Pages 控制台连接仓库：构建命令 `pnpm run build`，输出目录 `dist`。

### 环境变量（均可选）

| 变量 | 作用 |
| :-- | :-- |
| `SITE_URL` | 站点根地址，用于 canonical、hreflang、OG、sitemap 与 robots.txt，默认 `https://rustle.fxs.life` |
| `GITHUB_TOKEN` | 构建时请求 GitHub Release API 用，避免匿名限流 |

## 内容与素材

| 位置 | 内容 |
| :-- | :-- |
| `src/i18n/zh.ts` / `en.ts` | 全部页面文案 |
| `src/config/site.ts` | 仓库地址、包管理器命令、回退版本号 |
| `src/data/lyrics.ts` | 演示歌词（原创）与配色 |
| `src/scripts/audio-engine.ts` | EQ 预设数值（与应用 `settings.rs` 同步） |
| `scripts/generate-assets.mjs` | 从 Rustle 仓库生成截图、图标、favicon 与 OG 图：`pnpm assets [rustle 仓库路径]` |
| `scripts/subset-cjk-font.mjs` | 按中英文案生成 Noto Serif SC 子集（约 90 KB），`dev` / `build` 前自动运行；离线时沿用已有文件 |

修改中文文案后无需手动处理字体，下次 `dev` / `build` 会自动重新生成子集。
