// ─────────────────────────────────────────────────────────────────────────────
// Pure Reducer — @react-tabstack/core
// All state transitions live here. No side effects, fully unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  TabBarAction,
  TabBarState,
  TabSlot,
  DndResolveEvent,
} from './types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find which slot (and index within group) a tab lives in */
function findTabLocation(
  slots: TabSlot[],
  tabId: string
): { slotIndex: number; slot: TabSlot } | null {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.type === 'tab' && slot.tabId === tabId) {
      return { slotIndex: i, slot };
    }
    if (slot.type === 'group' && slot.tabIds.includes(tabId)) {
      return { slotIndex: i, slot };
    }
  }
  return null;
}

/** Find slot index by groupId */
function findGroupSlotIndex(slots: TabSlot[], groupId: string): number {
  return slots.findIndex((s) => s.type === 'group' && s.groupId === groupId);
}

/** Clamp a number to [min, max] */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * The index of the last pinned tab slot in the strip.
 * Pinned tabs occupy the front of the slots array.
 */
function lastPinnedIndex(state: TabBarState): number {
  let last = -1;
  for (let i = 0; i < state.slots.length; i++) {
    const slot = state.slots[i];
    if (slot.type === 'tab' && state.tabs[slot.tabId]?.pinned) {
      last = i;
    }
  }
  return last;
}

/** Remove a tab from whatever slot it is currently in (strip or group) */
function removeTabFromSlots(slots: TabSlot[], tabId: string): TabSlot[] {
  return slots.reduce<TabSlot[]>((acc, slot) => {
    if (slot.type === 'tab' && slot.tabId === tabId) {
      // Drop this slot entirely
      return acc;
    }
    if (slot.type === 'group') {
      const newTabIds = slot.tabIds.filter((id) => id !== tabId);
      acc.push({ ...slot, tabIds: newTabIds });
      return acc;
    }
    acc.push(slot);
    return acc;
  }, []);
}

/** Insert a strip-level slot at a given index */
function insertSlotAt(slots: TabSlot[], slot: TabSlot, index: number): TabSlot[] {
  const clamped = clamp(index, 0, slots.length);
  return [...slots.slice(0, clamped), slot, ...slots.slice(clamped)];
}

// ─── Main Reducer ─────────────────────────────────────────────────────────────

export function tabBarReducer<TTabMeta, TGroupMeta>(
  state: TabBarState<TTabMeta, TGroupMeta>,
  action: TabBarAction
): TabBarState<TTabMeta, TGroupMeta> {
  switch (action.type) {
    // ── Tab ──────────────────────────────────────────────────────────────────

    case 'ADD_TAB': {
      const { tab, position } = action;
      if (state.tabs[tab.id]) return state; // idempotent

      const newTabs = { ...state.tabs, [tab.id]: tab as Tab<TTabMeta> };
      const newSlot: TabSlot = { type: 'tab', tabId: tab.id };

      let slots: TabSlot[];
      if (tab.pinned) {
        // Pinned tabs go right after the last pinned tab
        const insertAt = lastPinnedIndex(state) + 1;
        slots = insertSlotAt(state.slots, newSlot, insertAt);
      } else {
        const insertAt = position ?? state.slots.length;
        slots = insertSlotAt(state.slots, newSlot, insertAt);
      }

      return {
        ...state,
        tabs: newTabs,
        slots,
        activeTabId: state.activeTabId ?? tab.id,
      };
    }

    case 'REMOVE_TAB': {
      const { tabId } = action;
      if (!state.tabs[tabId]) return state;

      const { [tabId]: _removed, ...remainingTabs } = state.tabs;
      const newSlots = removeTabFromSlots(state.slots, tabId);

      // If the removed tab was active, activate the nearest remaining tab
      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === tabId) {
        newActiveTabId = findNearestActiveTab(state.slots, tabId, newSlots);
      }

      return { ...state, tabs: remainingTabs as Record<string, Tab<TTabMeta>>, slots: newSlots, activeTabId: newActiveTabId };
    }

    case 'UPDATE_TAB': {
      const { tabId, patch } = action;
      if (!state.tabs[tabId]) return state;
      return {
        ...state,
        tabs: { ...state.tabs, [tabId]: { ...state.tabs[tabId], ...patch } as unknown as Tab<TTabMeta> },
      };
    }

    case 'MOVE_TAB': {
      const { tabId, toIndex } = action;
      const loc = findTabLocation(state.slots, tabId);
      if (!loc || loc.slot.type !== 'tab') return state;

      const withoutTab = state.slots.filter(
        (s) => !(s.type === 'tab' && s.tabId === tabId)
      );
      const clamped = clamp(toIndex, 0, withoutTab.length);
      const newSlots = insertSlotAt(withoutTab, { type: 'tab', tabId }, clamped);
      return { ...state, slots: newSlots };
    }

    case 'SET_ACTIVE_TAB': {
      return { ...state, activeTabId: action.tabId };
    }

    case 'PIN_TAB': {
      const tab = state.tabs[action.tabId];
      if (!tab || tab.pinned) return state;

      // Update tab, then re-sort: move to pinned zone
      const updatedTabs = { ...state.tabs, [action.tabId]: { ...tab, pinned: true } };
      const withoutTab = removeTabFromSlots(state.slots, action.tabId);
      const insertAt = lastPinnedIndex({ ...state, tabs: updatedTabs, slots: withoutTab }) + 1;
      const newSlots = insertSlotAt(withoutTab, { type: 'tab', tabId: action.tabId }, insertAt);
      return { ...state, tabs: updatedTabs, slots: newSlots };
    }

    case 'UNPIN_TAB': {
      const tab = state.tabs[action.tabId];
      if (!tab || !tab.pinned) return state;

      const updatedTabs = { ...state.tabs, [action.tabId]: { ...tab, pinned: false } };
      // Move to just after the pinned zone
      const pinnedEnd = lastPinnedIndex(state);
      const withoutTab = removeTabFromSlots(state.slots, action.tabId);
      const newSlots = insertSlotAt(withoutTab, { type: 'tab', tabId: action.tabId }, pinnedEnd + 1);
      return { ...state, tabs: updatedTabs, slots: newSlots };
    }

    // ── Group ─────────────────────────────────────────────────────────────────

    case 'ADD_GROUP': {
      const { group, position } = action;
      if (state.groups[group.id]) return state;

      const newGroups = { ...state.groups, [group.id]: group as TabGroup<TGroupMeta> };
      const newSlot: TabSlot = { type: 'group', groupId: group.id, tabIds: [] };
      const insertAt = position ?? state.slots.length;
      const newSlots = insertSlotAt(state.slots, newSlot, insertAt);
      return { ...state, groups: newGroups, slots: newSlots };
    }

    case 'REMOVE_GROUP': {
      const { groupId, dissolve = false } = action;
      if (!state.groups[groupId]) return state;

      const { [groupId]: _removed, ...remainingGroups } = state.groups;
      let newSlots: TabSlot[];

      if (dissolve) {
        // Eject all tabs back into strip at the group's position
        const groupSlotIdx = findGroupSlotIndex(state.slots, groupId);
        const groupSlot = state.slots[groupSlotIdx] as Extract<TabSlot, { type: 'group' }>;
        const ejectedSlots: TabSlot[] = groupSlot.tabIds.map((tabId) => ({
          type: 'tab',
          tabId,
        }));
        newSlots = [
          ...state.slots.slice(0, groupSlotIdx),
          ...ejectedSlots,
          ...state.slots.slice(groupSlotIdx + 1),
        ];
      } else {
        // Remove tabs in group too
        const groupSlot = state.slots.find(
          (s) => s.type === 'group' && s.groupId === groupId
        ) as Extract<TabSlot, { type: 'group' }> | undefined;
        const tabsToRemove = new Set(groupSlot?.tabIds ?? []);
        newSlots = state.slots.filter(
          (s) => !(s.type === 'group' && s.groupId === groupId)
        );
        const remainingTabs = Object.fromEntries(
          Object.entries(state.tabs).filter(([id]) => !tabsToRemove.has(id))
        ) as unknown as Record<string, Tab<TTabMeta>>;

        let newActiveTabId = state.activeTabId;
        if (state.activeTabId && tabsToRemove.has(state.activeTabId)) {
          newActiveTabId = findNearestActiveTab(state.slots, state.activeTabId, newSlots);
        }
        return {
          ...state,
          tabs: remainingTabs,
          groups: remainingGroups as Record<string, TabGroup<TGroupMeta>>,
          slots: newSlots,
          activeTabId: newActiveTabId,
        };
      }

      return {
        ...state,
        groups: remainingGroups as Record<string, TabGroup<TGroupMeta>>,
        slots: newSlots,
      };
    }

    case 'UPDATE_GROUP': {
      const { groupId, patch } = action;
      if (!state.groups[groupId]) return state;
      return {
        ...state,
        groups: { ...state.groups, [groupId]: { ...state.groups[groupId], ...patch } as unknown as TabGroup<TGroupMeta> },
      };
    }

    case 'COLLAPSE_GROUP': {
      return tabBarReducer(state, {
        type: 'UPDATE_GROUP',
        groupId: action.groupId,
        patch: { collapsed: true },
      });
    }

    case 'EXPAND_GROUP': {
      return tabBarReducer(state, {
        type: 'UPDATE_GROUP',
        groupId: action.groupId,
        patch: { collapsed: false },
      });
    }

    case 'DISSOLVE_GROUP': {
      return tabBarReducer(state, {
        type: 'REMOVE_GROUP',
        groupId: action.groupId,
        dissolve: true,
      });
    }

    case 'MOVE_GROUP': {
      const { groupId, toIndex } = action;
      const currentIdx = findGroupSlotIndex(state.slots, groupId);
      if (currentIdx === -1) return state;

      const groupSlot = state.slots[currentIdx];
      const withoutGroup = state.slots.filter((_, i) => i !== currentIdx);
      const clamped = clamp(toIndex, 0, withoutGroup.length);
      const newSlots = insertSlotAt(withoutGroup, groupSlot, clamped);
      return { ...state, slots: newSlots };
    }

    // ── Group ↔ Tab ───────────────────────────────────────────────────────────

    case 'ADD_TAB_TO_GROUP': {
      const { tabId, groupId, index } = action;
      if (!state.tabs[tabId] || !state.groups[groupId]) return state;

      // Remove from current location in strip (or other group)
      const slotsWithoutTab = removeTabFromSlots(state.slots, tabId);

      // Insert into target group
      const newSlots = slotsWithoutTab.map((slot) => {
        if (slot.type !== 'group' || slot.groupId !== groupId) return slot;
        const insertAt = index ?? slot.tabIds.length;
        const newTabIds = [
          ...slot.tabIds.slice(0, insertAt),
          tabId,
          ...slot.tabIds.slice(insertAt),
        ];
        return { ...slot, tabIds: newTabIds };
      });

      return { ...state, slots: newSlots };
    }

    case 'REMOVE_TAB_FROM_GROUP': {
      const { tabId, stripIndex } = action;

      // Find which group the tab is in
      const groupSlot = state.slots.find(
        (s): s is Extract<TabSlot, { type: 'group' }> =>
          s.type === 'group' && s.tabIds.includes(tabId)
      );
      if (!groupSlot) return state;

      const groupSlotIdx = state.slots.indexOf(groupSlot);

      // Remove from group, insert at strip position
      const slotsWithoutTab = removeTabFromSlots(state.slots, tabId);
      const insertAt = stripIndex ?? groupSlotIdx; // default: right before the group
      const newSlots = insertSlotAt(slotsWithoutTab, { type: 'tab', tabId }, insertAt);

      return { ...state, slots: newSlots };
    }

    case 'MOVE_TAB_IN_GROUP': {
      const { tabId, groupId, toIndex } = action;
      const newSlots = state.slots.map((slot) => {
        if (slot.type !== 'group' || slot.groupId !== groupId) return slot;
        const from = slot.tabIds.indexOf(tabId);
        if (from === -1) return slot;
        const without = slot.tabIds.filter((id) => id !== tabId);
        const clamped = clamp(toIndex, 0, without.length);
        const newTabIds = [...without.slice(0, clamped), tabId, ...without.slice(clamped)];
        return { ...slot, tabIds: newTabIds };
      });
      return { ...state, slots: newSlots };
    }

    case 'MOVE_TAB_BETWEEN_GROUPS': {
      const { tabId, fromGroupId, toGroupId, toIndex } = action;

      // Remove from source group
      const slotsWithoutTab = state.slots.map((slot) => {
        if (slot.type !== 'group' || slot.groupId !== fromGroupId) return slot;
        return { ...slot, tabIds: slot.tabIds.filter((id) => id !== tabId) };
      });

      // Insert into destination group
      const newSlots = slotsWithoutTab.map((slot) => {
        if (slot.type !== 'group' || slot.groupId !== toGroupId) return slot;
        const insertAt = toIndex ?? slot.tabIds.length;
        const newTabIds = [
          ...slot.tabIds.slice(0, insertAt),
          tabId,
          ...slot.tabIds.slice(insertAt),
        ];
        return { ...slot, tabIds: newTabIds };
      });

      return { ...state, slots: newSlots };
    }

    case 'CREATE_GROUP_FROM_TAB': {
      const { tabId, group } = action;
      if (!state.tabs[tabId] || state.groups[group.id]) return state;

      const loc = findTabLocation(state.slots, tabId);
      if (!loc) return state;

      // Remove tab from strip/group, insert new group slot at same position
      const slotsWithoutTab = removeTabFromSlots(state.slots, tabId);
      const insertAt = loc.slotIndex;
      const newSlot: TabSlot = { type: 'group', groupId: group.id, tabIds: [tabId] };
      const newSlots = insertSlotAt(slotsWithoutTab, newSlot, insertAt);
      const newGroups = { ...state.groups, [group.id]: group as TabGroup<TGroupMeta> };

      return { ...state, groups: newGroups, slots: newSlots };
    }

    // ── DnD Resolve ───────────────────────────────────────────────────────────

    case 'DND_RESOLVE': {
      return resolveDndEvent(state, action.dragEvent);
    }

    default:
      return state;
  }
}

// ─── DnD Resolution ───────────────────────────────────────────────────────────

function resolveDndEvent<TTabMeta, TGroupMeta>(
  state: TabBarState<TTabMeta, TGroupMeta>,
  event: DndResolveEvent
): TabBarState<TTabMeta, TGroupMeta> {
  switch (event.kind) {
    case 'SORT_STRIP': {
      // activeId and overId are both slot-level IDs (tabId or groupId)
      const { activeId, overId } = event;
      const fromIdx = state.slots.findIndex(
        (s) => (s.type === 'tab' && s.tabId === activeId) || (s.type === 'group' && s.groupId === activeId)
      );
      const toIdx = state.slots.findIndex(
        (s) => (s.type === 'tab' && s.tabId === overId) || (s.type === 'group' && s.groupId === overId)
      );
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return state;

      const newSlots = [...state.slots];
      const [moved] = newSlots.splice(fromIdx, 1);
      newSlots.splice(toIdx, 0, moved);
      return { ...state, slots: newSlots };
    }

    case 'DROP_INTO_GROUP':
      return tabBarReducer(state, {
        type: 'ADD_TAB_TO_GROUP',
        tabId: event.tabId,
        groupId: event.groupId,
        index: event.index,
      });

    case 'EJECT_FROM_GROUP':
      return tabBarReducer(state, {
        type: 'REMOVE_TAB_FROM_GROUP',
        tabId: event.tabId,
        stripIndex: event.stripIndex,
      });

    case 'MOVE_BETWEEN_GROUPS':
      return tabBarReducer(state, {
        type: 'MOVE_TAB_BETWEEN_GROUPS',
        tabId: event.tabId,
        fromGroupId: event.fromGroupId,
        toGroupId: event.toGroupId,
        toIndex: event.index,
      });

    case 'SORT_GROUP_TABS':
      return tabBarReducer(state, {
        type: 'MOVE_TAB_IN_GROUP',
        tabId: event.tabId,
        groupId: event.groupId,
        toIndex: event.toIndex,
      });

    case 'SORT_GROUP_IN_STRIP':
      return tabBarReducer(state, {
        type: 'MOVE_GROUP',
        groupId: event.groupId,
        toIndex: event.toIndex,
      });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** After removing a tab, find the best candidate to activate */
function findNearestActiveTab(
  oldSlots: TabSlot[],
  removedTabId: string,
  newSlots: TabSlot[]
): string | null {
  // Find position of removed tab in old slots (flattened)
  const flatOld = flattenSlots(oldSlots);
  const removedIdx = flatOld.indexOf(removedTabId);

  const flatNew = flattenSlots(newSlots);
  if (flatNew.length === 0) return null;

  // Try the tab that was after it, then before it
  for (let i = removedIdx; i < flatOld.length; i++) {
    if (flatNew.includes(flatOld[i])) return flatOld[i];
  }
  for (let i = removedIdx - 1; i >= 0; i--) {
    if (flatNew.includes(flatOld[i])) return flatOld[i];
  }
  return flatNew[0] ?? null;
}

/** Flatten all tab IDs from slots in order */
function flattenSlots(slots: TabSlot[]): string[] {
  return slots.flatMap((s) => (s.type === 'tab' ? [s.tabId] : s.tabIds));
}

// Re-export for convenience
import type { Tab, TabGroup } from './types.js';
