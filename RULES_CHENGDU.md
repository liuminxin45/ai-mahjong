# Chengdu Rule Pack (Implementation Spec)

This document describes the **current behavior implemented in the codebase** for the Chengdu rules pack (`src/core/rules/packs/chengdu`). It is intended for verification.

## 1. Scope / Tile Set

- **Tile suits**: `W` (Wan/万), `B` (Bamboo/条), `T` (Dot/筒).
- **Ranks**: `1..9`.
- No winds/dragons/flowers are implemented.

## 2. Players / Turn Order

- Players: `P0`, `P1`, `P2`, `P3`.
- Turn order uses `nextPlayerId()` (clockwise).
- The game is **Blood Battle (血战到底)** style: players can win and then stop taking turns; the round ends when **3 players have declared Hu** or the **wall is empty**.

## 3. Phases (State Machine)

The `GameState.phase` is one of:

- `EXCHANGE` (换三张)
- `DING_QUE` (定缺)
- `PLAYING` (对局中)
- `END` (结束)

### 3.1 Initial State

- `chengduRulePack.buildInitialState()` sets:
  - `phase: 'EXCHANGE'`
  - `currentPlayer: 'P0'`
  - Each player is dealt 13 tiles
  - `exchangeSelections`, `exchangeConfirmed`, `dingQueSelection` are initialized
  - `roundScores` and `dealInStats` are initialized

### 3.2 Phase: EXCHANGE (换三张)

- Each player must select **exactly 3 tiles of the same suit**.
- Exchange direction is currently **CLOCKWISE**.

Legal actions during `EXCHANGE`:

- If player already confirmed: `PASS`
- If player has selected 3 tiles: `EXCHANGE_CONFIRM`
- Otherwise:
  - For AI players (including `P0` when `settingsStore.p0IsAI` is true):
    - The system auto-returns a single `EXCHANGE_SELECT` with AI-chosen tiles.
  - For human `P0`:
    - The system returns some `EXCHANGE_SELECT` options (simplified: first 3 tiles of each suit with >=3 count).

Applying actions:

- `EXCHANGE_SELECT` stores the 3 selected tiles for the current player.
- `EXCHANGE_CONFIRM` marks the current player confirmed and advances `currentPlayer`.
- When all 4 players confirm:
  - Exchange is executed clockwise:
    - `P0 -> P1`, `P1 -> P2`, `P2 -> P3`, `P3 -> P0`
  - Hands are updated and sorted.
  - Phase transitions to `DING_QUE`.

### 3.3 Phase: DING_QUE (定缺)

- Each player chooses one missing suit: `W` / `B` / `T`.

Legal actions during `DING_QUE`:

- If already selected: `PASS`
- Otherwise:
  - AI players (including P0 in AI mode) auto-return a `DING_QUE` decision
  - Human P0 gets three options: `DING_QUE { suit: 'W'|'B'|'T' }`

Applying actions:

- Each `DING_QUE` stores the player’s missing suit and advances `currentPlayer`.
- When all 4 players have selected:
  - Phase transitions to `PLAYING`
  - `currentPlayer` resets to `P0`

### 3.4 Phase: PLAYING

- Normal draw/discard loop.
- If a player has already declared Hu, `getLegalActions()` returns only `PASS`.

### 3.5 Round End

`chengduRulePack.isRoundEnd(state)` returns true when:

- `state.wall.length === 0`, or
- `state.phase === 'END'`, or
- `declaredHu` count >= 3

Settlement (`settleRound`) returns:

- `scores`: `roundScores`
- `dealIns`: `dealInStats`

## 4. Discard Rules (定缺出牌限制)

Implemented in `src/core/rules/packs/chengdu/validator.ts`.

After a player has chosen `dingQueSelection[player]`:

- If the hand still contains tiles of the missing suit:
  - The player may only discard tiles of the missing suit.
- Once the missing-suit tiles are cleared:
  - Any discard is allowed.

## 5. Winning Rules

### 5.1 Hand Pattern (胡牌结构)

Implemented in `patterns.ts`:

- A winning hand requires **14 tiles**.
- Supported win shapes:
  - Standard: **4 groups + 1 pair**
    - Groups are `SHUN` (sequence) or `KE` (triplet)
    - Pair is `JIANG`
  - **Qi Dui Zi (七对子)**: 7 pairs

### 5.2 Que Yi Men (缺一门)

Implemented by `hasQueYiMen(hand, melds?, missingSuit?)`:

- If `missingSuit` is provided (player has done DingQue):
  - The hand + meld tiles must contain **zero tiles** of the missing suit.
- If `missingSuit` is not provided:
  - The hand + meld tiles must use **at most 2 suits** among `W/B/T`.

### 5.3 How Hu is offered

In `chengdu/index.ts`:

- **Self draw Hu (自摸)**:
  - On the current player’s turn, if hand size indicates a drawn tile (`baseHandSize + 1`), the engine checks:
    - `findWinPatterns(hand)` is valid
    - `hasQueYiMen(hand, melds, dingQueSelection[player])` is true
  - If yes: a `HU` action is offered: `{ type:'HU', tile: lastTileInHand, from: player }`

- **Ron Hu (点炮胡)**:
  - After someone discards, other players may have legal `HU` if:
    - `findWinPatterns(hand + discardedTile)` is valid
    - `hasQueYiMen(hand + discardedTile, melds, dingQueSelection[player])` is true

- **Robbing a Kong (抢杠胡)**:
  - When a player attempts `JIA` gang, the tile becomes `lastAddedGangTile` and other players get a window to `HU`.

## 6. Melds: PENG / GANG

### 6.1 PENG (碰)

- Offered in response window when `inHand >= 2` on the discarded tile.
- If chosen:
  - Removes 2 tiles from hand
  - Adds meld `{ type:'PENG', tile, from: discarder }`
  - Sets `currentPlayer` to the peng player
  - Additional restriction in applyAction: you cannot immediately discard the just-ponged tile (`lastPengTile`).

### 6.2 GANG (杠)

Action type is:

- `{ type:'GANG', tile, from, gangType: 'AN'|'MING'|'JIA'|'BU' }`

Only these gang types are used in Chengdu pack:

- **AN (暗杠)**: hand has 4 identical tiles on your own turn
- **MING (明杠)**: in response to discard, you have 3 in hand and someone discards the 4th
- **JIA (贴杠 / 加杠)**: you already have a `PENG` meld and draw the 4th tile

#### 6.2.1 Missing Suit Restriction (定缺不能杠)

**All gang types** are forbidden if the gang tile suit equals `dingQueSelection[player]`.

Implemented in:

- `getLegalActions()` filters out gang actions for missing suit tiles
- `applyAction()` and `resolveReactions()` also guard against forced/invalid actions

#### 6.2.2 Draw after GANG

- AN gang: removes 4 tiles, draws 1 tile from wall
- MING gang: removes 3 tiles (the 4th is the discard), draws 1 tile
- JIA gang: upgrades existing `PENG` meld to `GANG` and removes 1 tile from hand
  - This creates a robbing-kong window (`lastAddedGangTile`) before drawing replacement tile.

## 7. Gang Special Win Flags

- `isAfterGang` and `lastGangPlayer` are tracked.
- If a player self-draws a Hu right after their own gang replacement draw, it counts as `GANG_SHANG_KAI_HUA`.

## 8. Yaku (番型) / Fan Values

Implemented in `detectYaku()` in `patterns.ts`.

Possible yaku types and currently assigned fan:

- `PING_HU` 平胡: 1
- `DUI_DUI_HU` 对对胡: 2
- `QING_YI_SE` 清一色: 2
- `QI_DUI_ZI` 七对子: 2
- `LONG_QI_DUI` 龙七对: 3
- `GANG_SHANG_KAI_HUA` 杠上开花: 2
- `QIANG_GANG_HU` 抢杠胡: 2
- `HAI_DI_LAO_YUE` 海底捞月: 2
- `TIAN_HU` 天胡: 4
- `DI_HU` 地胡: 4
- `ZI_MO` 自摸: 1
- `JIN_GOU_DIAO` 金钩钓: 2

Notes:

- Some yaku types exist in the union but are not currently detected/used (e.g. `HUN_YI_SE`, `QUAN_DAI_YAO`, `TIAN_HU` are partially present in types but not fully implemented as full Chengdu rules).

## 8.1 Tian Hu / Di Hu (Implementation)

This codebase defines:

- **Tian Hu (天胡, 4 fan)**: `P0` wins by **self-draw** on the **first turn of the round** (`state.turn === 0`).
  - Settlement uses the normal self-draw settlement: all other active players pay.

- **Di Hu (地胡, 4 fan)**: a non-`P0` player wins by **ron** on the **first discard of the round** (`state.turn === 1`) and the discarder is `P0`.
  - Settlement uses the normal ron settlement: the discarder pays.

## 9. Scoring (计分)

### 9.1 Hu Score Calculation

Implemented in `calculateScore(yakuList, genCount)` in `patterns.ts`.

- **Base (底分)**: 5
- **Total fan**: `sum(yaku.fan) + genCount`
  - `genCount` is currently passed as the **number of GANG melds** for that player, i.e. **each gang adds +1 fan**.

Formula:

- If `totalFan <= 0` -> score = 0
- Else: `score = 5 * 2^(totalFan - 1)`

### 9.2 Self Draw Settlement (自摸结算)

- Winner gains `score`
- Each not-yet-won opponent shares paying the `score` equally (integer division, remainder goes to last payer)

### 9.3 Ron Settlement (点炮结算)

- Winner gains `score`
- Discarder loses `score`
- Deal-in stats are recorded for the discarder:
  - Stage `A` / `B` / `C` depends on whether other winners already exist.

### 9.4 Gang “Rain Money” (刮风下雨)

Immediate score transfer on gang (separate from Hu scoring).

Implemented in `applyGangRainMoney()`.

- **AN (暗杠)**: collect 10 from each other player
  - `+30` to gang player, `-10` to each opponent
- **MING (明杠)**: collect 10 from the discarder
  - `+10` to gang player, `-10` to discarder
- **JIA (贴杠)**: collect 5 from the original PENG provider
  - `+5` to gang player, `-5` to the `from` player stored in the PENG meld

## 10. Reaction Resolution Priority

When there is a response window (after discard / robbing-kong window), the engine validates reactions by checking each reaction is present in `getLegalActions()`.

Priority:

- HU takes precedence over GANG/PENG.
- For robbing-kong window, HU can interrupt the gang.

## 11. UI Language Default

- Default UI language is English:
  - `src/store/languageStore.ts`: `currentLanguage` default is `'en'`
  - User preference can override via `localStorage['language']`.

---

# Appendix: Code References

- Rule pack entry:
  - `src/core/rules/packs/chengdu/index.ts`
- Hand patterns / yaku / scoring / que-yi-men:
  - `src/core/rules/packs/chengdu/patterns.ts`
- Exchange:
  - `src/core/rules/packs/chengdu/exchange.ts`
- DingQue discard validator:
  - `src/core/rules/packs/chengdu/validator.ts`
