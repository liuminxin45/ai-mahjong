import type { Difficulty } from '../store/settingsStore';

export function degradeDifficulty(d: Difficulty): Difficulty {
  if (d === 'high') return 'mid';
  if (d === 'mid') return 'low';
  return 'low';
}
