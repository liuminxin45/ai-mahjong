# 麻将研习

只练一件事：这一手，打哪张？

围绕成都麻将缺门后的条、筒专项，在成牌机会与牌型价值之间学习取舍。每组5手，系统穿插错题与未见过的迁移题；答后可以展开舍牌比较、牌形拆解、计番和计算依据。

- 条、筒各一至九，每种四张；双花色72张是工具约定。
- 采用MIL公开四川规则中的普通和型、七对、根、碰碰胡、金钩钓与清一色，三番封顶。
- 每题明确均匀不放回抽牌条件，比较未来有限次数内的期望基础分；未成牌计零，首次成牌结束。不计算对手行为、自摸加点、杠分或特殊事件番。
- 离线精确求解同时计算综合收益策略和快听策略；接受所有期望基础分精确并列的舍牌，浏览器只读取已验证结果。
- 240道常规题、80道保留迁移题、12道讲解例题，按整手牌结构去重。深度题需要主动开启。
- “我的习惯”按知识点、难度与摸牌条件展示证据。主动上传后由服务端重判全历史，再压缩交给本站模型解释。
- 本地IndexedDB保存记录，支持备份与导入；旧题、旧报告及草稿保留，旧牌效不追溯换算成计番表现。

正式入口：[麻将研习](https://www.liuminxin.cn/works/mahjong)。不提供自由摆牌、完整对局、比赛或聊天。

## 运行

使用Node 24.19.0与pnpm 9.15.0。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm build:package
```

React组件通过 `@neo/mahjong-learning` 导出；纯TypeScript计番、求解、题库和证据接口通过 `@neo/mahjong-learning/decision` 导出。宿主提供路由、主题与模型客户端，不嵌套浏览器路由器。

公共控件固定使用[ChatGPT Desktop UI](https://github.com/liuminxin45/ChatGPT-Desktop-UI)提交 `1845915f76e6cc5834f053d5666517650960aa89`。

## 验证

```sh
pnpm test:coverage
pnpm bank:verify
pnpm decision:verify
pnpm test:oracle
pnpm check:ui
```

完整独立校验可按 `--level=1` 至 `--level=4` 分片。求解预算不足的题目不发布；独立校验采用物理牌路径枚举和另写的计番实现。

浏览器脚本覆盖Chromium、WebKit，六档宽度和深浅主题。详情见[测试用例](docs/decision-test-cases.md)。模拟触屏不等于真机测试；难度为设计分级，不声称已完成人群标定。

规则依据：[MIL四川麻将规则纲要](https://mahjong-mil.org/wp-content/uploads/2024/08/Brief_Introduction_to_Bloody_Mahjong-1.pdf)。概率、期望基础分和用时均限于题设模型，不代表真实实战胜率。
