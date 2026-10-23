export const NARRATIVE_VERSION = 'sibling-record-1' as const;
export type NarrativeVersion = typeof NARRATIVE_VERSION;
export type ReadingCursor = { scene: string; revealed: number };
export type ReadLine = { id: string; text: string };
