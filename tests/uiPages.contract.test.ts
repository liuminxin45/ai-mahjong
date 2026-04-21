import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('ui page render contracts', () => {
  it('home page includes core shell classes', () => {
    const source = read('src/ui/pages/home.ts');
    expect(source).toContain('pixel-app-page');
    expect(source).toContain('pixel-page-shell');
    expect(source).toContain('pixel-home-actions');
  });

  it('match page includes toolbar and content classes', () => {
    const source = read('src/ui/pages/match.ts');
    expect(source).toContain('match-page');
    expect(source).toContain('match-toolbar');
    expect(source).toContain('match-page__content');
  });

  it('settings page includes shell and section classes', () => {
    const source = read('src/ui/pages/settings.ts');
    expect(source).toContain('pixel-app-page');
    expect(source).toContain('pixel-page-body');
    expect(source).toContain('createSection');
  });

  it('replay page includes log section classes', () => {
    const source = read('src/ui/pages/replay.ts');
    expect(source).toContain('pixel-page-section');
    expect(source).toContain('pixel-log');
  });
});
