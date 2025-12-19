# 换三张自动集成方案

## 问题分析

当前架构的限制：
- `GameOrchestrator` 调用 `buildInitialState()` 后直接进入 `PLAYING` 阶段
- `Phase` 类型原本只有 `'INIT' | 'PLAYING' | 'END'`
- 没有规则包特定的阶段扩展机制

## ✅ 解决方案：规则包自定义阶段

### 方案概述

通过以下步骤实现换三张的自动集成：

1. ✅ **已完成**：扩展 `Phase` 类型支持自定义阶段
2. **需要实现**：修改 Chengdu 规则包的初始化
3. **需要实现**：在 `getLegalActions` 中处理 `EXCHANGE` 阶段
4. **需要实现**：在 `applyAction` 中处理换三张动作

---

## 实现步骤

### 1. Phase 类型扩展 ✅

已修改 `src/core/model/state.ts`：

```typescript
export type Phase = 'INIT' | 'PLAYING' | 'END' | string; // 允许规则包自定义阶段
```

### 2. 定义换三张动作类型

需要在 `src/core/model/action.ts` 中添加：

```typescript
export type Action =
  | { type: 'DRAW' }
  | { type: 'DISCARD'; tile: Tile }
  | { type: 'PENG'; tile: Tile; from: PlayerId }
  | { type: 'GANG'; tile: Tile; from: PlayerId; gangType: 'MING' | 'AN' | 'JIA' }
  | { type: 'HU'; tile?: Tile; from?: PlayerId }
  | { type: 'PASS' }
  | { type: 'EXCHANGE'; tiles: [Tile, Tile, Tile] }  // 新增
  | { type: 'CONFIRM_EXCHANGE' };                     // 新增
```

### 3. 修改 Chengdu 的 buildInitialState

在 `src/core/rules/packs/chengdu/index.ts` 中：

```typescript
export const chengduRulePack: RulePack = {
  ...placeholderRulePack,
  
  buildInitialState(): GameState {
    const baseState = placeholderRulePack.buildInitialState();
    
    // Chengdu 规则：初始阶段是换三张
    return {
      ...baseState,
      phase: 'EXCHANGE', // 自定义阶段
      exchangeSelections: {
        P0: [],
        P1: [],
        P2: [],
        P3: [],
      },
      exchangeConfirmed: {
        P0: false,
        P1: false,
        P2: false,
        P3: false,
      },
    } as ChengduState;
  },
  
  // ...
};
```

### 4. 在 getLegalActions 中处理 EXCHANGE 阶段

```typescript
getLegalActions(state: GameState, player: PlayerId): Action[] {
  const chengduState = state as ChengduState;
  
  // 换三张阶段
  if (state.phase === 'EXCHANGE') {
    const selections = chengduState.exchangeSelections?.[player] || [];
    const confirmed = chengduState.exchangeConfirmed?.[player] || false;
    
    if (confirmed) {
      return [{ type: 'PASS' }]; // 已确认，等待其他玩家
    }
    
    if (selections.length === 3) {
      return [{ type: 'CONFIRM_EXCHANGE' }]; // 可以确认
    }
    
    // 返回可选择的牌（手牌中的所有牌）
    return state.hands[player].map(tile => ({
      type: 'EXCHANGE',
      tiles: [tile, tile, tile], // UI 需要处理选择逻辑
    }));
  }
  
  // PLAYING 阶段的逻辑...
  if (state.phase !== 'PLAYING') return [];
  // ...
}
```

### 5. 在 applyAction 中处理换三张

```typescript
applyAction(state: GameState, action: Action): GameState {
  const chengduState = state as ChengduState;
  
  // 处理换三张选择
  if (action.type === 'EXCHANGE' && state.phase === 'EXCHANGE') {
    const player = state.currentPlayer;
    
    // 验证同花色
    if (!validateExchangeTiles(action.tiles)) {
      console.warn('Exchange tiles must be same suit');
      return state;
    }
    
    return {
      ...state,
      exchangeSelections: {
        ...chengduState.exchangeSelections,
        [player]: action.tiles,
      },
    } as ChengduState;
  }
  
  // 处理确认换三张
  if (action.type === 'CONFIRM_EXCHANGE' && state.phase === 'EXCHANGE') {
    const player = state.currentPlayer;
    const newState = {
      ...state,
      exchangeConfirmed: {
        ...chengduState.exchangeConfirmed,
        [player]: true,
      },
    } as ChengduState;
    
    // 检查是否所有玩家都确认了
    const allConfirmed = Object.values(newState.exchangeConfirmed!).every(c => c);
    
    if (allConfirmed) {
      // 执行换牌
      const exchanged = performExchange(
        newState.exchangeSelections!,
        'CLOCKWISE' // 或从配置读取
      );
      
      // 更新手牌
      const newHands = { ...newState.hands };
      for (const [pid, tiles] of Object.entries(exchanged)) {
        const playerId = pid as PlayerId;
        // 移除选择的牌
        const remaining = removeTilesFromHand(
          newHands[playerId],
          newState.exchangeSelections![playerId]
        );
        if (remaining) {
          newHands[playerId] = [...remaining, ...tiles];
        }
      }
      
      // 进入 PLAYING 阶段
      return {
        ...newState,
        hands: newHands,
        phase: 'PLAYING',
        exchangeSelections: undefined,
        exchangeConfirmed: undefined,
      } as ChengduState;
    }
    
    return newState;
  }
  
  // 其他动作的处理...
  // ...
}
```

---

## 优点

### ✅ 自动集成
- 切换到 Chengdu 规则包时，自动进入换三张阶段
- 不需要修改 `GameOrchestrator` 的主循环
- 规则包完全控制自己的游戏流程

### ✅ 规则包独立性
- 其他规则包（如 placeholder）不受影响
- 每个规则包可以定义自己的特殊阶段
- 符合开闭原则（对扩展开放，对修改封闭）

### ✅ 向后兼容
- `Phase` 类型扩展为 `string`，兼容现有代码
- 现有的 `'PLAYING'` 判断仍然有效

---

## UI 集成建议

### 1. 检测换三张阶段

```typescript
// 在 UI 组件中
if (state.phase === 'EXCHANGE') {
  // 显示换三张界面
  return <ExchangePhase state={state} />;
}
```

### 2. 换三张 UI 组件

```typescript
function ExchangePhase({ state }: { state: ChengduState }) {
  const [selected, setSelected] = useState<Tile[]>([]);
  
  const handleSelectTile = (tile: Tile) => {
    if (selected.length < 3) {
      setSelected([...selected, tile]);
    }
  };
  
  const handleConfirm = () => {
    if (selected.length === 3 && validateExchangeTiles(selected)) {
      // 发送 EXCHANGE 动作
      orchestrator.dispatchHumanAction({
        type: 'EXCHANGE',
        tiles: selected as [Tile, Tile, Tile],
      });
      
      // 发送 CONFIRM 动作
      orchestrator.dispatchHumanAction({
        type: 'CONFIRM_EXCHANGE',
      });
    }
  };
  
  return (
    <div>
      <h2>请选择3张同花色的牌</h2>
      <HandDisplay 
        tiles={state.hands.P0} 
        onSelect={handleSelectTile}
        selected={selected}
      />
      <button 
        disabled={selected.length !== 3}
        onClick={handleConfirm}
      >
        确认换牌
      </button>
    </div>
  );
}
```

---

## 完整实现清单

### 需要修改的文件

1. ✅ `src/core/model/state.ts` - Phase 类型扩展（已完成）
2. ⚠️ `src/core/model/action.ts` - 添加 EXCHANGE 动作类型
3. ⚠️ `src/core/rules/packs/chengdu/index.ts` - 实现换三张逻辑
   - `buildInitialState()` - 初始化为 EXCHANGE 阶段
   - `getLegalActions()` - 处理 EXCHANGE 阶段
   - `applyAction()` - 处理换三张动作
4. ⚠️ UI 组件 - 添加换三张界面

### 需要导入的函数

```typescript
import { validateExchangeTiles, performExchange } from './exchange';
import { removeTilesFromHand } from './exchange';
```

---

## 测试建议

### 单元测试

```typescript
describe('exchange phase integration', () => {
  it('should start in EXCHANGE phase', () => {
    const state = chengduRulePack.buildInitialState();
    expect(state.phase).toBe('EXCHANGE');
  });
  
  it('should allow selecting 3 same-suit tiles', () => {
    const state = chengduRulePack.buildInitialState();
    const tiles: [Tile, Tile, Tile] = [
      { suit: 'W', rank: 1 },
      { suit: 'W', rank: 5 },
      { suit: 'W', rank: 9 },
    ];
    
    const s1 = chengduRulePack.applyAction(state, {
      type: 'EXCHANGE',
      tiles,
    });
    
    expect((s1 as ChengduState).exchangeSelections?.P0).toEqual(tiles);
  });
  
  it('should transition to PLAYING after all players confirm', () => {
    // 模拟4个玩家都确认换牌
    let state = chengduRulePack.buildInitialState();
    
    // 每个玩家选择并确认
    for (const player of ['P0', 'P1', 'P2', 'P3']) {
      state = { ...state, currentPlayer: player as PlayerId };
      state = chengduRulePack.applyAction(state, {
        type: 'EXCHANGE',
        tiles: [
          { suit: 'W', rank: 1 },
          { suit: 'W', rank: 2 },
          { suit: 'W', rank: 3 },
        ],
      });
      state = chengduRulePack.applyAction(state, {
        type: 'CONFIRM_EXCHANGE',
      });
    }
    
    expect(state.phase).toBe('PLAYING');
  });
});
```

---

## 总结

### ✅ 可以自动集成

**是的！** 通过这个方案，换三张可以在切换到 Chengdu 规则包时**自动植入到主流程**：

1. `buildInitialState()` 返回 `phase: 'EXCHANGE'`
2. `GameOrchestrator` 的主循环会自动处理这个阶段
3. 所有玩家完成换三张后，自动进入 `PLAYING` 阶段
4. 不需要修改 `GameOrchestrator` 的代码

### 关键优势

- 🎯 **规则包自治**：每个规则包控制自己的流程
- 🔌 **即插即用**：切换规则包自动启用特定功能
- 🛡️ **向后兼容**：不影响其他规则包
- 🧪 **易于测试**：逻辑封装在规则包内

### 下一步

如果你需要，我可以立即实现这个完整方案！
