# 未完的牌谱

“哥，快来。赢了算我的。”

除夕进门，妹妹把你拉到牌桌边。五局连续摸打，从桌边的半个橘子，到她后来独自改过的答案，翻完一本没画完的牌谱。

每章一局，摸一张、打一张，原来的牌留下。五章各有三种固定开局，胜负自然结束，不再硬凑25次选择。“我的取舍”只谈有答题证据的选择，不给人格贴标签。

正式入口：[未完的牌谱](https://www.liuminxin.cn/works/mahjong)。

## 规则与数学

- 条、筒共72张；普通和型与七对，四张相同牌可算两对。首版故事仅摸打与和牌，不操作吃碰杠，不覆盖完整成都麻将。
- 保留既有三番封顶计番与基础分；同一张实体牌不重复使用，所有已见、舍牌、固定组合均扣减物理张数。
- 每局开始绑定完整72张实体牌、既定开局和牌墙种子。四席均可合法和牌，只有牌墙真实耗尽才流局；NPC只依据自己手牌与公开牌河。
- 新故事只解释公开条件下的向听、进张和路线取舍，不冒充完整实战期望收益或用隐藏牌墙评价过去。胜负不改写先前选择。
- 旧题保留原有精确整数证书及独立校验器。新牌局的所有实体转移、自然终局由独立牌数与完整和型枚举复核。
- 全历史参与重判与分层统计。提示、复习、重复故事及首尾配对不增加独立样本；不同难度、模型与窗口分开。模型只能选择已有观察和人工自问。

规则来源：[MIL四川麻将规则纲要](https://mahjong-mil.org/wp-content/uploads/2024/08/Brief_Introduction_to_Bloody_Mahjong-1.pdf)。模型概率和得分只适用于题设，不能换算为完整实战胜率。

## 运行与集成

Node 24.19.0，pnpm 9.15.0。

~~~sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm build:package
~~~

公共控件固定使用[ChatGPT Desktop UI](https://github.com/liuminxin45/ChatGPT-Desktop-UI) 0.8.6，提交1845915f76e6cc5834f053d5666517650960aa89。嵌入时共享宿主路由与主题，不创建第二个浏览器路由器。

- 根包导出MahjongApp、createTableClient；/journey导出连续牌局与快照8、报告6核验；旧/story、/decision、/training、/learning保持兼容。
- IndexedDB自动保留新旧答题、草稿与回望；界面不提供课程、比赛、主题设置或导入导出。
- 远端模型不可用仍可通关。上传前需主动确认，签名访客归属、90天存档、55秒服务截止与70秒客户端等待沿用宿主。
- 五首Kevin MacLeod钢琴及六种Kenney音效见[署名与许可](assets/audio/CREDITS.md)。发布音频约11.1MB，固定从GitHub资产提交下载；不包含在宿主发布包或EdgeOne中。
- 首次完整准备音频、六幅原创场景、八个人物姿态和当前设备一档牌图，真实字节进度、SHA256核验及可播放检查通过后开始。CacheStorage按内容摘要复用，失败可重试，无存储时使用本次内存。Web Audio不可用时以原生音频检查和播放，不引入其他资源源站。

## 验证与制作

~~~sh
pnpm test:coverage
pnpm story:verify
pnpm bank:verify
pnpm test:oracle
pnpm check:ui
pnpm build:package
# 另开本地预览后：
pnpm test:journey-browser
~~~

故事题与续练题全部可由提交的数据独立复核。校验缓存按完整内容摘要失效；旧题ID、答案和历史意义不改写。story:build仅供制作新内容版本，发布版本不可原地重建。

见[连续故事与实现边界](docs/continuous-journey.md)、[当前验收用例](docs/continuous-test-cases.md)。旧版35张节点制作卡保留原意。浏览器仿真不等于实体手机验证；音乐整段听审、真人故事试玩和难度标定单独记录。
