# 麻将研习 · ai-mahjong

条筒双花色麻将学习工具，面向认牌、牌形、向听、进张、何切、多面听、七对与攻防情境训练。

正式入口：[麻将研习](https://www.liuminxin.cn/works/mahjong)。独立仓库维护引擎、题库、课程、React界面和imagegen麻将资源；个人网站通过完整提交SHA引用本包，并提供匿名画像服务。

## 规则与边界

- 一至九筒、一至九条，每种四张，共72张。
- 普通型为四组面子加一对将；七对允许四张同牌算两对，且无固定组合。
- 分析支持顺子、刻子、杠子的固定组合；物理张数与结构张数分别校验。
- 不提供完整对局、地区计分、立直役种或自博弈。攻防题给出明确的教学假设与评分目标，不推断真实放铳概率。

## 本地运行

使用Node 24.19.0、pnpm 9.15.0：

```sh
pnpm install
pnpm dev
pnpm test:run
pnpm build
pnpm build:package
pnpm check:ui
```

默认地址为http://127.0.0.1:5173。Git依赖需要正常执行prepare，不使用ignore-scripts。Windows的pnpm虚拟目录已限制长度，避免Git依赖中的井号影响Vite资源URL。

## 功能

专项练习、13/14张与固定组合手牌分析、20题测验、错题收藏和1/3/7天复习、8单元24节原创手册，以及学习统计和主动生成的画像。

题库含40道牌效/听牌/七对种子题与40道原创攻防题设；牌效题另可按种子生成。并列最优答案全部接受。提示、复习与重复题不增加独立样本。

练习、错题、进度和报告副本默认存IndexedDB；支持备份导入导出。完成一次作答即可主动生成初步画像；上传全部历史记录，包括提示与复习，不再截取最近100题。传输采用无损紧凑格式，服务端重建题目并重新判分，再将全量分项统计、时间变化与最多40条代表证据交给本站模型。独立正确率只计算首次无提示作答，单项不足5道独立样本不作能力判断。快照v2兼容旧版v1报告备份；记录校验与备份共用50000条上限，超限明确拒绝、不静默截断。画像服务位于个人网站/api/assistant/mahjong，独立应用没有内置密钥；未接入服务时，本地学习功能仍可用。

## 包接口

- 主入口：MahjongApp与createProfileClient。
- /engine：无DOM依赖的规则校验、向听、听口、进张和拆解。
- /learning：课程、可复建题库、判分、快照及画像校验。
- /worker：可由宿主Vite以?worker加载的分析线程。
- /styles.css：局部业务布局。

MahjongApp使用宿主路由，接收basePath、assetsBaseUrl、主题、Worker工厂与画像客户端。宿主使用/works/mahjong/*，通过懒加载隔离学习工具。基础UI固定使用chatgpt-desktop-kit 0.8.6，提交1845915f76e6cc5834f053d5666517650960aa89。

## 资源与验证

assets/tiles/source保留20张imagegen原始PNG，prompts.json保存提示词；manifest.json绑定SHA与96/192/384px WebP。node scripts/tiles.mjs重新压缩，node scripts/stage-assets.mjs为独立预览分发资源。牌图图案由imagegen生成，压缩脚本不重画符号。

测试包含独立单花色完整和型枚举对照、四张上限、见尽牌、舍牌剩余数、题库重建、证据去重、导入重判和IndexedDB事务。pnpm test:browser检查Chromium/WebKit六种宽度与深浅主题，截图和结果保存在被忽略的artifacts/。浏览器模拟不等同于真机验收。

旧版成都麻将代码保留在Git历史，旧对局、回放与参数不迁入新存储。学习规则和内容使用版本号，升级不兼容时应明确拒绝旧证据，而非静默重判。

## 网站安装产物

正式网站安装GitHub Release上的预构建包，发布标签包含完整源码提交号。包内的build-info.json记录相同提交，网站分发资源前会核对依赖URL与该提交是否一致；锁文件校验包完整性。运行包只含编译模块、WebP与资源清单，原始PNG继续保存在本仓库。共享UI仍使用固定Git提交并正常执行prepare，应用源码只有这一份。
