import { arrayMove } from '@dnd-kit/sortable';
import type { DndResolveEvent, TabBarState } from '@react-tabstack/core';

// Pure drag-resolution logic — no React, no dnd-kit context.
//
// A drag has two independent concerns:
//   1. Membership — which container (strip or a group) holds the tab. Applied
//      to the preview state on every drag-over, so the tab's sortable node
//      moves into the target container's SortableContext and dnd-kit's native
//      make-space sorting takes over there.
//   2. Ordering — where inside the final container the tab lands. Never applied
//      during the drag (dnd-kit transforms preview it); resolved once at drop
//      via simulate-then-read-back.

export type DragData = Record<string, unknown>;

export function topLevelIds(state: TabBarState): string[] {
  return state.slots.map((s) => (s.type === 'tab' ? s.tabId : s.groupId));
}

export function groupTabIds(state: TabBarState, groupId: string): string[] {
  const slot = state.slots.find((s) => s.type === 'group' && s.groupId === groupId);
  return slot?.type === 'group' ? slot.tabIds : [];
}

/** Group the tab currently lives in, or null when it sits in the top-level strip. */
export function containerOf(state: TabBarState, tabId: string): string | null {
  const slot = state.slots.find((s) => s.type === 'group' && s.tabIds.includes(tabId));
  return slot?.type === 'group' ? slot.groupId : null;
}

/**
 * Which container the current collision target implies: a groupId, null for
 * the strip, or undefined when the target says nothing about membership.
 */
export function membershipTargetFor(overId: string, overData: DragData): string | null | undefined {
  if (overData.type === 'group-pill') return overData.groupId as string;
  if (overData.type === 'group-tab') return overData.groupId as string;
  // An empty group's own container (nothing to hit-test a nearest group-tab
  // against yet) — matched by data, not by assuming its id has any
  // particular shape, so a consumer can name/render this container however
  // they like as long as it carries { type: 'group-dropdown', groupId }.
  if (overData.type === 'group-dropdown') return overData.groupId as string;
  if (overData.type === 'tab' || overData.type === 'group' || overId === 'strip') return null;
  return undefined;
}

/**
 * Event moving the tab into `target` (appended at the end — entering at the
 * end keeps dnd-kit's directional sorting stable, per the battle-tested
 * multi-container pattern), or null when it's already there.
 */
export function membershipEvent(
  state: TabBarState,
  tabId: string,
  target: string | null
): DndResolveEvent | null {
  const from = containerOf(state, tabId);
  if (from === target) return null;
  if (target === null) {
    return { kind: 'EJECT_FROM_GROUP', tabId, groupId: from as string, stripIndex: state.slots.length };
  }
  if (from === null) {
    return { kind: 'DROP_INTO_GROUP', tabId, groupId: target, index: groupTabIds(state, target).length };
  }
  return { kind: 'MOVE_BETWEEN_GROUPS', tabId, fromGroupId: from, toGroupId: target, index: groupTabIds(state, target).length };
}

/**
 * Final in-container ordering at drop time, computed against a state where
 * membership has already been settled. Returns null when the drop position is
 * already correct (e.g. combine-into-pill drops keep the appended position).
 */
export function orderingEvent(
  state: TabBarState,
  activeId: string,
  activeData: DragData,
  overId: string,
  overData: DragData
): DndResolveEvent | null {
  if (activeData.type === 'group') {
    const topIds = topLevelIds(state);
    const target = overId === 'strip' ? topIds[topIds.length - 1] : topIds.includes(overId) ? overId : null;
    if (!target || target === activeId) return null;
    return { kind: 'SORT_STRIP', activeId, overId: target };
  }

  const tabId = (activeData.tabId ?? activeId) as string;

  if (overData.type === 'group-tab') {
    const groupId = overData.groupId as string;
    const ids = groupTabIds(state, groupId);
    const fromIdx = ids.indexOf(tabId);
    const overIdx = ids.indexOf(overData.tabId as string);
    if (fromIdx === -1 || overIdx === -1 || fromIdx === overIdx) return null;
    const toIndex = arrayMove(ids, fromIdx, overIdx).indexOf(tabId);
    return { kind: 'SORT_GROUP_TABS', tabId, groupId, toIndex };
  }

  if (overData.type === 'tab' || overData.type === 'group' || overId === 'strip') {
    const topIds = topLevelIds(state);
    const target = overId === 'strip' || !topIds.includes(overId) ? topIds[topIds.length - 1] : overId;
    if (!target || target === tabId) return null;
    return { kind: 'SORT_STRIP', activeId: tabId, overId: target };
  }

  return null;
}
