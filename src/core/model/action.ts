import type { Tile } from './tile';
import type { PlayerId } from './types';

export type Action =
  | { type: 'DRAW' }
  | { type: 'DISCARD'; tile: Tile }
  | { type: 'PENG'; tile: Tile; from: PlayerId }
  | { type: 'GANG'; tile: Tile; from: PlayerId; gangType: 'MING' | 'BU' }
  | { type: 'HU'; tile?: Tile; from?: PlayerId }
  | { type: 'PASS' };
