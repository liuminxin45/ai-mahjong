# Chengdu 麻将规则包 - 遗漏功能分析

## 📋 当前已实现功能总结

### ✅ 核心麻将规则
- 碰牌（PENG）
- 明杠（MING）、暗杠（AN）、加杠（JIA）
- 点炮胡、自摸胡
- 杠上开花、抢杠胡、海底捞月
- 多家胡牌

### ✅ 番型系统（11种）
1. 平胡（PING_HU）- 1番
2. 对对胡（DUI_DUI_HU）- 2番
3. 清一色（QING_YI_SE）- 6番
4. 混一色（HUN_YI_SE）- 3番
5. 全带幺（QUAN_DAI_YAO）- 2番
6. 七对子（QI_DUI_ZI）- 4番
7. 杠上开花（GANG_SHANG_KAI_HUA）- 1番
8. 抢杠胡（QIANG_GANG_HU）- 1番
9. 海底捞月（HAI_DI_LAO_YUE）- 1番
10. 自摸（ZI_MO）- 1番
11. 门清（MEN_QING）- 1番

### ✅ 系统功能
- 事件记录系统
- 状态一致性保证
- 手牌验证
- 防御性检查
- 完整测试覆盖（29个测试用例）

---

## ❌ 遗漏的成都麻将特色规则

### 🔴 高优先级（核心规则）

#### 1. 换三张 ⭐⭐⭐
**规则说明**：
- 游戏开始前，每位玩家选择3张同花色的牌
- 按固定方向（如顺时针）传递给下家
- 必须是同一花色（万、条、筒）
- 这是成都麻将最具特色的规则之一

**实现要点**：
```typescript
type ChengduState = GameState & {
  exchangePhase?: 'SELECTING' | 'EXCHANGING' | 'COMPLETED';
  selectedTiles?: Record<PlayerId, Tile[]>;
  exchangeDirection?: 'CLOCKWISE' | 'COUNTER_CLOCKWISE' | 'OPPOSITE';
};

// 新增动作类型
type ExchangeAction = {
  type: 'EXCHANGE';
  tiles: [Tile, Tile, Tile]; // 必须3张同花色
};
```

**验证规则**：
- 必须选择3张牌
- 3张牌必须是同一花色（W/B/T）
- 不能选择字牌（如果有）

**优先级**：🔴 极高 - 这是成都麻将的标志性规则

---

#### 2. 缺一门（必胡） ⭐⭐⭐
**规则说明**：
- 胡牌时手牌中必须缺少万、条、筒三种花色中的至少一种
- 如果三种花色都有，即使和牌型也不能胡
- 这是成都麻将的硬性要求

**实现要点**：
```typescript
function hasQueYiMen(hand: Tile[], melds: Meld[]): boolean {
  const allTiles = [...hand];
  for (const meld of melds) {
    // 收集所有副露的牌
    if (meld.type === 'PENG' || meld.type === 'GANG') {
      allTiles.push(meld.tile, meld.tile, meld.tile);
    }
  }
  
  const suits = new Set(allTiles.map(t => t.suit));
  
  // 必须缺少至少一种花色（W/B/T中至少缺一种）
  const numSuits = ['W', 'B', 'T'].filter(s => suits.has(s)).length;
  return numSuits <= 2; // 最多只有2种花色
}

// 在胡牌判断中添加
if (!hasQueYiMen(hand, melds)) {
  return false; // 不能胡牌
}
```

**番型**：
- 缺一门本身不算番
- 但如果缺两门（只有一种花色），则是清一色（6番）

**优先级**：🔴 极高 - 必须实现，否则规则不完整

---

### 🟡 中优先级（常见番型）

#### 3. 根（杠牌计番）
**规则说明**：
- 每个杠算1根
- 明杠、暗杠、加杠都算
- 根数会影响最终得分倍数

**实现要点**：
```typescript
function countGen(melds: Meld[]): number {
  return melds.filter(m => m.type === 'GANG').length;
}

// 在计分时
const gen = countGen(state.melds[player]);
const baseScore = calculateScore(yakuList);
const finalScore = baseScore * Math.pow(2, gen); // 每根翻倍
```

**优先级**：🟡 中 - 影响计分，但不影响基本玩法

---

#### 4. 金钩钓（单钓将）
**规则说明**：
- 听牌时只等一张牌作为将牌（雀头）
- 其他都是刻子或顺子
- 通常加1-2番

**实现要点**：
```typescript
export type YakuType = 
  | ... // 现有番型
  | 'JIN_GOU_DIAO'; // 金钩钓

function detectJinGouDiao(pattern: WinPattern, winTile: Tile): boolean {
  // 找到包含winTile的将牌组
  const jiangGroup = pattern.groups.find(
    g => g.type === 'JIANG' && g.tiles.some(t => tileEq(t, winTile))
  );
  
  return jiangGroup !== undefined;
}
```

**优先级**：🟡 中 - 常见番型

---

#### 5. 边张、坎张、单钓
**规则说明**：
- 边张：听123的3或789的7
- 坎张：听中间的牌，如24听3
- 单钓：只听一张牌
- 通常各加1番

**实现要点**：
```typescript
export type YakuType = 
  | ... 
  | 'BIAN_ZHANG'  // 边张
  | 'KAN_ZHANG'   // 坎张
  | 'DAN_DIAO';   // 单钓

function detectSpecialWait(pattern: WinPattern, winTile: Tile, hand: Tile[]): YakuType[] {
  const yakus: YakuType[] = [];
  
  // 检测边张
  if (isBianZhang(pattern, winTile)) {
    yakus.push('BIAN_ZHANG');
  }
  
  // 检测坎张
  if (isKanZhang(pattern, winTile)) {
    yakus.push('KAN_ZHANG');
  }
  
  // 检测单钓
  if (isDanDiao(pattern, winTile)) {
    yakus.push('DAN_DIAO');
  }
  
  return yakus;
}
```

**优先级**：🟡 中 - 影响计分

---

#### 6. 天胡、地胡
**规则说明**：
- 天胡：庄家起手14张直接胡牌（极罕见）
- 地胡：闲家第一轮摸牌就胡（极罕见）
- 通常是最大番（满贯或封顶）

**实现要点**：
```typescript
export type YakuType = 
  | ... 
  | 'TIAN_HU'  // 天胡
  | 'DI_HU';   // 地胡

function detectTianDiHu(state: GameState, player: PlayerId): YakuType | null {
  // 天胡：庄家起手
  if (state.turn === 0 && player === state.dealer) {
    return 'TIAN_HU';
  }
  
  // 地胡：闲家第一轮
  if (state.turn === 1 && player !== state.dealer) {
    return 'DI_HU';
  }
  
  return null;
}
```

**优先级**：🟢 低 - 极罕见，可后续添加

---

### 🟢 低优先级（可选规则）

#### 7. 血战到底
**规则说明**：
- 一人胡牌后游戏不结束
- 继续进行，直到3人胡牌或流局
- 成都麻将的经典玩法

**实现要点**：
```typescript
type ChengduState = GameState & {
  bloodBattle?: boolean; // 是否血战模式
  huPlayers?: Set<PlayerId>; // 已胡牌的玩家
};

// 胡牌后继续游戏
if (bloodBattle && huPlayers.size < 3) {
  // 继续游戏，跳过已胡牌的玩家
  state.currentPlayer = nextActivePlayer(state);
}
```

**优先级**：🟢 低 - 可选玩法

---

#### 8. 查大叫（查花猪）
**规则说明**：
- 流局时检查每个玩家是否听牌
- 未听牌的玩家要赔付（已实现为"流局听牌罚符"）
- 查大叫：检查是否缺一门，不缺则罚分

**实现要点**：
```typescript
function checkDaJiao(hand: Tile[], melds: Meld[]): boolean {
  // 检查是否缺一门
  return !hasQueYiMen(hand, melds);
}

// 流局时
if (isWallEmpty(state)) {
  for (const player of players) {
    if (checkDaJiao(state.hands[player], state.melds[player])) {
      // 罚分（大叫）
      penalties[player] = -3000; // 或其他罚分规则
    } else if (!isTenpai(state.hands[player])) {
      // 罚分（未听牌）
      penalties[player] = -1000;
    }
  }
}
```

**优先级**：🟢 低 - 可选规则

---

#### 9. 定缺
**规则说明**：
- 换三张后，每位玩家选择一门花色作为"定缺"
- 整局游戏中不能使用该花色的牌（必须打出）
- 比"缺一门"更严格

**实现要点**：
```typescript
type ChengduState = GameState & {
  dingQue?: Record<PlayerId, 'W' | 'B' | 'T'>; // 每个玩家定的缺门
};

// 验证出牌
if (action.type === 'DISCARD') {
  const dingQueSuit = state.dingQue?.[player];
  if (dingQueSuit && action.tile.suit === dingQueSuit) {
    // 允许打出定缺的牌
  } else if (dingQueSuit && hasTileOfSuit(hand, dingQueSuit)) {
    // 手中还有定缺的牌，不能打其他花色
    return state; // 非法操作
  }
}
```

**优先级**：🟢 低 - 可选规则，较复杂

---

## 📊 优先级总结

### 必须实现（影响基本玩法）
1. 🔴 **换三张** - 成都麻将标志性规则
2. 🔴 **缺一门** - 胡牌必要条件

### 建议实现（完善计分）
3. 🟡 **根（杠牌计番）** - 影响得分
4. 🟡 **金钩钓** - 常见番型
5. 🟡 **边张、坎张、单钓** - 常见番型

### 可选实现（特殊玩法）
6. 🟢 **天胡、地胡** - 极罕见
7. 🟢 **血战到底** - 可选玩法
8. 🟢 **查大叫** - 可选规则
9. 🟢 **定缺** - 可选规则，较复杂

---

## 🎯 实现建议

### 第一阶段：核心规则（必须）
1. 实现**换三张**机制
   - 新增游戏阶段：`EXCHANGE`
   - 新增动作类型：`EXCHANGE`
   - 验证同花色规则
   - 实现传递逻辑

2. 实现**缺一门**验证
   - 在 `findWinPatterns` 或 `detectYaku` 中添加验证
   - 修改 `getLegalActions` 中的胡牌判断
   - 添加测试用例

### 第二阶段：番型完善（建议）
3. 添加**根**的计分逻辑
4. 添加**金钩钓**番型
5. 添加**边张、坎张、单钓**番型

### 第三阶段：特殊玩法（可选）
6. 实现**血战到底**模式
7. 实现**查大叫**规则
8. 实现**天胡、地胡**
9. 实现**定缺**规则

---

## 📝 代码结构建议

### 新增文件
```
src/core/rules/packs/chengdu/
├── index.ts              # 主规则包（现有）
├── patterns.ts           # 番型判断（现有）
├── utils.ts              # 工具函数（现有）
├── tenpai.ts            # 听牌判断（现有）
├── exchange.ts          # 换三张逻辑（新增）⭐
├── validation.ts        # 缺一门等验证（新增）⭐
└── scoring.ts           # 根、倍数计算（新增）
```

### 类型扩展
```typescript
// 游戏阶段
type GamePhase = 
  | 'INIT'
  | 'EXCHANGE'      // 新增：换三张阶段
  | 'PLAYING'
  | 'END';

// 动作类型
type Action = 
  | ... // 现有动作
  | { type: 'EXCHANGE'; tiles: [Tile, Tile, Tile] }  // 新增
  | { type: 'CONFIRM_EXCHANGE' };                    // 新增

// 状态扩展
type ChengduState = GameState & {
  // 现有字段...
  exchangePhase?: 'SELECTING' | 'EXCHANGING' | 'COMPLETED';
  selectedTiles?: Record<PlayerId, Tile[]>;
  exchangeDirection?: 'CLOCKWISE' | 'COUNTER_CLOCKWISE' | 'OPPOSITE';
  dingQue?: Record<PlayerId, 'W' | 'B' | 'T'>;
};
```

---

## ✅ 总结

当前 Chengdu 规则包已经实现了：
- ✅ 基础麻将规则（碰、杠、胡）
- ✅ 11种番型
- ✅ 计分系统
- ✅ 特殊规则（杠上开花、抢杠胡等）
- ✅ 完整测试覆盖

**关键遗漏**：
- ❌ **换三张**（成都麻将最具特色的规则）
- ❌ **缺一门**（胡牌必要条件）
- ❌ 根的计分逻辑
- ❌ 部分常见番型（金钩钓、边坎单等）

**建议优先实现换三张和缺一门**，这两个是成都麻将区别于其他麻将的核心规则！
