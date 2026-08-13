# 刮风下雨（Guafeng Xiаyu）规则实现

## 概述
实现了川麻中的"刮风下雨"特殊胡牌方式。

## 规则说明
"刮风下雨"是指：
1. 玩家已经有一个碰（PENG）的三张相同的牌
2. 玩家手里还有一张与PENG相同的牌
3. 玩家可以选择用这张手牌与PENG的三张牌组成一个刻子来胡牌
4. 这样的胡牌被称为"刮风下雨"

## 实现细节

### 1. 新增Yaku类型（patterns.ts）
```typescript
| 'GUAFENG_XIАYU';    // 刮风下雨（用与碰相同的牌胡）
```
- 番值：2番

### 2. 检测函数（patterns.ts）
```typescript
export function canPerformGuaFengXiaYu(
  hand: Tile[],
  melds: Array<{ type: string; tile: Tile }> = [],
  discardTile?: Tile,
): boolean
```
- 用来判断是否可以进行"刮风下雨"胡牌
- 逻辑：移除与PENG相同的手牌后，剩余手牌是否能自己胡

### 3. 发牌阶段检测（index.ts - getLegalActions）
- 当玩家摸到新牌时（hand.length === baseHandSize + 1）
- 检查是否有PENG和与其相同的手牌
- 如果满足条件，生成HU action

### 4. Yaku检测（patterns.ts - detectYaku）
- 添加isGuaFengXiaYu参数
- 当此参数为true时，添加GUAFENG_XIАYU番型

### 5. 得分计算（index.ts - evaluateSelfDrawScore）
- 支持"刮风下雨"胡牌的得分计算
- 移除与PENG相同的手牌，然后检查剩余手牌的胡牌模式

### 6. 动作应用（index.ts - applyAction）
- 检测HU action的tile是否与某个PENG相同
- 如果是，标记为"刮风下雨"胡牌并传递给评分函数

## 使用场景
当玩家在摸牌阶段（hand.length = baseHandSize + 1）时：
- 如果手里有与某个PENG相同的牌
- 且移除该牌后剩余的手牌能胡
- 且满足缺一门要求
- 系统会提供"刮风下雨"胡牌选项

## 测试
- 所有现有测试仍然通过（119/119）
- 新增专项测试验证"刮风下雨"功能
- 包括检测函数测试和Yaku检测测试
