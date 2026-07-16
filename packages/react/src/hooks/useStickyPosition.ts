import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// useStickyPosition — headless equivalent of Tippy's `sticky` plugin.
//
// dnd-kit reflows sibling tabs via CSS `transform` during a drag, which fires no
// `scroll`/`resize` DOM events. A portalled dropdown anchored only on
// mount/scroll/resize (the previous approach) visually detaches from its
// trigger the moment neighboring tabs shift. This hook instead re-measures the
// trigger's `getBoundingClientRect()` every animation frame while `active`, so
// position tracking is correct regardless of *why* the trigger moved — a resize
// observer would still miss pure-transform reflow, so this covers both cases in
// one mechanism.
// ─────────────────────────────────────────────────────────────────────────────

export interface StickyRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function useStickyPosition(triggerRef: RefObject<HTMLElement | null>, active: boolean): StickyRect | null {
  const [rect, setRect] = useState<StickyRect | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }

    const measure = () => {
      const node = triggerRef.current;
      if (node) {
        const r = node.getBoundingClientRect();
        setRect((prev) =>
          prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height }
        );
      }
      rafRef.current = requestAnimationFrame(measure);
    };
    rafRef.current = requestAnimationFrame(measure);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, triggerRef]);

  return rect;
}
