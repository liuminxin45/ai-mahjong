export type Tile = {
  suit: 'W' | 'B' | 'T';
  rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
};

export function tileToString(tile: Tile): string {
  return `${tile.suit}${tile.rank}`;
}

export function makeStandardTileSet(): Tile[] {
  const suits: Tile['suit'][] = ['W', 'B', 'T'];
  const ranks: Tile['rank'][] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const tiles: Tile[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      for (let i = 0; i < 4; i++) {
        tiles.push({ suit, rank });
      }
    }
  }
  return tiles;
}
