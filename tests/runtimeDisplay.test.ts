import { describe, expect, it } from 'vitest';
import { buildDisplayCssVars } from '../src/ui/styles/runtimeDisplay';

describe('display css vars', () => {
  it('builds display vars in-range', () => {
    const vars = buildDisplayCssVars(1.2, 6);
    expect(vars['--ui-scale']).toBe('1.20');
    expect(vars['--safe-zone-percent']).toBe('6');
  });

  it('sanitizes out-of-range input', () => {
    const vars = buildDisplayCssVars(9, -10);
    expect(vars['--ui-scale']).toBe('1.35');
    expect(vars['--safe-zone-percent']).toBe('0');
  });
});
