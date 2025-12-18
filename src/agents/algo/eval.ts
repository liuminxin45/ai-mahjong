import type { Tile } from '../../core/model/tile';
import { countRanks } from './feature';

export function scoreHand(hand: Tile[]): number {
  const counts = countRanks(hand);
  let score = 0;
  for (const c of counts.values()) {
    if (c >= 2) score += 10;
    if (c >= 3) score += 5;
  }
  return score;
}
