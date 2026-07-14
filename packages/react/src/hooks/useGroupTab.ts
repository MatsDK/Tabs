import { useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTabBarContext } from '../context.js';

// ─────────────────────────────────────────────────────────────────────────────
// useGroupTab — tab inside an open group dropdown
//
// Sortable within the group's vertical SortableContext.
// Adds eject() action to move back into the strip.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseGroupTabReturn {
  setNodeRef: (node: HTMLElement | null) => void;
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  style: React.CSSProperties;

  isActive: boolean;
  isDragging: boolean;

  activate: () => void;
  close: () => void;
  /** Move this tab out of the group back into the strip */
  eject: () => void;
}

export function useGroupTab(tabId: string, groupId: string): UseGroupTabReturn {
  const { state, actions } = useTabBarContext();

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `group-tab:${tabId}`,
    data: { type: 'group-tab', tabId, groupId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const activate = useCallback(() => actions.setActiveTab(tabId), [actions, tabId]);
  const close = useCallback(() => actions.removeTab(tabId), [actions, tabId]);
  const eject = useCallback(
    () => actions.removeTabFromGroup(tabId),
    [actions, tabId]
  );

  return {
    setNodeRef,
    attributes: {
      ...attributes,
      role: 'tab',
      'aria-selected': state.activeTabId === tabId,
      'data-tab-id': tabId,
      'data-group-id': groupId,
      'data-active': state.activeTabId === tabId ? '' : undefined,
      'data-dragging': isDragging ? '' : undefined,
    },
    listeners,
    style,
    isActive: state.activeTabId === tabId,
    isDragging,
    activate,
    close,
    eject,
  };
}
