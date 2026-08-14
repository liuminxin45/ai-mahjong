# 发布清单（Release Checklist）— v0.1.0

> 发布对象：neo-mahjong 成都麻将 AI 教学平台 · 首个公开测试版
> 目标平台：Web / Vercel · 构建：`pnpm build` → `dist/`
> 准备日期：2026-08-14 · 主理人：游承峰（代 release-ops 产出，因网络层 502）

---

## 1. 发布前检查项（Pre-flight）

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | 版本号已确定并写入 `package.json` | ⬜ 待用户确认 | 建议 `0.1.0`（见 §5） |
| 2 | `npx tsc --noEmit` 通过 | ✅ | 0 错误（2026-08-14 验收） |
| 3 | `pnpm test:run` 全绿 | ✅ | 36 文件 / 242 用例全过 |
| 4 | `pnpm build` 通过 | ✅ CI 环境 | 本机被 WorkBuddy 沙箱拦截（见风险 R1），Vercel CI 正常 |
| 5 | `CHANGELOG.md` 已更新 | ✅ | 本轮已建 |
| 6 | `RELEASE_NOTES.md` 已就绪 | ✅ | 见同目录 |
| 7 | 回滚预案已就绪 | ✅ | `ROLLBACK_PLAN.md` |
| 8 | 部署配置 `vercel.json` 正确 | ✅ | buildCommand/outputDirectory/api rewrite 已核 |
| 9 | git tag 已打 | ⬜ 待用户确认 | 建议 `v0.1.0` |
| 10 | 工作区干净、已推送远端 | ✅ | `f533a06` 已在 GitHub main |

## 2. 发布步骤（Procedure）

1. 确认版本号（用户拍板）→ 更新 `package.json` 的 `version`。
2. 提交版本号变更：`git commit -am "chore(release): v0.1.0"`。
3. 打 tag：`git tag -a v0.1.0 -m "v0.1.0 首个公开测试版"`。
4. 推送：`git push origin main --tags`。
5. Vercel 部署（二选一）：
   - 已连接 Git 仓库：push 后 Vercel 自动构建部署。
   - 手动：`vercel --prod`（见 `DEPLOY.md`）。
6. 部署后立即执行 §3 冒烟验证。

## 3. 发布后冒烟验证（Smoke）

| # | 验证点 | 预期 |
|---|--------|------|
| 1 | 首页可打开、无控制台报错 | 正常加载 |
| 2 | 开始一局对局：发牌→换三张→定缺→出牌→碰/杠/胡→血战→结算 | 全流程可推进无卡死（P0 已修） |
| 3 | 加杠后可抢杠胡、加杠者可补摸 | 不再活锁（QA-P0-001 回归） |
| 4 | 流局结算：副露听牌玩家不被误判大叫 | 计分正确（QA-P1-003 回归） |
| 5 | LLM 教练讲解番型不输出"未知番型" | 文案正常（QA-P1-006 回归） |
| 6 | 设置→音频分区：开关/音量可调，出牌有音效 | 音频 MVP 生效 |
| 7 | `/api/llm/kimi/messages` 代理可达 | LLM 功能可用（需 KIMI key 环境变量） |

## 4. 发布后监控点（Post-release）

- Vercel 部署日志与函数错误率（/api 代理）。
- 浏览器控制台报错（重点：音频 AudioContext、渲染 LUT）。
- 规则结算投诉（番型计分是否符合玩家预期）。

## 5. 版本号建议

**建议：`0.1.0`**

理由：
- 当前 `0.0.0` 是占位符，无语义。
- 语义化版本 `0.MINOR.PATCH`：`0.x` 表示"初始开发、公开 API 尚不稳定"，符合"首个公开测试版"定位。
- 核心玩法（规则/AI/教学）已可用且经 242 测试验证，但仍有已知缺口（英文模式图片、完整 BGM），不宜直接标 `1.0.0`。
- 后续：修残余项走 `0.1.x`（patch），加重要功能走 `0.2.0`，达到稳定公开 API 再升 `1.0.0`。

## 6. 发布就绪判定

**READY（有条件）** — 全部质量门已通过（设计评审 PASS、架构评审 PASS、Playtest 修复后 242/242 全绿、tsc 0 错）。
唯一前置：用户确认版本号并执行 §2 的步骤 1–4（改版本/打 tag/推送）。

> 注意：本机 `pnpm build` 失败是 WorkBuddy 沙箱对 vite 清空 `dist/` 的安全拦截，**非项目缺陷**，不影响 Vercel CI 部署（详见 ROLLBACK_PLAN.md 风险 R1）。
