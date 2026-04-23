import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('joins truthy class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });
  it('drops falsy values', () => {
    expect(cn('a', false && 'b', null, undefined, 'c')).toBe('a c');
  });
  it('merges conflicting tailwind utilities so the last one wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
  it('preserves non-conflicting utilities', () => {
    expect(cn('flex', 'items-center', 'p-4')).toBe('flex items-center p-4');
  });
  it('accepts arrays + objects (clsx semantics)', () => {
    expect(cn(['flex', 'items-center'], { 'is-active': true, hidden: false })).toBe(
      'flex items-center is-active',
    );
  });
});
