import { useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTabBarContext } from '../context.js';
import { crossContainerAnimateLayoutChanges } from '../animateLayoutChanges.js';

// ─────────────────────────────────────────────────────────────────────────────
// useTab — make any element a draggable, sortable tab in the strip
//
// Mirrors useSortable from dnd-kit: returns setNodeRef, attributes, listeners,
// style — spread these onto your own DOM element.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTabReturn {
  /** Attach to your tab's DOM node */
  setNodeRef: (node: HTMLElement | null) => void;
  /** Spread onto your tab element: aria-*, role="tab", tabIndex, data-* */
  attributes: Record<string, unknown>;
  /** Spread onto your tab element: drag activation event handlers */
  listeners: Record<string, unknown> | undefined;
  /** Apply as style={{ ...style }} on your tab element */
  style: React.CSSProperties;

  // State
  isActive: boolean;
  isDragging: boolean;
  isOver: boolean;

  // Pre-bound actions
  activate: () => void;
  close: () => void;
}

export function useTab(tabId: string): UseTabReturn {
  const { state, actions } = useTabBarContext();
  const tab = state.tabs[tabId];

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: tabId,
    data: { type: 'tab', tabId, pinned: !!tab?.pinned },
    disabled: tab?.draggable === false,
    animateLayoutChanges: crossContainerAnimateLayoutChanges,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const activate = useCallback(() => actions.setActiveTab(tabId), [actions, tabId]);
  const close = useCallback(() => actions.removeTab(tabId), [actions, tabId]);

  return {
    setNodeRef,
    attributes: {
      ...attributes,
      role: 'tab',
      'aria-selected': state.activeTabId === tabId,
      'data-tab-id': tabId,
      'data-ts-tab': tabId,
      'data-active': state.activeTabId === tabId ? '' : undefined,
      'data-dragging': isDragging ? '' : undefined,
      'data-pinned': tab?.pinned ? '' : undefined,
      'data-draggable': tab?.draggable === false ? 'false' : 'true',
    },
    listeners,
    style,
    isActive: state.activeTabId === tabId,
    isDragging,
    isOver,
    activate,
    close,
  };
}
