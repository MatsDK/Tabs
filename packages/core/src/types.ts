// ─────────────────────────────────────────────────────────────────────────────
// Core Types — @react-tabstack/core
// Zero React dependency. All types are plain serializable objects.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Entities ────────────────────────────────────────────────────────────────

/** The atomic unit — a single tab. TMeta is opaque to the library. */
export interface Tab<TMeta = unknown> {
  id: string;
  label: string;
  /** Optional icon — handled by the consumer (ReactNode on the React layer) */
  icon?: string;
  closable?: boolean;
  pinned?: boolean;
  /** Arbitrary user data — the library never reads or mutates this */
  meta?: TMeta;
}

/** A named container of tabs, rendered as a "pill" in the strip. */
export interface TabGroup<TMeta = unknown> {
  id: string;
  label: string;
  /** Accent color for the group indicator (CSS color string) */
  color?: string;
  /** When true the dropdown is visually collapsed but tabs are still accessible */
  collapsed?: boolean;
  /** Arbitrary user data */
  meta?: TMeta;
}

// ─── Strip Layout ─────────────────────────────────────────────────────────────

/**
 * A slot is either a bare tab or a group, positioned in the ordered strip.
 * This ordered array is the single source of truth for what appears in the tab bar.
 */
export type TabSlot =
  | { type: 'tab'; tabId: string }
  | { type: 'group'; groupId: string; tabIds: string[] };

// ─── Top-level State ──────────────────────────────────────────────────────────

/**
 * The complete, serializable state of a tab bar.
 * Fully JSON-serializable — session restore is JSON.stringify(state).
 */
export interface TabBarState<TTabMeta = unknown, TGroupMeta = unknown> {
  /** Flat map of all tabs. Lookup by ID is O(1). */
  tabs: Record<string, Tab<TTabMeta>>;
  /** Flat map of all groups. */
  groups: Record<string, TabGroup<TGroupMeta>>;
  /**
   * Ordered sequence defining the visual layout of the strip.
   * Groups contain their ordered child tabIds inline.
   * Pinned tabs appear first (enforced by the reducer).
   */
  slots: TabSlot[];
  /** Currently active/selected tab ID. null = none selected. */
  activeTabId: string | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type TabBarAction =
  // ── Tab actions ──
  | { type: 'ADD_TAB'; tab: Tab; position?: number }
  | { type: 'REMOVE_TAB'; tabId: string }
  | { type: 'MOVE_TAB'; tabId: string; toIndex: number }
  | { type: 'SET_ACTIVE_TAB'; tabId: string | null }
  | { type: 'PIN_TAB'; tabId: string }
  | { type: 'UNPIN_TAB'; tabId: string }
  | { type: 'UPDATE_TAB'; tabId: string; patch: Partial<Omit<Tab, 'id'>> }

  // ── Group actions ──
  | { type: 'ADD_GROUP'; group: TabGroup; position?: number }
  | { type: 'REMOVE_GROUP'; groupId: string; dissolve?: boolean }
  | { type: 'MOVE_GROUP'; groupId: string; toIndex: number }
  | { type: 'UPDATE_GROUP'; groupId: string; patch: Partial<Omit<TabGroup, 'id'>> }
  | { type: 'COLLAPSE_GROUP'; groupId: string }
  | { type: 'EXPAND_GROUP'; groupId: string }
  | { type: 'DISSOLVE_GROUP'; groupId: string } // ungroup all — eject tabs to strip

  // ── Group ↔ Tab actions ──
  | { type: 'ADD_TAB_TO_GROUP'; tabId: string; groupId: string; index?: number }
  | { type: 'REMOVE_TAB_FROM_GROUP'; tabId: string; stripIndex?: number } // eject to strip
  | { type: 'MOVE_TAB_IN_GROUP'; tabId: string; groupId: string; toIndex: number }
  | { type: 'MOVE_TAB_BETWEEN_GROUPS'; tabId: string; fromGroupId: string; toGroupId: string; toIndex?: number }
  | { type: 'CREATE_GROUP_FROM_TAB'; tabId: string; group: TabGroup }

  // ── DnD resolved action (fired after dnd-kit drag ends) ──
  | { type: 'DND_RESOLVE'; dragEvent: DndResolveEvent };

// ─── DnD Event (internal, produced by TabBarProvider after a drag ends) ──────

export type DndResolveEvent =
  | { kind: 'SORT_STRIP'; activeId: string; overId: string }
  | { kind: 'DROP_INTO_GROUP'; tabId: string; groupId: string; index: number }
  | { kind: 'EJECT_FROM_GROUP'; tabId: string; groupId: string; stripIndex: number }
  | { kind: 'MOVE_BETWEEN_GROUPS'; tabId: string; fromGroupId: string; toGroupId: string; index: number }
  | { kind: 'SORT_GROUP_TABS'; tabId: string; groupId: string; toIndex: number }
  | { kind: 'SORT_GROUP_IN_STRIP'; groupId: string; toIndex: number };

// ─── Context Menu Types ───────────────────────────────────────────────────────

export type ContextMenuTarget =
  | { type: 'tab'; tabId: string }
  | { type: 'group'; groupId: string }
  | { type: 'group-tab'; tabId: string; groupId: string }
  | { type: 'strip' };

export type MenuItem =
  | {
      type?: 'item';
      label: string;
      disabled?: boolean;
      /** Receives the full action helpers — same object useTabState exposes */
      action?: (actions: TabBarActions) => void;
      submenu?: MenuItem[];
    }
  | { type: 'separator' }
  | { type: 'label'; label: string };

// ─── Actions Object (passed to contextMenu callbacks and action handlers) ─────

export interface TabBarActions {
  addTab: (tab: Tab, position?: number) => void;
  removeTab: (tabId: string) => void;
  moveTab: (tabId: string, toIndex: number) => void;
  setActiveTab: (tabId: string | null) => void;
  pinTab: (tabId: string) => void;
  unpinTab: (tabId: string) => void;
  updateTab: (tabId: string, patch: Partial<Omit<Tab, 'id'>>) => void;

  addGroup: (group: TabGroup, position?: number) => void;
  removeGroup: (groupId: string, opts?: { dissolve?: boolean }) => void;
  moveGroup: (groupId: string, toIndex: number) => void;
  updateGroup: (groupId: string, patch: Partial<Omit<TabGroup, 'id'>>) => void;
  collapseGroup: (groupId: string) => void;
  expandGroup: (groupId: string) => void;
  dissolveGroup: (groupId: string) => void;

  addTabToGroup: (tabId: string, groupId: string, index?: number) => void;
  removeTabFromGroup: (tabId: string, stripIndex?: number) => void;
  moveTabInGroup: (tabId: string, groupId: string, toIndex: number) => void;
  moveTabToGroup: (tabId: string, toGroupId: string, toIndex?: number) => void;
  createGroupFromTab: (tabId: string, group: TabGroup) => void;

  dispatch: (action: TabBarAction) => void;
}

// ─── Group Drop Zone State (tracks which groups have open dropdowns during drag) ─

export interface GroupDropState {
  /** groupId of the group whose dropdown is currently open during a drag */
  openGroupId: string | null;
  /** groupId currently being hovered (timer running) */
  hoveringGroupId: string | null;
}

// ─── Provider Props ───────────────────────────────────────────────────────────

export interface TabBarProviderProps<TTabMeta = unknown, TGroupMeta = unknown> {
  state: TabBarState<TTabMeta, TGroupMeta>;
  onStateChange: (state: TabBarState<TTabMeta, TGroupMeta>) => void;

  /** ms to hover over a group pill before dropdown opens during a drag (default: 600) */
  groupHoverDelay?: number;

  /**
   * How the group dropdown opens when NOT dragging.
   * 'hover' = opens on mouse enter, closes on mouse leave
   * 'click' = click to toggle open/closed
   * 'hover+click' = hover opens (temporary), click pins open (default)
   */
  groupOpenOn?: 'hover' | 'click' | 'hover+click';

  /**
   * Called when the last tab is removed from a group.
   * The group is NOT auto-dissolved — it persists showing an empty drop zone.
   * Return true to dissolve the group programmatically from this callback.
   */
  onGroupEmpty?: (groupId: string, actions: TabBarActions) => void;

  /**
   * Called when a draggable is released outside the TabBar bounds.
   * Use this to implement "tear off to new window" behavior.
   */
  onDragEscape?: (tabId: string, actions: TabBarActions) => void;

  /**
   * Build the context menu for a right-click target.
   * Return null to suppress the menu.
   */
  contextMenu?: (target: ContextMenuTarget, actions: TabBarActions) => MenuItem[] | null;

  children?: unknown; // typed as ReactNode in the react package layer
}
