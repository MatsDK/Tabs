import { createContext, useContext } from 'react';
import type { TabBarState, TabBarActions, ContextMenuTarget, MenuItem } from '@react-tabstack/core';
import type { Orientation } from './axis.js';
import type { GroupDropdownCoordinator } from './hooks/useGroupDropdownCoordinator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Internal React Context
// ─────────────────────────────────────────────────────────────────────────────

export interface TabBarContextValue {
  state: TabBarState;
  actions: TabBarActions;
  orientation: Orientation;
  /** True for the duration of an active drag (between dragStart and dragEnd/cancel) */
  isDragActive: boolean;
  /** Single source of truth for which group's dropdown is open, plus open/close scheduling */
  dropdown: GroupDropdownCoordinator;
  /** ms dwell before a group dropdown opens/closes, for both drag-hover and mouse-hover */
  dwell: { open: number; close: number };
  /** How group dropdowns open when not dragging (per-group `TabGroup.openOn` overrides this) */
  groupOpenOn: 'hover' | 'click' | 'hover+click';
  /** Provider-level default for `TabGroup.dissolveOnEmpty`, applied at group-creation time */
  dissolveEmptyGroups: boolean;
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
