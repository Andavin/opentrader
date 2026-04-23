import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import './Popover.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The trigger element. Must accept ref + click handler.
   *  We attach a ref to it via cloneElement to anchor positioning. */
  trigger: ReactElement<{ ref?: unknown; onClick?: (e: React.MouseEvent) => void }>;
  /** Which corner of the trigger to anchor to. */
  align?: 'start' | 'end';
  /** Pixel offset between trigger bottom and popover top. */
  gap?: number;
  /** Pixel margin to keep between popover and viewport edges. */
  edgeInset?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Floating popover that:
 *  - portal-renders to document.body so an ancestor's `overflow: hidden`
 *    (dockview group views in particular) doesn't clip it
 *  - positions with `position: fixed` from the trigger's
 *    getBoundingClientRect, so no CSS containing-block surprises
 *  - clamps to viewport so right-edge dropdowns can't run off screen
 *  - closes on outside click, Escape, scroll, or resize
 */
export function Popover({
  open,
  onClose,
  trigger,
  align = 'end',
  gap = 4,
  edgeInset = 8,
  className,
  children,
}: Props) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const reposition = useCallback(() => {
    const trig = triggerRef.current;
    const pop = popoverRef.current;
    if (!trig || !pop) return;
    const trigRect = trig.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = align === 'end' ? trigRect.right - popRect.width : trigRect.left;
    let top = trigRect.bottom + gap;

    // Clamp to viewport
    if (left + popRect.width > vw - edgeInset) left = vw - popRect.width - edgeInset;
    if (left < edgeInset) left = edgeInset;

    // If popover would overflow bottom, flip above the trigger
    if (top + popRect.height > vh - edgeInset) {
      const flipped = trigRect.top - popRect.height - gap;
      top = flipped >= edgeInset ? flipped : Math.max(edgeInset, vh - popRect.height - edgeInset);
    }

    setStyle({
      position: 'fixed',
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
    });
  }, [align, gap, edgeInset]);

  // Recompute position on open + on every viewport change while open.
  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const handler = () => reposition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [open, reposition]);

  // Outside click / Escape close.
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  // Attach our ref to the trigger via cloneElement.
  const triggerWithRef = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<RefAttributes<HTMLElement>>, {
        ref: triggerRef as RefObject<HTMLElement>,
      })
    : trigger;

  if (typeof document === 'undefined') return triggerWithRef;

  return (
    <>
      {triggerWithRef}
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className={['popover', className ?? ''].filter(Boolean).join(' ')}
            // Hidden until the layout effect runs once to position it,
            // so the user never sees a flash at top-left of the screen.
            style={style ?? { position: 'fixed', visibility: 'hidden' }}
            role="menu"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
