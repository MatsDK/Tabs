import { useReducer, useCallback, useMemo } from 'react';
import { tabBarReducer } from '@react-tabstack/core';
import type {
  TabBarState,
  TabBarActions,
  TabBarAction,
  Tab,
  TabGroup,
} from '@react-tabstack/core';

// ─────────────────────────────────────────────────────────────────────────────
// useTabState — batteries-included hook, mirrors dnd-kit's ergonomics
//
// Returns state slices (tabs, groups, slots, activeTabId) and imperative
// action helpers — identical to what dnd-kit returns from useDraggable etc.
// You spread or destructure what you need.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTabStateReturn extends TabBarActions {
  // State slices — stable references, safe for useMemo deps
  tabs: TabBarState['tabs'];
  groups: TabBarState['groups'];
  slots: TabBarState['slots'];
  activeTabId: TabBarState['activeTabId'];
  /** Full state snapshot — use for controlled <TabBarProvider state={...} /> */
  state: TabBarState;
}

const EMPTY_STATE: TabBarState = {
  tabs: {},
  groups: {},
  slots: [],
  activeTabId: null,
};

export function useTabState(initialState?: Partial<TabBarState>): UseTabStateReturn {
  const [state, dispatch] = useReducer(tabBarReducer, {
    ...EMPTY_STATE,
    ...initialState,
  });

  // ── Stable action helpers ──────────────────────────────────────────────────
  // Each helper is stable across renders (dispatch is stable from useReducer).
  // Using individual useCallback is intentional — avoids re-creating the whole
  // actions object when only one dep changes.

  const addTab = useCallback(
    (tab: Tab, position?: number) =>
      dispatch({ type: 'ADD_TAB', tab, position }),
    [dispatch]
  );

  const removeTab = useCallback(
    (tabId: string) => dispatch({ type: 'REMOVE_TAB', tabId }),
    [dispatch]
  );

  const moveTab = useCallback(
    (tabId: string, toIndex: number) =>
      dispatch({ type: 'MOVE_TAB', tabId, toIndex }),
    [dispatch]
  );

  const setActiveTab = useCallback(
    (tabId: string | null) => dispatch({ type: 'SET_ACTIVE_TAB', tabId }),
    [dispatch]
  );

  const pinTab = useCallback(
    (tabId: string) => dispatch({ type: 'PIN_TAB', tabId }),
    [dispatch]
  );

  const unpinTab = useCallback(
    (tabId: string) => dispatch({ type: 'UNPIN_TAB', tabId }),
    [dispatch]
  );

  const updateTab = useCallback(
    (tabId: string, patch: Partial<Omit<Tab, 'id'>>) =>
      dispatch({ type: 'UPDATE_TAB', tabId, patch }),
    [dispatch]
  );

  const addGroup = useCallback(
    (group: TabGroup, position?: number) =>
      dispatch({ type: 'ADD_GROUP', group, position }),
    [dispatch]
  );

  const removeGroup = useCallback(
    (groupId: string, opts?: { dissolve?: boolean }) =>
      dispatch({ type: 'REMOVE_GROUP', groupId, dissolve: opts?.dissolve }),
    [dispatch]
  );

  const moveGroup = useCallback(
    (groupId: string, toIndex: number) =>
      dispatch({ type: 'MOVE_GROUP', groupId, toIndex }),
    [dispatch]
  );

  const updateGroup = useCallback(
    (groupId: string, patch: Partial<Omit<TabGroup, 'id'>>) =>
      dispatch({ type: 'UPDATE_GROUP', groupId, patch }),
    [dispatch]
  );

  const collapseGroup = useCallback(
    (groupId: string) => dispatch({ type: 'COLLAPSE_GROUP', groupId }),
    [dispatch]
  );

  const expandGroup = useCallback(
    (groupId: string) => dispatch({ type: 'EXPAND_GROUP', groupId }),
    [dispatch]
  );

  const dissolveGroup = useCallback(
    (groupId: string) => dispatch({ type: 'DISSOLVE_GROUP', groupId }),
    [dispatch]
  );

  const addTabToGroup = useCallback(
    (tabId: string, groupId: string, index?: number) =>
      dispatch({ type: 'ADD_TAB_TO_GROUP', tabId, groupId, index }),
    [dispatch]
  );

  const removeTabFromGroup = useCallback(
    (tabId: string, stripIndex?: number) =>
      dispatch({ type: 'REMOVE_TAB_FROM_GROUP', tabId, stripIndex }),
    [dispatch]
  );

  const moveTabInGroup = useCallback(
    (tabId: string, groupId: string, toIndex: number) =>
      dispatch({ type: 'MOVE_TAB_IN_GROUP', tabId, groupId, toIndex }),
    [dispatch]
  );

  const moveTabToGroup = useCallback(
    (tabId: string, toGroupId: string, toIndex?: number) => {
      // Find which group the tab is currently in (if any)
      const fromSlot = state.slots.find(
        (s) => s.type === 'group' && s.tabIds.includes(tabId)
      );
      if (fromSlot && fromSlot.type === 'group') {
        dispatch({
          type: 'MOVE_TAB_BETWEEN_GROUPS',
          tabId,
          fromGroupId: fromSlot.groupId,
          toGroupId,
          toIndex,
        });
      } else {
        dispatch({ type: 'ADD_TAB_TO_GROUP', tabId, groupId: toGroupId, index: toIndex });
      }
    },
    [dispatch, state.slots]
  );

  const createGroupFromTab = useCallback(
    (tabId: string, group: TabGroup) =>
      dispatch({ type: 'CREATE_GROUP_FROM_TAB', tabId, group }),
    [dispatch]
  );

  // ── Assemble stable actions object ────────────────────────────────────────
  const actions: TabBarActions = useMemo(
    () => ({
      addTab,
      removeTab,
      moveTab,
      setActiveTab,
      pinTab,
      unpinTab,
      updateTab,
      addGroup,
      removeGroup,
      moveGroup,
      updateGroup,
      collapseGroup,
      expandGroup,
      dissolveGroup,
      addTabToGroup,
      removeTabFromGroup,
      moveTabInGroup,
      moveTabToGroup,
      createGroupFromTab,
      dispatch: dispatch as (action: TabBarAction) => void,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      addTab, removeTab, moveTab, setActiveTab, pinTab, unpinTab, updateTab,
      addGroup, removeGroup, moveGroup, updateGroup, collapseGroup, expandGroup,
      dissolveGroup, addTabToGroup, removeTabFromGroup, moveTabInGroup,
      moveTabToGroup, createGroupFromTab,
    ]
  );

  return {
    // State slices
    tabs: state.tabs,
    groups: state.groups,
    slots: state.slots,
    activeTabId: state.activeTabId,
    state,
    // All actions spread alongside state (dnd-kit style)
    ...actions,
  };
}
