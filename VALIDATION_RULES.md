# 出牌校验规则文档

## 概述

出牌校验系统用于确保所有玩家（人类和AI）的出牌动作符合规则要求。每个规则包可以定义自己的校验规则。

## 系统架构

### 核心接口

**文件**: `src/core/rules/validation/types.ts`

```typescript
interface DiscardValidator {
  // 校验单张牌是否可以打出
  validateDiscard(state: GameState, playerId: PlayerId, tile: Tile): ValidationResult;
  
  // 获取所有合法的出牌选项
  getLegalDiscards(state: GameState, playerId: PlayerId): Tile[];
  
  // 获取校验规则的描述
  getDescription(): string;
}

interface ValidationResult {
  valid: boolean;           // 是否合法
  reason?: string;          // 不合法的原因
  suggestedTiles?: Tile[];  // 建议的合法牌
}
```

### RulePack 集成

**文件**: `src/core/rules/RulePack.ts`

```typescript
interface RulePack {
  // 可选方法：返回该规则包的校验器
  getDiscardValidator?(): DiscardValidator | null;
}
```

---

## 成都麻将校验规则

**文件**: `src/core/rules/packs/chengdu/validator.ts`

### 规则说明

#### 1. 定缺规则（Missing Suit Rule）

**规则内容**：
- 玩家在"定缺"阶段选择一个花色作为缺门
- 定缺后，必须先打完手中所有缺门的牌
- 只有当手中没有缺门牌时，才能打其他花色的牌

**实现逻辑**：
```typescript
validateDiscard(state, playerId, tile) {
  // 1. 获取玩家的缺门花色
  const missingSuit = state.dingQueSelection[playerId];
  
  // 2. 如果还没定缺，任何牌都可以打
  if (!missingSuit) return { valid: true };
  
  // 3. 检查手中是否还有缺门牌
  const hasMissingSuitTiles = hand.some(t => t.suit === missingSuit);
  
  // 4. 如果有缺门牌，必须打缺门牌
  if (hasMissingSuitTiles && tile.suit !== missingSuit) {
    return {
      valid: false,
      reason: "Must discard missing suit tiles first",
      suggestedTiles: hand.filter(t => t.suit === missingSuit)
    };
  }
  
  // 5. 其他情况合法
  return { valid: true };
}
```

### 校验时机

#### 人类玩家
- **时机**: 点击手牌尝试出牌时
- **位置**: `GameOrchestrator.dispatchHumanAction()`
- **行为**: 
  - 不合法：显示 Alert 提示，阻止出牌
  - 合法：正常执行出牌

#### AI 玩家
- **时机**: AI 决策完成后，执行动作前
- **位置**: `GameOrchestrator.loop()` 游戏主循环
- **行为**:
  - 不合法：记录错误日志，标记 AI 逻辑错误
  - 合法：正常执行出牌

### 错误处理

#### 人类玩家违规
```
❌ Alert 弹窗:
Cannot discard this tile!

Must discard Wan (万) tiles first (missing suit rule)

💡 Console 提示:
Suggested tiles: W1, W2, W3
```

#### AI 玩家违规
```
❌ Console Error:
[Validator] ❌ P1 attempted invalid discard: Must discard Wan tiles first
[Validator] This should not happen - AI or rule logic error!
[Validator] AI P1 violated discard rules!
[Validator] Legal discards for P1: [W1, W2, W3]
```

---

## 如何添加新的校验规则

### 步骤 1: 创建校验器类

```typescript
// src/core/rules/packs/yourpack/validator.ts
import type { DiscardValidator, ValidationResult } from '../../validation/types';

export class YourPackValidator implements DiscardValidator {
  validateDiscard(state, playerId, tile): ValidationResult {
    // 实现你的校验逻辑
    if (/* 不合法的条件 */) {
      return {
        valid: false,
        reason: "Your rule violation reason",
        suggestedTiles: /* 建议的合法牌 */
      };
    }
    return { valid: true };
  }

  getLegalDiscards(state, playerId): Tile[] {
    // 返回所有合法的出牌选项
    return state.hands[playerId].filter(/* 过滤条件 */);
  }

  getDescription(): string {
    return "Your Pack Discard Rules: Description";
  }
}

export function createYourPackValidator(): DiscardValidator {
  return new YourPackValidator();
}
```

### 步骤 2: 在规则包中集成

```typescript
// src/core/rules/packs/yourpack/index.ts
import { createYourPackValidator } from './validator';

export const yourRulePack: RulePack = {
  getDiscardValidator(): DiscardValidator {
    return createYourPackValidator();
  },
  // ... 其他方法
};
```

### 步骤 3: 测试

1. 启动游戏，选择你的规则包
2. 观察控制台：`📋 Discard validator loaded: Your Pack Discard Rules`
3. 尝试违规出牌，验证校验是否生效

---

## 调试技巧

### 启用详细日志

所有校验动作都会在控制台输出：

```javascript
// 人类玩家出牌
[Validator] ❌ Invalid discard: Must discard Wan tiles first
[Validator] 💡 Suggested tiles: [W1, W2, W3]

// AI 玩家出牌
[Validator] ✅ P1 discard validated
[Validator] ✅ P2 discard validated
```

### 查看合法出牌选项

```javascript
// 在控制台运行
const validator = gameOrchestrator.rulePack.getDiscardValidator();
const legalDiscards = validator.getLegalDiscards(currentState, 'P0');
console.log('Legal discards:', legalDiscards);
```

---

## 性能考虑

- 校验在每次出牌前执行，应保持高效
- 避免在校验器中进行复杂计算
- 建议时间复杂度: O(n)，n 为手牌数量

---

## 维护指南

### 修改现有规则

1. 修改 `validator.ts` 中的校验逻辑
2. 更新本文档中的规则说明
3. 添加测试用例验证修改
4. 提交时注明规则变更

### 添加新规则

1. 在 `validateDiscard` 中添加新的检查条件
2. 更新 `getLegalDiscards` 以反映新规则
3. 在本文档中添加新规则的说明
4. 添加示例和测试用例

---

## 常见问题

### Q: 为什么 AI 也需要校验？

A: AI 校验用于：
1. 检测 AI 逻辑错误
2. 确保规则一致性
3. 便于调试和测试

### Q: 校验失败会影响游戏进行吗？

A: 
- 人类玩家：阻止非法出牌，游戏继续
- AI 玩家：记录错误但继续游戏，避免卡死

### Q: 如何禁用校验？

A: 在规则包中不实现 `getDiscardValidator` 方法，或返回 `null`

---

## 更新日志

### 2025-12-19
- ✅ 创建校验系统基础架构
- ✅ 实现成都麻将定缺规则校验
- ✅ 集成到 GameOrchestrator
- ✅ 应用于所有玩家（人类和AI）
- ✅ 创建本文档

---

## 相关文件

- `src/core/rules/validation/types.ts` - 校验接口定义
- `src/core/rules/packs/chengdu/validator.ts` - 成都麻将校验实现
- `src/core/rules/RulePack.ts` - RulePack 接口
- `src/orchestration/GameOrchestrator.ts` - 校验集成
