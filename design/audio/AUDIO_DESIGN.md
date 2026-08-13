# Neo Mahjong — 音频设计规格（Audio Bible）

> 文档类型：音频方向 + 实现规格（从零定义）  
> 项目：neo-mahjong（成都麻将 AI 教学平台）  
> 平台：Web / Vercel（桌面 + 移动浏览器）  
> 技术栈：原生 TypeScript + DOM UI + Vite  
> 作者：audio-director（阮和鸣）｜阶段：Phase 6 打磨  
> 评审强度：full（结论均锚定 `src/` 与 `design/` 现状事实）

---

## 0. 现状事实与本文定位

**关键事实（已核实）：当前项目完全没有音频层。**
- `src/` 与 `resource/` 中无 `.mp3/.wav/.ogg` 等任何音频资产（`resource/` 仅有 `mahjong_tiles/png`）。
- 代码中无任何 `Audio` / `AudioContext` / Howler 引用（详见 `design/accessibility/ACCESSIBILITY.md` §3.G）。
- 因此本文件**不是"打磨已有音频"，而是从零定义音频设计规格**，并给出"是否应在本版本构建音频层"的产品建议。

**本文件交付物**
1. 音频方向（Audio Direction）
2. BGM 规格
3. SFX 集合（完整清单 + 触发点 + 时长 + 优先级）
4. 混音与实现策略（Web Audio API）
5. 可访问性对接（替代文本 / 字幕）
6. 构建与否的产品建议 + MVP 最小可行集

**约束（来自指派）**
- 仅文档产出：**不生成音频资源文件、不修改 `src/`**。
- 所有 SFX 采用**程序化合成（Web Audio synth）**方案 → 零二进制资产，契合 Vercel 静态托管与"不生成音频文件"约束。
- 结论须结合"无音频层"现状与"教学平台"定位。

---

## 1. 音频方向（Audio Direction）

### 1.1 基调（Tone）
**"安静的书房 / 茶馆一隅"——低压力、专注、温暖、非竞技。**

| 维度 | 选择 | 理由 |
|---|---|---|
| 情绪 | 专注 · 安心 · 轻微愉悦 | 教学平台需降低学习焦虑，而非制造紧张 |
| 文化质感 | 克制的川蜀元素（合成木/瓷/轻拨弦动机），**不**做"赌场/喧闹街市" | 避免娱乐化噪音干扰学习 |
| 能量曲线 | 对局中低能量、结算/成就略升、菜单中性 | 让注意力留在牌面与教练讲解上 |
| 音色语言 | 木质"咔嗒"（出牌/碰）、共振"咚"（杠）、明亮上行铃（胡/正确）、柔和低音"请再想想"（错误） | 每种动作有**可辨识音色**，强化事件→意义映射（记忆锚点） |

### 1.2 情绪目标（结合"教学平台"定位）
1. **用音效强化番型/事件记忆**：碰、杠、胡、流局各自有独特音色签名，学习者听到即知发生了什么——把"听觉"变成第二记忆通道。
2. **用反馈音降低学习挫败**：错误反馈**必须是柔和、非惩罚性**的中低音提示（"请重新考虑"而非"刺耳错误蜂鸣"）；正确/被教练认可用温暖正向音。
3. **用正反馈驱动坚持**：连胜里程碑、首次胡、章节掌握用渐进式上行音，把"学麻将"变成可感知的进度。
4. **不喧宾夺主**：BGM 默认低音量且在对局中进一步下沉，绝不与 AI 教练讲解或玩家思考争抢注意力。

### 1.3 声音调色板（Sound Palette，程序化可达）
- **Tile Clack（牌响）**：短噪声爆发（band-pass 滤波 ~2–4kHz）+ 共振体（短衰减 sine ~180Hz）。出牌/碰复用，参数微调区分。
- **Resonant Thud（共振咚）**：低频 sine/triangle 80–120Hz + 快速衰减包络，用于杠。
- **Warm Bell（暖铃）**：两个不协和但悦耳的 sine（基频 + 大三度/纯五度），用于正确/胡/成就。
- **Soft Low Cue（柔和低提示）**：低 triangle ~160Hz + 轻微下滑，用于"轮到你 / 请再想想"。
- **Texture Pad（氛围垫）**：低通滤波的缓慢 detuned saw/sine 叠加，作 BGM 床声（可选程序化生成）。

### 1.4 动态层级（Dynamic Layers）
| 场景 | BGM | SFX | 备注 |
|---|---|---|---|
| 主菜单 / 设置 | 中性环境垫（中低） | UI 点击 | 欢迎感 |
| 对局中（思考/出牌） | 极低环境垫或静默 |  gameplay SFX 正常 | BGM 自动 duck |
| AI 教练讲解中 | 下沉至 ~15% | 仅教练就绪/返回提示 | 保专注 |
| 结算 / 成就 | 短暂让位给结算音 | 结算 sting | 情绪收束 |
| 回放 | 同对局（更中性） | 事件回放音（可关） | 回放可静音 |

---

## 2. BGM 规格

> 教学平台中 BGM **不是必需**，且是 MVP 之外项（见 §6）。以下为若构建时的规格。

### 2.1 场景与策略
| 场景 | 风格参考 | 循环策略 | 默认音量 |
|---|---|---|---|
| 菜单（home/settings） | 极简合成环境垫 + 偶发川蜀拨弦动机 | 无缝循环（8–16s 段，crossfade） | 0.35（相对 master） |
| 对局中 | 近乎静默的底层 pad（或无 BGM） | 若存在，长循环 + 缓慢层叠 | 0.15，且教练讲解时 duck 至 0.05 |
| 回放 | 同对局但更中性 | 同对局 | 0.15 |
| 教学讲解 | 不另起 BGM，复用对局 bed 并 duck | — | — |
| 结算 | 不叠 BGM，让位结算 sting | — | — |

### 2.2 风格参考
- 参考氛围：**lo-fi study / 极简新民谣 / 克制的古筝·琵琶合成动机（非民俗堆砌）**。
- 调性：五声音阶（宫商角徵羽）避免尖锐半音，天然"中式温和"。
- **不**使用人声演唱、强节拍、电子舞曲元素。

### 2.3 程序设计建议（零资产）
- BGM 优先采用**程序化 pad**（持续振荡器 + 低通 + 缓变 LFO），无需音频文件，契合零资产约束。
- 若需更丰富旋律，可接受 **1 个压缩循环 OGG（≤ 1.5MB）**；但 MVP 建议纯程序化，先不引入文件。

---

## 3. SFX 集合（完整清单）

### 3.0 优先级约定
`Critical`（结算/胡，必须被听到）｜`High`（ gameplay 关键/反馈）｜`Normal`（常规）｜`Low`（UI 点缀）

### 3.1 主表（Master SFX Table）

| # | 事件 ID | 名称 | 触发点（代码锚点） | 时长 | 优先级 | a11y 视觉孪生 |
|---|---|---|---|---|---|---|
| G1 | `SFX_DISCARD` | 出牌 | P0 出牌：`dispatchHumanAction`→`DISCARD` 事件（`src/core/model/event.ts:5`；出牌校验 `GameOrchestrator.ts:237-277`） | 0.15s | Normal | 牌飞行动效 + 弃牌堆更新 |
| G2 | `SFX_TILE_DRAW` | 摸牌 | P0 `DRAW` 事件（`event.ts:5`；事件生成 `GameOrchestrator.ts:79-81`） | 0.12s | Low | 手牌 +1 动画 |
| G3 | `SFX_PENG` | 碰 | `PENG` 事件；UI 反应按钮 `matchTableRenderer.ts:397-414`；飞行动效 `actionEventFx.ts:103` | 0.30s | High | "碰"徽章 + 目标脉冲 |
| G4 | `SFX_GANG` | 杠（明/暗/加/补） | `GANG` 事件 `gangType: MING/AN/JIA/BU`（`event.ts:9`）；`actionEventFx.ts` | 0.45s | High | "杠"徽章 + 共振脉冲 |
| G5 | `SFX_HU` | 胡（点炮/自摸/抢杠/刮风下雨） | `HU` 事件（`event.ts:5`）；`actionEventFx.ts` | 1.2s | Critical | "胡"徽章 + 高亮 |
| G6 | `SFX_TURN_P0` | 轮到自己 | `TURN` 事件且 `playerId===P0`（`event.ts:5`） | 0.20s | Normal | 当前玩家高亮（应已存在） |
| G7 | `SFX_EXCHANGE` | 换三张确认 | `EXCHANGE_CONFIRM`（`action.ts:12`）；`performExchange` `index.ts:283-322` | 0.30s | Normal | 三张传递动效 |
| G8 | `SFX_DING_QUE` | 定缺确认 | `DING_QUE`（`action.ts:13`） | 0.25s | Normal | 缺门标识更新 |
| G9 | `SFX_GANG_RAIN` | 刮风下雨（杠钱） | `applyGangRainMoney`（`index.ts:105-138`）；即时结算 | 0.40s | Normal | 分数变动提示 |
| G10 | `SFX_CHECK_HUAZHU` | 查花猪 | 流局结算 `applyDrawSettlement`（`index.ts:1293-1409`） | 0.50s | Normal | 结算面板文案 |
| G11 | `SFX_CHECK_DAJIAO` | 查大叫/查叫 | 同上（`index.ts` 流局分支） | 0.50s | Normal | 结算面板文案 |
| G12 | `SFX_FLOW_END` | 流局结束 | `END` 事件 + `result==='DRAW'`（`GameOrchestrator.ts:369-374`） | 0.80s | High | 结算页"流局" |
| G13 | `SFX_SETTLE_WIN` | 结算·胜（P0 胡） | `finishMatchStat('HU')`（`GameOrchestrator.ts:369-374, 374`） | 1.5s | Critical | 结算页"胜" + 分数 |
| G14 | `SFX_SETTLE_LOSE` | 结算·负 | `finishMatchStat('LOSE')` | 1.0s | High | 结算页"负"（柔和，非惩罚） |
| G15 | `SFX_STREAK` | 连胜里程碑 | `HistoryStorage.getGameHistory` `bestStreak/currentStreak`（`HistoryStorage.ts:172-196`） | 1.0s | High | 连胜数 UI（`translations.ts:552 bestStreak`） |

### 3.2 UI 交互 SFX
| # | 事件 ID | 名称 | 触发点 | 时长 | 优先级 | a11y 孪生 |
|---|---|---|---|---|---|---|
| U1 | `SFX_UI_CLICK` | UI 点击 | 通用按钮（`pixelFrame.ts`、`pixelDialog.ts`、各 page） | 0.05s | Low | 焦点环 + 视觉按压 |
| U2 | `SFX_UI_NAV` | 页面导航 | home/settings/match/replay 路由切换（`home.ts` 等） | 0.15s | Low | 路由变化 + 焦点管理 |
| U3 | `SFX_UI_TOGGLE` | 开关/滑块 | `settings.ts` 控件（`settingsStore.ts`） | 0.06s | Low | 控件状态文本 |
| U4 | `SFX_DIALOG_OPEN` | 弹窗打开 | `createPixelModalSurface`（`pixelFrame.ts:40-70`） | 0.12s | Low | `role="dialog"` 焦点陷阱 |
| U5 | `SFX_DIALOG_CLOSE` | 弹窗关闭 | "X" 关闭按钮（`pixelFrame.ts:123`，需补 `aria-label`） | 0.10s | Low | 焦点返回触发元素 |
| U6 | `SFX_TILE_SELECT` | 选牌高亮 | 手牌点击预备出牌（`tileView.ts:207` aria-label） | 0.04s | Low | 牌选中态高亮 |
| U7 | `SFX_REPLAY_CTRL` | 回放控制 | replay 播放/暂停/步进（`replay.ts`） | 0.10s | Low | 回放进度条 |

### 3.3 教学 / 教练反馈 SFX（教学平台专属价值）
| # | 事件 ID | 名称 | 触发点 | 时长 | 优先级 | a11y 孪生 |
|---|---|---|---|---|---|---|
| T1 | `SFX_COACH_READY` | 教练提示可用 | `LLMCoachingPanel` / `LLMChatAssistant` 面板就绪、建议可获取 | 0.30s | Normal | 面板出现 + 状态文字 |
| T2 | `SFX_COACH_RESPONSE` | 辅导返回 | `LLMService.getCoachingAdvice` 返回（`llm-teaching-layer.md:30`） | 0.25s | Normal | 辅导文本渲染 |
| T3 | `SFX_FEEDBACK_CORRECT` | 正确反馈 | P0 落子匹配 LLM 推荐动作 / 分析器认可（`HeuristicAnalyzer.ts:157` 可胡提示等正向信号） | 0.40s | High | 绿色对勾 / 正向 toast |
| T4 | `SFX_FEEDBACK_INCORRECT` | 错误/不正确反馈 | `出牌不正确`（`GameOrchestrator.ts:259, 539`）、`换三张不正确`（`:629/638/648/660`）、违规拦截 | 0.40s | High | 错误 toast（`role="alert"`）+ 红框 |
| T5 | `SFX_HINT_AVAILABLE` | 提示可用 | 存在可执行的策略提示 / `GuidanceLevel` 给出建议 | 0.20s | Low | 提示入口高亮 |
| T6 | `SFX_GUIDANCE_LEVEL` | 分级切换 | 切换 beginner/learning/practicing/advanced（`PromptBuilder:97-102`） | 0.10s | Low | 分级标签更新 |

### 3.4 成就 / 进度 SFX
| # | 事件 ID | 名称 | 触发点 | 时长 | 优先级 | a11y 孪生 |
|---|---|---|---|---|---|---|
| A1 | `SFX_ACHIEVEMENT` | 成就解锁 | 首次胡 / 首次自摸 / 里程碑（画像或统计触发，`UserProfilePanel.ts`） | 1.2s | High | 成就横幅（文字） |
| A2 | `SFX_LESSON_MASTERED` | 章节/番型掌握 | 教学路径模块完成（`teachingVariants.ts`/`learningRoadmap.ts`，当前多为文档设想） | 1.0s | Normal | 进度条 / 徽章（文字） |

> **说明**：A2 依赖 `LearningPath` 等当前**仅文档**的功能（GDD §4 已标注"仅文档"），若本版本未实现则 A2 暂不接入。

### 3.5 变体与分层（Variants & Layering）
- **G4 杠**：以 `gangType` 区分音色微调（暗杠更"闷/内敛"、明杠更"亮/外放"、加杠居中）——同一 `SFX_GANG` 用参数变体，非独立文件。
- **G5 胡**：以 `meta` 区分（自摸 vs 点炮 vs 抢杠 vs 刮风下雨）做尾音长度/亮度变体。
- **一炮多响**：多 `HU` 并发时用总线压缩器（§4.3）限幅，避免叠加爆音；最多同时 3 个胡音。
- **T3/T4 正确性**：与可见 toast 严格同步触发（毫秒级），构成"视听一体反馈"。

---

## 4. 混音与实现策略（Web Audio API）

### 4.1 总体方案
- **纯 Web Audio API（零第三方库）**：程序化合成全部 SFX，零二进制资产；BGM 优先程序化 pad。
- **AudioContext 惰性创建**：在**首次用户手势**后 `new AudioContext()` + `resume()`，满足浏览器自动播放策略与可访问性"无自动播放"要求（ACCESSIBILITY §1.1）。
- **单一 AudioEngine 模块**（后续由 engineering-lead 实现，本文仅规格）：订阅 `GameEvent` 流与 UI 交互回调，按事件 ID 路由到合成器。

### 4.2 总线结构（Bus / Mix Routing）
```
Master Gain (受 audioEnabled / masterMute 门控)
  ├─ SFX Bus      (GainNode, 默认 0.80) ── DynamicsCompressor(限幅) ──► destination
  ├─ BGM Bus      (GainNode, 默认 0.35；对局中 duck→0.15；教练讲解 duck→0.05)
  └─ Voice Bus    (GainNode, 默认 1.00；供 speechSynthesis 教练朗读 A11Y-C3)
```
- 每个 bus 独立增益，映射设置项（§4.5）。
- Master 末端统一接 `DynamicsCompressorNode`（threshold -18dB / ratio 4 / knee 12）防 SFX 堆叠爆音。

### 4.3 实例 / 池化 / 性能
- SFX 为**一次性合成节点**（`OscillatorNode`/`AudioBufferSourceNode` + 包络 `GainNode`），播放完 `stop()` 即释放，**无需对象池**。
- **并发预算**：同时发声 SFX ≤ 16 voice；`HU` sting 同发 ≤ 3。
- **移动端约束**：
  - iOS Safari：必须在用户手势内 `resume()`，否则静音。
  - 控制节点总数（合成 cheap，但仍避免在 1 帧内创建 > 16 节点）。
  - 不加载长 buffer、不做实时 FFT 分析（除非后续需要可视化）。
  - 后台标签页：`visibilitychange` 时挂起 AudioContext，省电。

### 4.4 空间化
- 当前为**非死亡空间（non-diegetic）** UI/牌桌音，全部在听者位置，**无需 PannerNode / 距离衰减**。
- 预留：若未来启用 Pixi 3D 牌桌（`MahjongTableScene.ts`，当前未启用），再引入 `PannerNode` 做座位方位。

### 4.5 与"静音/减弱"设置项的对接
扩展 `PersistedSettings`（`src/store/settingsStore.ts:7-21`）新增音频子对象（**仅规格，不修改 src**）：
```ts
audio: {
  enabled: boolean;     // 总开关（默认 true，但首屏手势前实际静默）
  sfxVolume: number;    // 0..1，默认 0.80
  bgmVolume: number;    // 0..1，默认 0.35
  voiceVolume: number;  // 0..1，默认 1.00（A11Y-C3 用）
  reduceIntensity: boolean; // 减弱模式：缩短 sting 尾音、降亮度（呼应 prefers-reduced-motion）
}
```
- 设置 UI（`settings.ts`）新增"音频"分区（对应 A11Y-C6 无障碍面板）。
- `enabled=false` 时 Master Gain 立即置 0 并 `suspend()` AudioContext。
- **尊重 `prefers-reduced-motion`**：`reduceIntensity` 默认跟随该媒体查询（见 ACCESSIBILITY §3.F）。

---

## 5. 可访问性对接（替代文本 / 字幕）

> 依据 `design/accessibility/ACCESSIBILITY.md`（§1.1 无自动播放+音量与关闭开关；§3.G 完全无音频层；§4 A11Y-C2/C3/C6）。

### 5.1 硬性原则（必须遵守）
1. **无自动播放**：AudioContext 仅在首次手势后启动；BGM 不在首屏自动响。
2. **开关 + 音量**：`audio.enabled` 与三路音量（§4.5）必须存在且易达。
3. **音效必有同步视觉/文字孪生**：ACCESSIBILITY §4 A11Y-C2 明确要求"所有音效都有同步的视觉/文字反馈"。本文 §3 每一条均已标注"a11y 视觉孪生"列，作为**上线闸门**——任一声效若无视觉孪生，不予发布。

### 5.2 音频替代文本（Audio Alt-Text）策略
- **事件播报区（aria-live）**：在 match 页增设 `role="status"` / `aria-live="polite"` 文本区，将 G1–G15 关键事件转为文字（如"你碰了三筒""你胡了，自摸""换三张已确认""流局"）。这既服务屏幕阅读器，也充当"音频的替代文本通道"。
- **错误强提示**：T4 错误反馈必须同时触发 `role="alert"` 文本（已存在于出牌不正确 toast，需补 ARIA 角色）。
- **字幕 / 解说模式（A11Y-C3）**：AI 教练关键建议除音频就绪提示（T1/T2）外，主体已是文字浮层；可选经 `speechSynthesis`（Web Speech API）朗读，并同步字幕 overlay。**语音为可选增强，绝不作为唯一信息通道。**

### 5.3 与现有 a11y 缺口的协同
- 音频层不应阻塞 Basic a11y 修复（A11Y-B1 `lang`、B3 焦点、B4 键盘、B6 对比度、B7 reduced-motion）。
- 引入音频时**同步**补齐：弹窗 `role="dialog"`/焦点陷阱（A11Y-S7）、实时播报（A11Y-S2）——这些正是音频孪生所需的文本通道。

---

## 6. 构建与否的产品建议

### 6.1 建议结论：**有条件构建（Conditional BUILD）——本版本交付 MVP 音频集**

**推荐在本版本构建音频层，但带 4 条硬性条件：**
1. **完全可选 + 可关**：`audio.enabled` 与三路音量必上线；首屏手势前实际静默（a11y 合规）。
2. **音效必带视觉/文字孪生**（§5.1-3）：这是发布闸门，无孪生不发布。
3. **不阻塞 Basic a11y 修复**：音频是 ACCESSIBILITY 文档的 **Phase 3（Comprehensive）** 项（A11Y-C2/C3/C6），而当前 Basic 仍部分未达标（lang/landmark/焦点）。优先级上，**先修 Basic，音频作为并行增值项**，不得占用其资源。
4. **零二进制资产**：全部 SFX 程序化合成，BGM 优先程序化 pad；不引入音频文件，契合 Vercel 托管与本任务约束。

### 6.2 权衡分析
| 维度 | 构建的理由（教学平台） | 不构建的理由 |
|---|---|---|
| 教学价值 | 正确/错误反馈音降低挫败；事件音色强化记忆；连胜/成就驱动坚持 —— **直接服务核心"学麻将"体验** | 文字/视觉反馈已部分满足；音频是"增值"非"必需" |
| 开发成本 | **低**：程序化 SFX 无需资产，AudioEngine 约数百行；MVP 仅 ~12 条 SFX | 若做完整 BGM + VO 则成本上升 |
| 范围/风险 | 限于 MVP 集则风险可控；a11y 闸门可控 | 易过度设计（全编曲/配音），挤占打磨期 |
| 可访问性 | 同步补齐孪生与播报，反而提升 a11y | 若仓促上线无孪生，违反 A11Y-C2 |

**结论**：教学价值明确、成本可控（零资产）、且能顺带补强 a11y，**建议构建 MVP 集**；完整 BGM/VO 可延后。

### 6.3 MVP 最小可行集（若构建则必含）
**Must-have（教学关键，且均带视觉孪生）**
- Gameplay：`SFX_DISCARD`、`SFX_PENG`、`SFX_GANG`、`SFX_HU`、`SFX_SETTLE_WIN/LOSE`、`SFX_FLOW_END`
- 教学反馈：`SFX_FEEDBACK_CORRECT`、`SFX_FEEDBACK_INCORRECT`
- UI：`SFX_UI_CLICK`
- 基础设施：AudioEngine + 总线 + 设置项 + aria-live 播报区 + 视觉孪生

**Should-have（次优先）**
- `SFX_TILE_DRAW`、`SFX_TURN_P0`、`SFX_EXCHANGE`、`SFX_DING_QUE`
- `SFX_COACH_READY`、`SFX_COACH_RESPONSE`、`SFX_STREAK`
- 弹窗/导航/选牌 UI 音（U2/U4/U5/U6）

**Defer / 可选（非本版本）**
- 完整 BGM 床声（§2，可纯程序化极简版）
- `SFX_ACHIEVEMENT` / `SFX_LESSON_MASTERED`（依赖成就/学习路径系统，部分仅文档）
- 语音合成教练朗读（A11Y-C3，VO 系统）
- 空间化 3D 音（待 Pixi 牌桌启用）

**显式不在 MVP**：全编曲 BGM、真人配音、场景氛围设计。

---

## 7. 命名约定与事件映射

### 7.1 事件 ID 命名
- 前缀：`SFX_` + 分类（`GAMEPLAY`/`UI`/`TEACH`/`ACHV`）+ `_` + 语义名（见 §3）。
- 缩写表：DISCARD=出牌, PENG=碰, GANG=杠, HU=胡, DRAW=摸, EXCHANGE=换三张, DING_QUE=定缺, FLOW=流局, SETTLE=结算, COACH=教练, FEEDBACK=反馈, STREAK=连胜。
- 变体通过参数（`gangType`/`meta.reason`）区分，不新增 ID。

### 7.2 实现钩点（AudioEngine 订阅位置，仅规格）
| 钩点 | 位置 | 触发 SFX |
|---|---|---|
| GameEvent 流 | `gameStore.subscribe` / `UiCtx.orchestrator` 事件数组 | G1–G15 |
| 人类动作确认 | `dispatchHumanAction` 成功分支 | G1/G7/G8 + U6 |
| 反应按钮 | `matchTableRenderer` 碰/杠/胡/过 | G3/G4/G5 |
| 错误拦截 | `GameOrchestrator` 出牌/换三张不正确 | T4 |
| 教练面板 | `LLMCoachingPanel`/`LLMChatAssistant` | T1/T2/T5/T6 |
| 结算 | `finishMatchStat` | G13/G14/G12 |
| 连胜 | `HistoryStorage.getGameHistory` 差值 | G15 |
| 设置变更 | `settingsStore` 音频子对象 | 总线增益实时更新 |
| 路由 | home/settings/match/replay | U2 |

---

## 8. 待决策 / 待工程项（需 team-lead / engineering-lead 确认）

1. **是否采纳"有条件构建"**：若团队 Phase 6 聚焦 Basic a11y + playtest 打磨，音频可整体延后至下个版本——请拍板。
2. **BGM 是否进 MVP**：建议 MVP **不含完整 BGM**（仅可选极简程序化 pad 或留空），把预算压在 SFX + 教学反馈。
3. **设置项扩展**：§4.5 的 `audio` 子对象需 engineering-lead 落 `settingsStore.ts` 与 `settings.ts` UI。
4. **aria-live 播报区**：§5.2 的文本通道需 art-director / engineering-lead 在 match 页落地（亦满足 A11Y-S2）。
5. **Voice Bus / speechSynthesis**：A11Y-C3 语音教练为可选增强，是否纳入本版本待定（建议延后）。
6. **首次手势策略**：确认 AudioContext resume 绑定于哪个首次交互（开始游戏按钮 / 任意点击）。

---

*音频方向（Audio Bible）v1.0 — 由 audio-director 基于项目现状（无音频层）与教学平台定位从零定义。所有 SFX 均为程序化合成规格，不含任何二进制资产。仅文档产出，未修改 `src/`。*
