# Neo Mahjong 可访问性规格与审计报告

> 项目：neo-mahjong（成都麻将 AI 教学平台）  
> 目标平台：Web / Vercel（桌面 + 移动浏览器）  
> 技术栈：原生 TypeScript + DOM UI + 未启用的 PixiJS 场景 + Vite  
> 审计范围：`src/ui/`、`src/ui/styles/*.css`、`src/store/settingsStore.ts`、`index.html`、`resource/` 及两张 PixPin UI 截图  
> 审计强度：full（基于实际代码事实）

---

## 1. 可访问性分级定义

本规格采用三级递进模型。每一级都有明确的验收口径，可直接作为任务卡口的 Definition of Done。

### 1.1 Basic（基础合规）

**目标**：消除对辅助技术用户的完全阻断，满足 WCAG 2.1 AA 的硬性最低要求。

**验收口径**：

- `lang` 属性与实际显示语言一致。
- 所有可交互元素均为真实 `<button>` / `<a>` / 表单控件，可被 Tab 聚焦。
- 键盘能完成主流程：开始游戏、进行一局、查看结果、打开设置并返回。
- 可见焦点指示器存在且对比明显。
- 所有 `<img>` 与装饰性图形都有恰当的 `alt` / `aria-hidden` 处理。
- 文本与背景对比度达到 WCAG AA：正文 4.5:1，大文本/图形 3:1。
- 无自动播放音频/视频；若存在音频，提供音量与关闭开关。
- 尊重 `prefers-reduced-motion`，所有非必要动效可被减弱。

### 1.2 Standard（标准体验）

**目标**：在 Basic 基础上，让常用辅助技术用户（屏幕阅读器、键盘-only、低视力、轻度色觉差异）能够舒适地完成核心教学与对局流程。

**验收口径**：

- 页面具备 `<main>`、标题层级、地标（landmark）与跳转链接（skip link）。
- 动态内容（轮到自己、吃碰杠胡提示、错误提示、对局结果）通过 `aria-live` / `role="status"` / `role="alert"` 播报。
- 所有表单控件都有显式 `<label for>` 关联或等效 `aria-labelledby` / `aria-label`。
- 支持 200% 浏览器缩放且布局不丢失功能。
- 提供色觉辅助：至少一种高对比 UI 主题或色盲友好牌面模式。
- 关键状态不仅依赖颜色传达（例如当前玩家、选中的牌、可执行动作）。
- 提供一种无需精确定位鼠标的操作方式（键盘快捷键或 Tab + Enter）。

### 1.3 Comprehensive（综合无障碍）

**目标**：覆盖更广泛的残障用户群体，提供可配置、可验证、可审计的无障碍体验，接近 WCAG 2.1 AAA 与《可及性实践》的典范要求。

**验收口径**：

- 完整的颜色重映射：至少提供 Deuteranopia / Protanopia / Tritanopia 三色盲模拟与中性高对比主题。
- 文本缩放可达 200% 以上（结合浏览器缩放与 UI Scale）。
- 支持屏幕阅读器虚拟光标与角色化牌面朗读（例如“三筒”“东风”而非仅符号）。
- 提供音频替代通道：动作音效、倒计时提示、胜负播报；若无音频则提供视觉/震动反馈。
- 提供字幕/解说模式：AI 教练关键建议可通过文字浮层或语音合成输出。
- 完整的键盘矩阵：对局中的所有动作都有对应快捷键，并在 UI 上可见。
- 支持 Windows 高对比 / macOS 增加对比度 / `forced-colors` 媒体查询。
- 建立 CI 自动化：axe-core、Lighthouse accessibility、颜色对比度检查。

---

## 2. 特性矩阵

| 能力 | Basic | Standard | Comprehensive | 当前状态 |
|---|---|---|---|---|
| 语义 HTML / 地标 | 必须的最低结构 | `<main>`、landmark、标题层级 | skip link + 自动化地标测试 | 无 `main`，仅少量 `section` |
| 语言声明 | `lang` 正确 | 动态切换 `lang` | 多语言元数据同步 | `lang="en"` 与应用语言不符 |
| 键盘可达性 | 主流程可 Tab | 全页面可键盘 | 全局快捷键矩阵 | 仅对话框支持 Esc |
| 可见焦点 | 焦点可见 | 焦点高对比 | 支持高对比/反色 | `.btn` 有，`.pixel-btn` 不确定 |
| 屏幕阅读器 | 基本标签 | 动态播报 | 角色化牌面朗读 | 仅 3 处 ARIA 属性 |
| 对比度 AA | 核心文本达标 | 所有文本达标 | AAA 级别 | 部分浅色文字待测 |
| 文本缩放 | 浏览器 100%-150% | 浏览器 200% | 与 UI Scale 叠加 | 仅 UI Scale 0.85-1.35 |
| 色盲友好 | 不依赖颜色唯一信息 | 单一色盲辅助主题 | 三色盲+高对比主题 | 完全缺失 |
| 高对比 / 强制颜色 | 不破坏系统主题 | 适配 `forced-colors` | 专属高对比主题 | 无 |
| 动效减弱 | 支持 `prefers-reduced-motion` | 全动画可减弱 | 零动画模式 | 仅 actionEventFx 一处 |
| 音频替代文本 | 无自动播放 | 音效关闭/开关 | 视觉/震动反馈同步 | 完全无音频层 |
| 字幕 / 解说 | 关键错误可见 | AI 建议文字化 | 语音合成朗读 | 仅文字聊天 |
| 触摸目标 | 移动 44×44 | 全平台 44×44 | 可调更大 | 仅移动端强制 44px |
| 焦点/动作确认 | 点击有视觉反馈 | 操作可撤销提示 | 多通道确认 | 无显式确认通道 |

---

## 3. 当前像素 UI 可访问性审计

> 以下结论均基于 `src/ui/`、`src/ui/styles/*.css`、`index.html`、两张截图的静态代码审计，未运行动态辅助技术测试。

### 3.1 已满足项（基于代码事实）

| 项 | 证据 | 备注 |
|---|---|---|
| 语言切换机制 | `settings.ts` 提供 `zh` / `en` 下拉；`languageStore` 支持双语 | 但 `index.html` 的 `lang` 未同步 |
| 牌面文本回退 | `tileView.ts` 在 `currentLang !== 'zh'` 时显示文字而非图片 | 英语的 `tileToString` 可作为朗读依据 |
| 牌按钮具备可访问名称 | `tileView.ts:207` `aria-label="<tileToString(tile)>"`；`img.alt` 同步 | 仅中文模式下使用图片 |
| 牌桌区域有标签 | `matchTableRenderer.ts:55` `aria-label="<t.tableLabel>"` | 节（section）地标 |
| 装饰头像已隐藏 | `matchTableRenderer.ts:164` 对手头像 `aria-hidden="true"` | 避免屏幕阅读器朗读无意义像素小人 |
| 真实按钮元素 | `pixelFrame.ts`、`matchTableRenderer.ts`、`tileView.ts` 使用 `<button type="button">` | 优于 div 模拟按钮 |
| 动效减弱部分支持 | `actionEventFx.ts:118` 检测 `prefers-reduced-motion: reduce` 并缩短动画时长 | 仅这一处 |
| 字体缩放最小值 | `tokens.css` `--font-body-min: 14px`；`base.css` 使用 `max(var(--font-body-min), ...)` | 防止 UI Scale 过小时文字过小 |
| 触摸目标最小值 | `tokens.css` `--touch-target-min: 44px`；移动媒体查询应用 | 桌面端按钮 `min-height: 40px` 未达 44 |
| 安全区域 | `tokens.css` 使用 `env(safe-area-inset-*)` | 对刘海屏友好 |
| 语音输入能力 | `speechToText.ts` 封装 Web Speech API | 仅用于 LLM 聊天输入 |

### 3.2 关键缺口（缺失 / 待验证）

#### A. 页面级结构与导航

- **HTML `lang` 错误**：`index.html:2` 写死 `lang="en"`，但默认语言为中文。这会让屏幕阅读器用英文语音读中文内容。
- **无地标与跳转链接**：`#app` 内未设置 `<main>`、`<nav>`、`<header>`，也没有 skip-to-content 链接。整个应用是一个普通 `div`。
- **标题层级缺失**：页面标题使用 `<div class="pixel-page-title">` 等样式类，未见 `<h1>`-`<h3>` 语义标题。
- **语言切换后 `lang` 未同步**：`settings.ts:106-108` 只更新 store，未见 `document.documentElement.lang = ...`。

#### B. 键盘与焦点

- **焦点样式不完整**：
  - `legacy.css:198,333,3962` 多处 `outline: none`。
  - 只有 `.btn:focus-visible` 有 `box-shadow` 焦点环（`legacy.css:201-203`）。
  - 像素风格主按钮 `.pixel-btn` 搜索 `focus-visible` 无结果；无法确认是否存在可见焦点。
- **无全局键盘操作**：
  - 未见 Enter/Space 之外的对局快捷键（如 1-9 选牌、Enter 确认、Esc 取消）。
  - `matchTableRenderer.ts` 中 Tile 是 `<button>` 可被 Tab 到，但 13/14 张牌的遍历效率低。
- **仅对话框处理 Esc**：`pixelDialog.ts` 监听 `keydown` 关闭弹窗；其余浮层/抽屉未统一处理。

#### C. ARIA 与屏幕阅读器

- **ARIA 属性极少**：全 `src/ui/**/*.ts` 中仅 3 处 `aria-*`（`tileView.ts` ×2，`matchTableRenderer.ts` ×1）。
- **无实时区域**：未见 `aria-live`、`role="status"`、`role="alert"`。AI 教练消息、回合切换、错误提示、胜负结果不会自动播报。
- **表单标签关联弱**：`settings.ts` 中 `<label>` 通过 `appendChild(control)` 包裹控件，语义上算隐式关联，但缺乏 `for`/`id`，某些屏幕阅读器/浏览器组合下可能读取不连贯。
- **像素弹窗缺少 ARIA**：`createPixelModalSurface` 未设置 `role="dialog"`、`aria-modal="true"`、焦点陷阱（focus trap）。
- **“X” 关闭按钮名称不足**：`pixelFrame.ts:123` 创建按钮文本为 `"X"`，缺少 `aria-label="关闭"`。

#### D. 颜色、对比度与色觉

- **缺少色盲模式**：代码中无 `colorblind`、`high-contrast`、`daltonize` 等关键字；牌面花色完全依赖颜色+传统符号，对红绿色觉异常用户存在识别风险。
- **对比度待测**：
  - `--text-secondary: #9aa8b8` 在 `--bg-surface: #151d28` 上计算对比度约为 5.0:1（通过）。
  - `--text-muted: #607080` 在深色背景上约为 3.2:1（未达 AA，用于占位/次要文字）。
  - 桌布绿色 `--table-bg: #1d4030` 与上面可能叠加的白色/金色文字需要实际测量。
  - 截图中菜单小字“血战到底，像素化平面牌桌...”字号极小，对比度目测偏低。
- **无 `prefers-contrast` / `forced-colors` 适配**：未针对 Windows 高对比或 macOS 增加对比度做专门规则。

#### E. 字体与缩放

- **UI Scale 与浏览器缩放解耦**：`--ui-scale` 通过设置滑块控制（0.85–1.35），不是响应 `font-size` 或 `zoom`。若用户在浏览器设置中将文字放大到 200%，CSS 中大量 `px` 值不会等比放大。
- **最小字号过低**：`--fs-xs: 11px` 在 `legacy.css:83`，低于 WCAG 建议的 12px 以上可缩放文本。

#### F. 动效

- **仅一处尊重 `prefers-reduced-motion`**：`actionEventFx.ts` 缩短了动画。
- **大量 CSS transition/animation 未做减弱处理**：`.mj-tile` hover、`animate-slideUp`、按钮 press 动画等未在 `prefers-reduced-motion: reduce` 下禁用。
- **自动动画可能干扰**：对局中吃碰杠胡的飞行动画持续 430ms，未提供“完全关闭动画”选项。

#### G. 音频层完全缺失

- **无 BGM / 音效 / 语音**：`src/` 与 `resource/` 中无 `.mp3`/`.wav`/`.ogg`，代码中无 `Audio`/`AudioContext`/Howler 引用。
- **无音频替代**：由于完全没有音频，暂不存在“音频需要字幕/文本替代”的问题，但未来一旦加入音效，必须同步提供视觉反馈（如牌面高亮、文字提示）。

#### H. PixiJS 画布（当前未启用）

- `MahjongTableScene.ts` 未被任何文件 import，因此当前对实际 UI 无影响。
- 若未来启用：PixiJS 默认 `<canvas>` 对屏幕阅读器不友好；需要 `aria-hidden` + 叠加等价的 HTML 牌面，或启用 Pixi Accessibility Plugin 给每个 Sprite 设置 `accessible` 属性。

---

## 4. 改进路线图建议

> 以下仅为规格建议，不要求在本任务中实现。每项都标注了推荐分级与对应验收指标。

### Phase 1：Basic 补课（建议 1 个迭代内完成）

| 编号 | 任务 | 验收指标 |
|---|---|---|
| A11Y-B1 | 修复 `lang` | `index.html` 默认 `lang="zh"`；切换语言时同步 `document.documentElement.lang` |
| A11Y-B2 | 添加 `<main>` 与 skip link | 首页、对局页、设置页渲染 `<main>`；首屏提供“跳到主内容”链接 |
| A11Y-B3 | 统一可见焦点 | 所有按钮、输入框、下拉框、滑块都有 `:focus-visible` 高对比 outline / box-shadow |
| A11Y-B4 | 键盘主流程 | 无需鼠标可完成：开始游戏 → 换三张 → 定缺 → 打牌 → 结算 → 返回主页 |
| A11Y-B5 | 修复标题层级 | 页面标题使用 `<h1>`，区块标题使用 `<h2>`，避免仅依赖样式类 |
| A11Y-B6 | 验证并修复对比度 | 所有正文/控件文字通过 WCAG AA（可用 axe DevTools 验证） |
| A11Y-B7 | 统一 `prefers-reduced-motion` | 在 `@media (prefers-reduced-motion: reduce)` 中禁用所有非必要 transition/animation |

### Phase 2：Standard 补课（建议 2 个迭代内完成）

| 编号 | 任务 | 验收指标 |
|---|---|---|
| A11Y-S1 | 表单控件显式标签 | 所有 `<input>` / `<select>` 都有 `id` + `<label for>` 或 `aria-labelledby` |
| A11Y-S2 | 实时播报 | 对局状态变化、错误、AI 建议使用 `aria-live="polite"`；弹窗使用 `role="alert"` |
| A11Y-S3 | 牌面语音朗读优化 | 牌按钮 `aria-label` 在中文模式下也始终设置（当前仅在英文回退时明显） |
| A11Y-S4 | 键盘效率 | 提供数字键 1-0 选牌、Enter 确认、Esc 取消、快捷键显示在按钮 tooltip |
| A11Y-S5 | 浏览器缩放兼容 | 页面在 200% 缩放且视口 1280×1024 等效下不丢失控件 |
| A11Y-S6 | 色盲友好主题 v1 | 提供单一“高对比/色盲安全”主题：花色除颜色外必须有纹理/符号/文字差异 |
| A11Y-S7 | 弹窗无障碍 | `createPixelModalSurface` 添加 `role="dialog"`、`aria-modal="true"`、焦点陷阱、Esc 关闭 |

### Phase 3：Comprehensive 补课（建议后续版本迭代）

| 编号 | 任务 | 验收指标 |
|---|---|---|
| A11Y-C1 | 三色盲模拟 + 高对比 | Deuteranopia / Protanopia / Tritanopia 三套 LUT + 黑白高对比主题 |
| A11Y-C2 | 音频反馈层 | 动作音效、倒计时、胜负播报；所有音效都有同步的视觉/文字反馈 |
| A11Y-C3 | 语音合成解说 | AI 教练关键建议可选语音合成朗读（Web Speech API `speechSynthesis`） |
| A11Y-C4 | 强制颜色模式适配 | `@media (forced-colors: active)` 下保留焦点环、禁用背景图、使用系统颜色 |
| A11Y-C5 | 自动化测试 | CI 增加 `axe-core` + Lighthouse accessibility + 颜色对比度脚本；PR 阻塞阈值 ≥ 90 分 |
| A11Y-C6 | 可访问性设置面板 | 设置页新增“无障碍”分区：色盲模式、高对比、减弱动效、UI 缩放、音频开关 |

---

## 5. 附录：代码证据索引

| 结论 | 文件 | 行号 / 关键片段 |
|---|---|---|
| `lang="en"` 硬编码 | `index.html` | 2 |
| `--font-body-min: 14px` / `--touch-target-min: 44px` | `src/ui/styles/tokens.css` | 7-8 |
| 仅 3 处 ARIA | `src/ui/components/tileView.ts`, `src/ui/renderers/matchTableRenderer.ts` | `aria-label`, `aria-hidden` |
| 无 `aria-live` | 全 `src/ui/**/*.ts` | 未命中 |
| `prefers-reduced-motion` 仅一处 | `src/ui/components/actionEventFx.ts` | 118 |
| 多处 `outline: none` | `src/ui/styles/legacy.css` | 198, 333, 3962 |
| UI Scale 0.85-1.35 | `src/store/settingsStore.ts` | 19, 37, 71 |
| 无音频 | `src/` / `resource/` | 无音频文件与 API 引用 |
| 语言切换 | `src/ui/pages/settings.ts` | 94-109 |
| 牌面 `aria-label` | `src/ui/components/tileView.ts` | 207, 228 |
| 像素弹窗无 ARIA 角色 | `src/ui/components/pixelFrame.ts` | 40-70 |
| MahjongTableScene 未启用 | `src/ui/pixi/MahjongTableScene.ts` | 无其他文件 import |

---

## 6. 直接结论

当前 Neo Mahjong 的像素 UI 在 **Basic 级别仅部分达标**：按钮语义、牌面 alt/aria-label、语言切换、单一动效减弱点已具备；但 `lang` 错误、地标缺失、焦点样式不完整、键盘效率低、色盲/高对比缺失、音频层完全空白，使其尚未达到 Basic 的完整要求。

建议优先执行 **Phase 1（Basic）** 中的 A11Y-B1、A11Y-B3、A11Y-B4、A11Y-B6 与 **A11Y-B7**，可在不改变美术风格的前提下显著降低阻断风险。后续再逐步推进 Standard 与 Comprehensive 的专项改造。
