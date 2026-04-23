import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDebouncedCallback } from './useDebounce';

describe('useDebouncedCallback', () => {
  it('only fires the last invocation after the delay', () => {
    vi.useFakeTimers();
    try {
      const cb = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(cb, 100));
      act(() => {
        result.current('a');
        result.current('b');
        result.current('c');
      });
      expect(cb).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(99);
      });
      expect(cb).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith('c');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns a stable function identity across renders for the same delay', () => {
    const cb = vi.fn();
    const { result, rerender } = renderHook(({ fn }) => useDebouncedCallback(fn, 50), {
      initialProps: { fn: cb },
    });
    const first = result.current;
    rerender({ fn: vi.fn() });
    expect(result.current).toBe(first);
  });

  it('returns a NEW identity when delayMs changes (the only useCallback dep)', () => {
    const { result, rerender } = renderHook(({ d }) => useDebouncedCallback(vi.fn(), d), {
      initialProps: { d: 100 },
    });
    const first = result.current;
    rerender({ d: 200 });
    expect(result.current).not.toBe(first);
  });

  it('always invokes the latest fn even when the closed-over identity changed', () => {
    vi.useFakeTimers();
    try {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const { result, rerender } = renderHook(({ fn }) => useDebouncedCallback(fn, 50), {
        initialProps: { fn: fn1 },
      });
      act(() => result.current('x'));
      rerender({ fn: fn2 });
      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(fn1).not.toHaveBeenCalled();
      expect(fn2).toHaveBeenCalledWith('x');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the pending timer on unmount', () => {
    vi.useFakeTimers();
    try {
      const cb = vi.fn();
      const { result, unmount } = renderHook(() => useDebouncedCallback(cb, 100));
      act(() => result.current('queued'));
      unmount();
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(cb).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
