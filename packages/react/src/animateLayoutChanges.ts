import { defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import type { AnimateLayoutChanges } from '@dnd-kit/sortable';

/**
 * dnd-kit's default layout-change animation FLIPs an item's position within
 * one SortableContext. Trying to FLIP-animate a move *between* two — a
 * strip and a dropdown, laid out on different axes in different parts of the
 * DOM — produces a jump instead of a slide, since there's no coherent path to
 * interpolate. Skip the animation on those transitions; keep it for ordinary
 * same-container reorders. Requires every SortableContext to carry a stable,
 * unique `id` — without one, dnd-kit can't tell containers apart at all.
 */
export const crossContainerAnimateLayoutChanges: AnimateLayoutChanges = (args) => {
  if (args.containerId !== args.previousContainerId) return false;
  return defaultAnimateLayoutChanges(args);
};
