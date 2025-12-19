import type { Tile } from '../../../model/tile';
import type { GameState, Meld } from '../../../model/state';
import type { PlayerId } from '../../../model/types';

export function tileEq(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function tileKey(tile: Tile): string {
  return `${tile.suit}-${tile.rank}`;
}

export function removeNTiles(hand: Tile[], tile: Tile, n: number): Tile[] | null {
  let remaining = n;
  const out: Tile[] = [];
  for (const t of hand) {
    if (remaining > 0 && tileEq(t, tile)) {
      remaining--;
    } else {
      out.push(t);
    }
  }
  return remaining === 0 ? out : null;
}

export function removeTile(hand: Tile[], tile: Tile): Tile[] | null {
  return removeNTiles(hand, tile, 1);
}

export function countTile(hand: Tile[], tile: Tile): number {
  return hand.filter(t => tileEq(t, tile)).length;
}

export function hasTile(hand: Tile[], tile: Tile): boolean {
  return hand.some(t => tileEq(t, tile));
}

export function isMenQing(melds: Meld[]): boolean {
  return melds.length === 0;
}

export function hasGangInMelds(melds: Meld[], tile: Tile): boolean {
  return melds.some(m => m.type === 'GANG' && tileEq(m.tile, tile));
}

export function hasPengInMelds(melds: Meld[], tile: Tile): boolean {
  return melds.some(m => m.type === 'PENG' && tileEq(m.tile, tile));
}

export function canUpgradeToGang(state: GameState, player: PlayerId, tile: Tile): boolean {
  const hasPeng = hasPengInMelds(state.melds[player], tile);
  const hasInHand = hasTile(state.hands[player], tile);
  return hasPeng && hasInHand;
}

export function isWallEmpty(state: GameState): boolean {
  return state.wall.length === 0;
}

export function isLastTileInWall(state: GameState): boolean {
  return state.wall.length === 1;
}

export function getAllActivePlayers(state: GameState): PlayerId[] {
  const players: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];
  return players.filter(p => !state.declaredHu[p]);
}

export function isGameOver(state: GameState): boolean {
  const activePlayers = getAllActivePlayers(state);
  return activePlayers.length === 0 || isWallEmpty(state);
}

export function countMeldTiles(melds: Meld[]): number {
  return melds.reduce((sum, m) => {
    if (m.type === 'PENG') return sum + 3;
    if (m.type === 'GANG') return sum + 4;
    return sum;
  }, 0);
}

export function getExpectedHandSize(melds: Meld[]): number {
  return 13 - countMeldTiles(melds) + melds.length * 3;
}
