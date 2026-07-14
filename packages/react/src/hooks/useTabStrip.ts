import { useDroppable } from '@dnd-kit/core';
import { useTabBarContext } from '../context.js';
import type { TabSlot } from '@react-tabstack/core';

// ─────────────────────────────────────────────────────────────────────────────
// useTabStrip — the sortable container for the main strip
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTabStripReturn {
  /** Attach to your strip container DOM node */
  setNodeRef: (node: HTMLElement | null) => void;
  /** Ordered slots to render */
  slots: TabSlot[];
  /** Something is being dragged over the strip */
  isDraggingOver: boolean;
  /** IDs of all sortable items in the strip (for SortableContext) */
  sortableIds: string[];
}

export function useTabStrip(): UseTabStripReturn {
  const { state } = useTabBarContext();

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
    slots: state.slots,
    isDraggingOver: isOver,
    sortableIds,
  };
}
