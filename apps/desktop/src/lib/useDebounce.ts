import { useCallback, useEffect, useRef } from 'react';

/**
 * Debounce a side-effecting callback. The returned wrapper has stable
 * identity across renders for a given `delayMs` (useCallback) and
 * always calls the latest `fn` value (refs). Each invocation resets
 * the timer; the last call wins. The pending timer is cleared on
 * unmount.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return useCallback(
    (...args: Args) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delayMs);
    },
    [delayMs],
  );
}
