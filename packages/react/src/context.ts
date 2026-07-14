import { createContext, useContext } from 'react';
import type { TabBarState, TabBarActions, GroupDropState, ContextMenuTarget, MenuItem } from '@react-tabstack/core';

// ─────────────────────────────────────────────────────────────────────────────
// Internal React Context
// ─────────────────────────────────────────────────────────────────────────────

export interface TabBarContextValue {
  state: TabBarState;
  actions: TabBarActions;
  /** Which group dropdown is open during a drag (null = none) */
  dragDropState: GroupDropState;
  setDragDropState: (s: GroupDropState) => void;
  /** ms to hover over a group pill to open its dropdown during drag */
  groupHoverDelay: number;
  /** How group dropdowns open when not dragging */
  groupOpenOn: 'hover' | 'click' | 'hover+click';
  /** User-supplied context menu builder */
  contextMenu?: (target: ContextMenuTarget, actions: TabBarActions) => MenuItem[] | null;
}

const TabBarContext = createContext<TabBarContextValue | null>(null);

export function useTabBarContext(): TabBarContextValue {
  const ctx = useContext(TabBarContext);
  if (!ctx) {
    throw new Error(
      '[react-tabstack] useTabBarContext must be used within a <TabBarProvider>.'
    );
  }
  return ctx;
}

export { TabBarContext };
