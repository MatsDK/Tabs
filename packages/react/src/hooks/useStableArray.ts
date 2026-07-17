import { useRef } from 'react';

/**
 * Returns the same array reference across renders as long as its contents
 * (by value, shallow) are unchanged. dnd-kit's SortableContext/useSortable
 * compare `items` by reference to decide whether a layout genuinely changed
 * (see defaultAnimateLayoutChanges) — feeding it a brand-new array every
 * render, even one with identical contents, reads as constant churn and
 * disrupts that comparison.
 */
export function useStableArray<T>(value: T[]): T[] {
  const ref = useRef(value);
  const changed = ref.current.length !== value.length || ref.current.some((item, i) => item !== value[i]);
  if (changed) ref.current = value;
  return ref.current;
}
