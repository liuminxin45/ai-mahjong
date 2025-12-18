export type PlayerId = 'P0' | 'P1' | 'P2' | 'P3';

export const PLAYER_ORDER: PlayerId[] = ['P0', 'P1', 'P2', 'P3'];

export function nextPlayerId(playerId: PlayerId): PlayerId {
  const idx = PLAYER_ORDER.indexOf(playerId);
  return PLAYER_ORDER[(idx + 1) % PLAYER_ORDER.length];
}
