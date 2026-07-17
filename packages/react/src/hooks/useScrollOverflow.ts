import { useCallback, useEffect, useRef, useState } from 'react';
import type { Orientation } from '../axis.js';

export interface ScrollOverflow {
  /** Attach to the scrollable container */
  setScrollRef: (node: HTMLElement | null) => void;
  /** There's hidden content before the current scroll position */
  canScrollBack: boolean;
  /** There's hidden content after the current scroll position */
  canScrollForward: boolean;
  /** Scroll one "page" (80% of the container's visible size) toward the start */
  scrollBack: () => void;
  /** Scroll one "page" toward the end */
  scrollForward: () => void;
  /** Scroll a specific element into view (e.g. the newly-active tab) */
  scrollIntoView: (node: HTMLElement) => void;
}

/**
 * Tracks whether a scrollable container has hidden content on either side,
 * and exposes scroll-by-page helpers — the data a "scroll left/right" button
 * pair needs. Rendering those buttons is left to the consumer; detecting
 * overflow reliably needs a live DOM measurement this hook owns.
 *
 * Listener setup/teardown lives inside the ref callback itself (not a
 * useEffect keyed on the node) — refs aren't valid dependency-array entries,
 * mutating .current doesn't trigger re-runs, so an effect can't reliably
 * react to "the node changed" any other way.
 */
export function useScrollOverflow(orientation: Orientation): ScrollOverflow {
  const nodeRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [overflow, setOverflow] = useState({ canScrollBack: false, canScrollForward: false });

  const measure = useCallback(() => {
    const el = nodeRef.current;
    if (!el) return;
    const pos = orientation === 'vertical' ? el.scrollTop : el.scrollLeft;
    const size = orientation === 'vertical' ? el.clientHeight : el.clientWidth;
    const total = orientation === 'vertical' ? el.scrollHeight : el.scrollWidth;
    setOverflow((prev) => {
      const canScrollBack = pos > 1;
      const canScrollForward = pos < total - size - 1;
      return prev.canScrollBack === canScrollBack && prev.canScrollForward === canScrollForward
        ? prev
        : { canScrollBack, canScrollForward };
    });
  }, [orientation]);

  const setScrollRef = useCallback(
    (node: HTMLElement | null) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      nodeRef.current = node;
      if (!node) return;

      measure();
      node.addEventListener('scroll', measure, { passive: true });
      const resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(node);
      // Tabs added/removed change scrollWidth without necessarily resizing
      // the container itself, so ResizeObserver alone would miss it.
      const mutationObserver = new MutationObserver(measure);
      mutationObserver.observe(node, { childList: true, subtree: true });
      cleanupRef.current = () => {
        node.removeEventListener('scroll', measure);
        resizeObserver.disconnect();
        mutationObserver.disconnect();
      };
    },
    [measure]
  );

  useEffect(() => () => cleanupRef.current?.(), []);

  const scrollBy = useCallback(
    (direction: 1 | -1) => {
      const el = nodeRef.current;
      if (!el) return;
      const size = orientation === 'vertical' ? el.clientHeight : el.clientWidth;
      const delta = direction * size * 0.8;
      el.scrollBy(orientation === 'vertical' ? { top: delta, behavior: 'smooth' } : { left: delta, behavior: 'smooth' });
    },
    [orientation]
  );

  const scrollIntoView = useCallback((node: HTMLElement) => {
    node.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, []);

  return {
    setScrollRef,
    canScrollBack: overflow.canScrollBack,
    canScrollForward: overflow.canScrollForward,
    scrollBack: () => scrollBy(-1),
    scrollForward: () => scrollBy(1),
    scrollIntoView,
  };
}
