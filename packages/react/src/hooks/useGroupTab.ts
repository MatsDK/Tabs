import { useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTabBarContext } from '../context.js';

// ─────────────────────────────────────────────────────────────────────────────
// useGroupTab — tab inside an open group dropdown
//
// Registers under the SAME sortable id as the tab uses in the strip. That one
// id following the tab across containers is what lets dnd-kit treat a
// cross-container drag as one continuous sort: the placeholder dims in
// whichever container currently holds it, and make-space previews work in both.
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
  const tab = state.tabs[tabId];

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tabId,
    data: { type: 'group-tab', tabId, groupId, pinned: !!tab?.pinned },
    disabled: tab?.draggable === false,
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
      'data-ts-group-tab': tabId,
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
