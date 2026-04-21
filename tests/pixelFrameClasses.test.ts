import { describe, expect, it } from 'vitest';
import { buildPixelButtonClass, buildPixelSurfaceClass } from '../src/ui/components/pixelFrame';

describe('pixel frame class contracts', () => {
  it('builds semantic button class names', () => {
    const className = buildPixelButtonClass('accent', {
      size: 'lg',
      tone: 'outline',
      fullWidth: true,
    });
    expect(className).toContain('pixel-btn');
    expect(className).toContain('pixel-btn--accent');
    expect(className).toContain('pixel-btn--size-lg');
    expect(className).toContain('pixel-btn--tone-outline');
    expect(className).toContain('pixel-btn--block');
  });

  it('builds modal and drawer safe-surface classes', () => {
    expect(buildPixelSurfaceClass('modal')).toContain('pixel-surface--safe');
    expect(buildPixelSurfaceClass('drawer', 'custom')).toBe('pixel-surface pixel-surface--drawer pixel-surface--safe custom');
  });
});
