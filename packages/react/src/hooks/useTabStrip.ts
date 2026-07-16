import { useDroppable } from '@dnd-kit/core';
import { useTabBarContext } from '../context.js';
import { getAxisMetrics } from '../axis.js';
import type { Orientation } from '../axis.js';
import type { TabSlot } from '@react-tabstack/core';
import type { SortableContextProps } from '@dnd-kit/sortable';

// ─────────────────────────────────────────────────────────────────────────────
// useTabStrip — the sortable container for the main strip
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTabStripReturn {
  /** Attach to your strip container DOM node */
  setNodeRef: (node: HTMLElement | null) => void;
  /** Attach to your strip container: data-ts-strip + orientation-aware ARIA */
  attributes: Record<string, unknown>;
  /** Ordered slots to render */
  slots: TabSlot[];
  /** Something is being dragged over the strip */
  isDraggingOver: boolean;
  /** IDs of all sortable items in the strip (for SortableContext) */
  sortableIds: string[];
  /** The provider's configured orientation */
  orientation: Orientation;
  /** Pass straight through to <SortableContext strategy={...}> — matches orientation */
  sortStrategy: SortableContextProps['strategy'];
}

export function useTabStrip(): UseTabStripReturn {
  const { state, orientation } = useTabBarContext();

  const { setNodeRef, isOver } = useDroppable({
    id: 'strip',
    data: { type: 'strip' },
  });

  // Build the sortable ID list: tabIds and groupIds in strip order
  const sortableIds = state.slots.map((slot) =>
    slot.type === 'tab' ? slot.tabId : slot.groupId
  );

  return {
    setNodeRef,
    attributes: {
      role: 'tablist',
      'aria-orientation': orientation,
      'data-ts-strip': '',
      'data-orientation': orientation,
    },
    slots: state.slots,
    isDraggingOver: isOver,
    sortableIds,
    orientation,
    sortStrategy: getAxisMetrics(orientation).sortStrategy,
  };
}
