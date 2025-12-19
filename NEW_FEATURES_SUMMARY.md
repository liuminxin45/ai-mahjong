# Chengdu 麻将新功能实现总结

## ✅ 已完成的 4 大新功能

### 1. 缺一门（Que Yi Men）⭐⭐⭐
**成都麻将必胡条件**

#### 实现内容
- 新增 `hasQueYiMen()` 函数验证手牌是否满足缺一门
- 在 `getLegalActions` 的所有胡牌判断中集成验证
- 支持点炮胡、自摸胡、抢杠胡的缺一门检查

#### 规则说明
- 手牌中必须缺少万、条、筒三种花色中的至少一种
- 如果三种花色都有，即使和牌型也**不能胡**
- 清一色（只有一种花色）自动满足缺一门

#### 代码位置
- `src/core/rules/packs/chengdu/patterns.ts` - `hasQueYiMen()` 函数
- `src/core/rules/packs/chengdu/index.ts` - 集成到胡牌判断

#### 测试覆盖（3个测试）
```typescript
✅ should allow win with que yi men (missing one suit)
✅ should prevent win without que yi men (has all three suits)  
✅ should allow qing yi se (pure suit) which satisfies que yi men
```

---

### 2. 根（Gen）⭐⭐
**杠牌计分倍数**

#### 实现内容
- 修改 `calculateScore()` 函数，新增 `genCount` 参数
- 每个杠（明杠、暗杠、加杠）算 1 根
- 根数影响最终得分：`finalScore = baseScore * 2^genCount`

#### 计分示例
```typescript
平胡（1番）基础分 500
- 0根: 500
- 1根: 1000  (500 * 2^1)
- 2根: 2000  (500 * 2^2)
- 3根: 4000  (500 * 2^3)

清一色+对对胡（8番）基础分 4000
- 0根: 4000
- 1根: 8000  (4000 * 2^1)
```

#### 代码位置
- `src/core/rules/packs/chengdu/patterns.ts` - `calculateScore(yakuList, genCount)`

#### 测试覆盖（2个测试）
```typescript
✅ should calculate score with gen multiplier
✅ should calculate score with high fan and gen
```

---

### 3. 金钩钓（Jin Gou Diao）⭐⭐
**单钓将牌番型**

#### 实现内容
- 新增 `JIN_GOU_DIAO` 番型（2番）
- 在 `detectYaku()` 中自动检测
- 当和牌是将牌（雀头）时触发

#### 规则说明
- 听牌时只等一张将牌（对子）
- 其他都是刻子或顺子
- 加 **2番**

#### 检测逻辑
```typescript
// 找到将牌组
const jiangGroup = pattern.groups.find(g => g.type === 'JIANG');
// 检查和牌是否是将牌
if (jiangGroup && jiangGroup.tiles.some(t => tileEq(t, winTile))) {
  yakuList.push({ type: 'JIN_GOU_DIAO', fan: 2, description: '金钩钓' });
}
```

#### 代码位置
- `src/core/rules/packs/chengdu/patterns.ts` - 番型定义和检测

#### 测试覆盖（2个测试）
```typescript
✅ should detect jin gou diao when winning on pair
✅ should not detect jin gou diao when winning on sequence
```

---

### 4. 换三张（Huan San Zhang）⭐⭐⭐
**成都麻将标志性规则**

#### 实现内容
- 新增 `exchange.ts` 模块
- `validateExchangeTiles()` - 验证同花色规则
- `performExchange()` - 执行换牌逻辑
- `removeTilesFromHand()` - 从手牌移除指定牌

#### 规则说明
- 游戏开始前，每位玩家选择 3 张**同花色**的牌
- 按固定方向传递给其他玩家
- 支持三种方向：
  - `CLOCKWISE` - 顺时针（P0→P1→P2→P3→P0）
  - `COUNTER_CLOCKWISE` - 逆时针（P0→P3→P2→P1→P0）
  - `OPPOSITE` - 对家（P0↔P2, P1↔P3）

#### 验证规则
```typescript
validateExchangeTiles(tiles: Tile[]): boolean {
  // 1. 必须是3张牌
  if (tiles.length !== 3) return false;
  
  // 2. 必须同花色（W/B/T）
  const firstSuit = tiles[0].suit;
  return tiles.every(t => t.suit === firstSuit);
}
```

#### 代码位置
- `src/core/rules/packs/chengdu/exchange.ts` - 完整实现

#### 测试覆盖（4个测试）
```typescript
✅ should validate same suit tiles
✅ should perform clockwise exchange
✅ should perform counter-clockwise exchange
✅ should perform opposite exchange
```

---

## 📊 测试结果

### 总体统计
```
✅ Test Files: 1 passed
✅ Tests: 40 passed (100%)
   - 原有测试: 29 passed
   - 新增测试: 11 passed ⭐
⏱️  Duration: 1.98s
```

### 新增测试明细（11个）

#### 缺一门（3个）
1. ✅ 允许缺一门的胡牌（缺筒）
2. ✅ 阻止不缺门的胡牌（三种花色都有）
3. ✅ 清一色满足缺一门

#### 金钩钓（2个）
4. ✅ 检测单钓将牌
5. ✅ 不检测顺子听牌

#### 根（2个）
6. ✅ 根的倍数计算（0-3根）
7. ✅ 高番+根的计算

#### 换三张（4个）
8. ✅ 验证同花色规则
9. ✅ 顺时针换牌
10. ✅ 逆时针换牌
11. ✅ 对家换牌

---

## 📁 修改的文件

### 1. `src/core/rules/packs/chengdu/patterns.ts`
**新增内容**：
- `JIN_GOU_DIAO` 番型定义
- `hasQueYiMen()` 函数
- `calculateScore()` 增加 `genCount` 参数
- `detectYaku()` 中增加金钩钓检测

**修改行数**：约 50 行

### 2. `src/core/rules/packs/chengdu/index.ts`
**新增内容**：
- 导入 `hasQueYiMen`
- 在 3 处胡牌判断中集成缺一门验证
  - 抢杠胡响应
  - 点炮胡响应
  - 自摸胡判断

**修改行数**：约 15 行

### 3. `src/core/rules/packs/chengdu/exchange.ts` ⭐
**新增文件**：
- `validateExchangeTiles()` - 验证函数
- `performExchange()` - 换牌逻辑
- `removeTilesFromHand()` - 辅助函数

**总行数**：约 80 行

### 4. `src/core/rules/packs/chengdu/chengduRulePack.test.ts`
**新增内容**：
- 新增测试套件 `new features: que yi men, gen, jin gou diao, exchange`
- 11 个新测试用例

**新增行数**：约 260 行

---

## 🎯 功能完整度

### 当前已实现（完整）
| 功能 | 状态 | 优先级 | 说明 |
|------|------|--------|------|
| 基础麻将规则 | ✅ | 必须 | 碰、杠、胡 |
| 12种番型 | ✅ | 必须 | 含金钩钓 |
| 缺一门 | ✅ | 必须 | 胡牌必要条件 |
| 根计分 | ✅ | 建议 | 杠牌倍数 |
| 换三张 | ✅ | 必须 | 核心特色 |
| 事件记录 | ✅ | 必须 | 完整 |
| 状态一致性 | ✅ | 必须 | 完整 |
| 测试覆盖 | ✅ | 必须 | 40个测试 |

### 待实现（可选）
| 功能 | 优先级 | 说明 |
|------|--------|------|
| 边张、坎张、单钓 | 🟡 中 | 听牌形态番型 |
| 天胡、地胡 | 🟢 低 | 极罕见 |
| 血战到底 | 🟢 低 | 可选玩法 |
| 查大叫 | 🟢 低 | 流局罚分 |
| 定缺 | 🟢 低 | 可选规则 |

---

## 💡 使用示例

### 1. 缺一门验证
```typescript
import { hasQueYiMen } from './patterns';

const hand = [
  { suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 },
  { suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 },
  // ... 缺筒
];

const melds = [
  { type: 'PENG', tile: { suit: 'W', rank: 5 } }
];

if (hasQueYiMen(hand, melds)) {
  console.log('满足缺一门，可以胡牌');
} else {
  console.log('不满足缺一门，不能胡牌');
}
```

### 2. 根计分
```typescript
import { calculateScore } from './patterns';

const yakuList = [
  { type: 'QING_YI_SE', fan: 6, description: '清一色' },
  { type: 'DUI_DUI_HU', fan: 2, description: '对对胡' },
];

const genCount = 2; // 2个杠

const score = calculateScore(yakuList, genCount);
console.log(`得分: ${score}`); // 4000 * 2^2 = 16000
```

### 3. 换三张
```typescript
import { validateExchangeTiles, performExchange } from './exchange';

// 验证选择的牌
const tiles = [
  { suit: 'W', rank: 1 },
  { suit: 'W', rank: 5 },
  { suit: 'W', rank: 9 },
];

if (validateExchangeTiles(tiles)) {
  console.log('有效的换牌选择');
}

// 执行换牌
const selections = {
  P0: [{ suit: 'W', rank: 1 }, { suit: 'W', rank: 2 }, { suit: 'W', rank: 3 }],
  P1: [{ suit: 'B', rank: 1 }, { suit: 'B', rank: 2 }, { suit: 'B', rank: 3 }],
  P2: [{ suit: 'T', rank: 1 }, { suit: 'T', rank: 2 }, { suit: 'T', rank: 3 }],
  P3: [{ suit: 'W', rank: 7 }, { suit: 'W', rank: 8 }, { suit: 'W', rank: 9 }],
};

const result = performExchange(selections, 'CLOCKWISE');
// P0 收到 P3 的牌
// P1 收到 P0 的牌
// P2 收到 P1 的牌
// P3 收到 P2 的牌
```

---

## 🚀 集成建议

### 1. 在 Orchestrator 中使用根计分
```typescript
// 统计杠的数量
const genCount = state.melds[player].filter(m => m.type === 'GANG').length;

// 计算得分时传入根数
const score = calculateScore(yakuList, genCount);
```

### 2. 换三张流程集成
```typescript
// 游戏开始前添加换三张阶段
type GamePhase = 'INIT' | 'EXCHANGE' | 'PLAYING' | 'END';

// 1. 玩家选择3张同花色的牌
const selections = collectPlayerSelections();

// 2. 验证所有选择
for (const [player, tiles] of Object.entries(selections)) {
  if (!validateExchangeTiles(tiles)) {
    throw new Error(`${player} 的选择无效`);
  }
}

// 3. 执行换牌
const exchanged = performExchange(selections, 'CLOCKWISE');

// 4. 更新手牌
for (const [player, tiles] of Object.entries(exchanged)) {
  // 移除选择的牌
  state.hands[player] = removeTilesFromHand(
    state.hands[player], 
    selections[player]
  );
  // 添加收到的牌
  state.hands[player].push(...tiles);
}
```

---

## ✨ 总结

### 实现成果
- ✅ **4 大核心功能**全部实现
- ✅ **11 个新测试用例**，100% 通过
- ✅ **缺一门**和**换三张**是成都麻将最核心的特色
- ✅ **根**和**金钩钓**完善了计分系统
- ✅ 代码质量高，测试覆盖完整

### 当前状态
Chengdu 规则包现在已经实现了：
- ✅ 完整的基础麻将规则
- ✅ 12 种番型（含金钩钓）
- ✅ 缺一门必胡条件
- ✅ 根的倍数计分
- ✅ 换三张机制
- ✅ 40 个测试用例（100% 通过）

### 下一步建议
如需进一步完善，可以考虑：
1. 🟡 添加边张、坎张、单钓番型（常见）
2. 🟢 实现血战到底模式（可选玩法）
3. 🟢 添加天胡、地胡（极罕见但完整）

**Chengdu 规则包已经是一个功能完整、稳定可靠的成都麻将实现！** 🎉
