import { arrayMove } from '@dnd-kit/sortable';
import type { DndResolveEvent, TabBarState } from '@react-tabstack/core';

// ─────────────────────────────────────────────────────────────────────────────
// Pure drag-resolution logic — no React, no dnd-kit context, fully unit-testable
// against constructed fixtures. Used identically by TabBarProvider during the
// live drag (to update the local preview, same-container moves only) and at
// drop time (to compute the committed state for every move kind).
// ─────────────────────────────────────────────────────────────────────────────

export type DragData = Record<string, unknown>;

export function topLevelIds(state: TabBarState): string[] {
  return state.slots.map((s) => (s.type === 'tab' ? s.tabId : s.groupId));
}

export function groupTabIds(state: TabBarState, groupId: string): string[] {
  const slot = state.slots.find((s) => s.type === 'group' && s.groupId === groupId);
  return slot?.type === 'group' ? slot.tabIds : [];
}

/**
 * Resolves what a drag-over/drag-end collision means, in terms of the core
 * reducer's DndResolveEvent vocabulary.
 *
 * Branch order matters: group-pill (combine) is checked before the eject-to-strip
 * fallback, so a group-tab dropped on a *different* group's pill routes to
 * MOVE_BETWEEN_GROUPS instead of being ejected to the top-level strip.
 */
export function resolveDropEvent(
  state: TabBarState,
  activeId: string,
  overId: string,
  activeData: DragData,
  overData: DragData
): DndResolveEvent | null {
  if (activeId === overId) return null;

  // ── Combine into / move between groups via the pill itself ─────────────────
  if (overData.type === 'group-pill') {
    const groupId = overData.groupId as string;
    if (activeData.type === 'group-tab') {
      if (activeData.groupId === groupId) return null; // hovering your own group's pill — no-op
      return {
        kind: 'MOVE_BETWEEN_GROUPS',
        tabId: activeData.tabId as string,
        fromGroupId: activeData.groupId as string,
        toGroupId: groupId,
        index: groupTabIds(state, groupId).length,
      };
    }
    if (activeData.type === 'tab') {
      return { kind: 'DROP_INTO_GROUP', tabId: activeData.tabId as string, groupId, index: 0 };
    }
    return null; // groups can't nest into groups
  }

  // ── Reorder / move within an open group's dropdown ──────────────────────────
  if (overData.type === 'group-tab' || String(overId).startsWith('group-dropdown:')) {
    if (activeData.type !== 'tab' && activeData.type !== 'group-tab') return null;
    const groupId =
      overData.type === 'group-tab' ? (overData.groupId as string) : String(overId).replace('group-dropdown:', '');
    const targetIds = groupTabIds(state, groupId);
    const isSameGroup = activeData.type === 'group-tab' && activeData.groupId === groupId;

    let toIndex: number;
    if (overData.type === 'group-tab') {
      const withActive = isSameGroup ? targetIds : [...targetIds, activeData.tabId as string];
      const fromIdx = withActive.indexOf(activeData.tabId as string);
      const overIdx = withActive.indexOf(overData.tabId as string);
      toIndex = fromIdx === -1 || overIdx === -1 ? targetIds.length : arrayMove(withActive, fromIdx, overIdx).indexOf(activeData.tabId as string);
    } else {
      toIndex = targetIds.length; // dropped on the dropdown's empty space — append
    }

    if (activeData.type === 'group-tab') {
      return isSameGroup
        ? { kind: 'SORT_GROUP_TABS', tabId: activeData.tabId as string, groupId, toIndex }
        : {
            kind: 'MOVE_BETWEEN_GROUPS',
            tabId: activeData.tabId as string,
            fromGroupId: activeData.groupId as string,
            toGroupId: groupId,
            index: toIndex,
          };
    }
    return { kind: 'DROP_INTO_GROUP', tabId: activeData.tabId as string, groupId, index: toIndex };
  }

  // ── Eject from a group back to the top-level strip ──────────────────────────
  if (activeData.type === 'group-tab') {
    const topIds = topLevelIds(state);
    const overIdx = topIds.indexOf(overId);
    let stripIndex: number;
    if (overId === 'strip' || overIdx === -1) {
      stripIndex = topIds.length;
    } else {
      const withActive = [...topIds, activeData.tabId as string];
      stripIndex = arrayMove(withActive, withActive.length - 1, overIdx).indexOf(activeData.tabId as string);
    }
    return { kind: 'EJECT_FROM_GROUP', tabId: activeData.tabId as string, groupId: activeData.groupId as string, stripIndex };
  }

  // ── Sort within the top-level strip (bare tab or a whole group pill) ────────
  if (activeData.type === 'tab' || activeData.type === 'group') {
    const activeSlotId = activeData.type === 'tab' ? (activeData.tabId as string) : (activeData.groupId as string);
    const topIds = topLevelIds(state);
    const overSlotId = overId === 'strip' || !topIds.includes(overId) ? topIds[topIds.length - 1] ?? activeSlotId : overId;
    if (overSlotId === activeSlotId) return null;
    return { kind: 'SORT_STRIP', activeId: activeSlotId, overId: overSlotId };
  }

  return null;
}
