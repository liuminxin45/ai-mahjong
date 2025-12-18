export type TeachingVariant = {
  id: string;
  description: string;
  tone: 'DIRECT' | 'ENCOURAGING' | 'CAUTIOUS' | 'CHALLENGING';
  maxFocusPoints: number;
};

export const TEACHING_VARIANTS: TeachingVariant[] = [
  {
    id: 'variant-a-direct',
    description: '简洁直接型：快速指出问题，给出明确建议',
    tone: 'DIRECT',
    maxFocusPoints: 2,
  },
  {
    id: 'variant-b-encouraging',
    description: '鼓励型：肯定优点，温和指出改进方向，配合示例',
    tone: 'ENCOURAGING',
    maxFocusPoints: 3,
  },
  {
    id: 'variant-c-challenging',
    description: '挑战型：提出深度问题，引导思考，适合高手',
    tone: 'CHALLENGING',
    maxFocusPoints: 4,
  },
];
