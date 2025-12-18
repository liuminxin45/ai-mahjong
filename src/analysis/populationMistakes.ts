import type { MistakePattern } from './mistakePatterns';

export type PopulationMistake = {
  id: string;
  description: string;
  prevalence: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
};

export function analyzePopulationMistakes(
  allMistakes: MistakePattern[][],
): PopulationMistake[] {
  if (allMistakes.length === 0) return [];

  const mistakeOccurrences: Map<string, { count: number; description: string }> = new Map();

  for (const playerMistakes of allMistakes) {
    const seenIds = new Set<string>();
    for (const mistake of playerMistakes) {
      if (!seenIds.has(mistake.id)) {
        seenIds.add(mistake.id);
        const existing = mistakeOccurrences.get(mistake.id);
        if (existing) {
          existing.count++;
        } else {
          mistakeOccurrences.set(mistake.id, {
            count: 1,
            description: mistake.description,
          });
        }
      }
    }
  }

  const totalPlayers = allMistakes.length;
  const populationMistakes: PopulationMistake[] = [];

  for (const [id, data] of mistakeOccurrences.entries()) {
    const prevalence = data.count / totalPlayers;
    const severity = determineSeverity(prevalence);

    populationMistakes.push({
      id,
      description: data.description,
      prevalence,
      severity,
    });
  }

  populationMistakes.sort((a, b) => b.prevalence - a.prevalence);

  return populationMistakes;
}

function determineSeverity(prevalence: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (prevalence > 0.5) return 'HIGH';
  if (prevalence > 0.2) return 'MEDIUM';
  return 'LOW';
}
