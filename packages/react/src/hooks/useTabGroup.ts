import { useCallback, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTabBarContext } from '../context.js';
import { useStableArray } from './useStableArray.js';
import type { Tab } from '@react-tabstack/core';

// ─────────────────────────────────────────────────────────────────────────────
// useTabGroup — make any element a draggable group pill in the strip
//
// The group pill is:
//   1. A sortable item in the strip (drag to reorder)
//   2. A droppable target (tabs can be dropped into it)
//   3. Open/close state comes from the shared dropdown coordinator (context),
//      the single source of truth for "which one group is open" — both during a
//      drag-hover and for plain mouse hover/click. A per-instance "pinned" bit
//      (set on click) keeps a click-opened dropdown from closing on the next
//      unrelated mouse-leave, without needing the shared coordinator to know
//      about *why* a group is open.
//   4. Closes on outside click — pass `setDropdownRef` to whatever DOM node
//      renders the open dropdown's *content* (even if portalled elsewhere), so
//      the outside-click check can exclude it; without it, only clicks outside
//      the pill itself would count as "outside."
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTabGroupReturn {
  /** Attach to your group pill's DOM node */
  setNodeRef: (node: HTMLElement | null) => void;
  /**
   * Attach to the DOM node that renders this group's open dropdown content
   * (works even if it's portalled elsewhere) so outside-click detection knows
   * clicks inside it aren't "outside."
   */
  setDropdownRef: (node: HTMLElement | null) => void;
  /** Spread onto the same dropdown content node as setDropdownRef — keeps hover-driven open/close from firing while the pointer is over the dropdown's own contents */
  dropdownAttributes: { onMouseEnter: () => void; onMouseLeave: (event: React.MouseEvent) => void };
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  style: React.CSSProperties;

  // State
  isOpen: boolean;
  isPinned: boolean;
  isDragging: boolean;
  /** Something (drag or otherwise) is hovering this pill, in either combine or sort-adjacent mode */
  isOver: boolean;
  /**
   * The pointer is over the pill's *combine* zone specifically (the inner ~80%
   * by default) — dropping now would add the dragged tab to this group, as
   * opposed to sorting next to the pill. Style this distinctly from `isOver`.
   */
  isCombineTarget: boolean;
  /** Hover timer is running — about to open */
  isOverDwell: boolean;
  /** The currently active tab lives inside this group */
  containsActive: boolean;
  /** The tabs inside this group (in order) */
  tabs: Tab[];
  /** Same tabs, as bare ids — pass straight through to <SortableContext items={...}> */
  tabIds: string[];
  color: string | undefined;
  label: string;

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  collapse: () => void;
  expand: () => void;
  /** Ungroup all: ejects all tabs to strip and removes the group */
  dissolve: () => void;
}

export function useTabGroup(groupId: string): UseTabGroupReturn {
  const { state, actions, groupOpenOn: contextGroupOpenOn, dropdown, isDragActive } = useTabBarContext();

  const group = state.groups[groupId];
  const groupSlot = state.slots.find((s) => s.type === 'group' && s.groupId === groupId);
  const tabIds = useStableArray(groupSlot?.type === 'group' ? groupSlot.tabIds : []);
  const tabs = useStableArray(tabIds.map((id) => state.tabs[id]).filter(Boolean) as Tab[]);

  const isOpen = dropdown.openGroupId === groupId;
  const openOn = group?.openOn ?? contextGroupOpenOn;
  const containsActive = state.activeTabId !== null && tabIds.includes(state.activeTabId);

  // Tracks whether this group was opened via click ("pinned") so an unrelated
  // mouse-leave doesn't schedule it closed. Reset once the coordinator moves on.
  const pinnedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) pinnedRef.current = false;
  }, [isOpen]);

  const {
    setNodeRef: setSortableRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    isOver: isSortableOver,
  } = useSortable({
    id: groupId,
    data: { type: 'group', groupId },
    disabled: group?.draggable === false,
  });

  // Also register as a droppable for tabs being dragged into this group. Its
  // `isOver` is true only when collision detection resolved to *this specific*
  // droppable — i.e. only inside the dead-zone "combine" region (see
  // tabbedCollisionDetection). Sorting next to the pill instead resolves to the
  // plain sortable id, which is what `isSortableOver` tracks.
  const { setNodeRef: setDroppableRef, isOver: isCombineTarget } = useDroppable({
    id: `group-pill:${groupId}`,
    data: { type: 'group-pill', groupId },
  });

  const isOver = isSortableOver || isCombineTarget;
  const isOverDwell = isCombineTarget && !isOpen;

  // Trigger + portalled-content refs, for outside-click close detection below.
  const triggerNodeRef = useRef<HTMLElement | null>(null);
  const dropdownContentRef = useRef<HTMLElement | null>(null);

  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      triggerNodeRef.current = node;
      setSortableRef(node);
      setDroppableRef(node);
    },
    [setSortableRef, setDroppableRef]
  );

  const setDropdownRef = useCallback((node: HTMLElement | null) => {
    dropdownContentRef.current = node;
  }, []);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    '--group-color': group?.color,
  } as React.CSSProperties;

  // ── Non-drag open/close based on openOn ───────────────────────────────────
  // Real mouseenter/mouseleave still fire during pointer drags; the coordinator
  // is driven exclusively by collision targets then, so these bail out.
  const isDragActiveRef = useRef(isDragActive);
  isDragActiveRef.current = isDragActive;

  const handleMouseEnter = useCallback(() => {
    if (isDragActiveRef.current) return;
    if (openOn === 'hover' || openOn === 'hover+click') {
      dropdown.setHoverTarget(groupId);
    }
  }, [openOn, dropdown, groupId]);

  const handleMouseLeave = useCallback((event: React.MouseEvent) => {
    if (isDragActiveRef.current) return;
    if (pinnedRef.current) return; // click-pinned — only an explicit close() or another group opening moves it
    // A tab's own ⋮/right-click menu portals its content straight to
    // document.body — a DOM sibling of this dropdown, not a descendant — so
    // moving the pointer onto it is a *real* mouseleave on the dropdown div
    // even though the user never actually left the group's UI. Without this
    // check, opening that menu starts the close-dwell timer, and picking an
    // item (almost always >200ms later) closes the group dropdown out from
    // under the still-open menu, unmounting it before the click can land —
    // "Close"/"Move to Group" etc. inside a group silently doing nothing.
    const related = event.relatedTarget;
    if (related instanceof Element && related.closest('[role="menu"]')) return;
    if (openOn === 'hover' || openOn === 'hover+click') {
      dropdown.setHoverTarget(null);
    }
  }, [openOn, dropdown]);

  const open = useCallback(() => {
    pinnedRef.current = true;
    dropdown.openImmediate(groupId);
  }, [dropdown, groupId]);

  const close = useCallback(() => {
    pinnedRef.current = false;
    dropdown.closeImmediate();
  }, [dropdown]);

  const toggle = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [isOpen, open, close]);

  const collapse = useCallback(() => actions.collapseGroup(groupId), [actions, groupId]);
  const expand = useCallback(() => actions.expandGroup(groupId), [actions, groupId]);
  const dissolve = useCallback(() => actions.dissolveGroup(groupId), [actions, groupId]);

  // ── Outside-click close ────────────────────────────────────────────────────
  // Suppressed while a drag is active: open/close during a drag is driven
  // entirely by the coordinator's hover-zone logic, and a stray pointerdown
  // mid-drag (e.g. a second touch point) shouldn't fight it.
  useEffect(() => {
    if (!isOpen || isDragActive) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerNodeRef.current?.contains(target)) return;
      if (dropdownContentRef.current?.contains(target)) return;
      // A right-click / "more options" menu opened on something inside this
      // dropdown (e.g. a tab's context menu) portals its own content
      // elsewhere in the DOM — neither the trigger nor dropdownContentRef.
      // Without this, opening or clicking such a menu registered as "outside"
      // and closed the group out from under it. `role="menu"` is the stable
      // ARIA marker any menu implementation (Radix or otherwise) exposes.
      if (target instanceof Element && target.closest('[role="menu"]')) return;
      close();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [isOpen, isDragActive, close]);

  return {
    setNodeRef,
    setDropdownRef,
    attributes: {
      ...attributes,
      role: 'button',
      'aria-expanded': isOpen,
      'aria-label': `Tab group: ${group?.label ?? groupId}`,
      'data-group-id': groupId,
      'data-ts-group': groupId,
      'data-open': isOpen ? '' : undefined,
      'data-dragging': isDragging ? '' : undefined,
      'data-over': isOver ? '' : undefined,
      'data-combine-target': isCombineTarget ? '' : undefined,
      'data-contains-active': containsActive ? '' : undefined,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    // Spread onto the dropdown *content* container (in addition to
    // setDropdownRef) — without this, moving the pointer from the pill into a
    // portalled dropdown fires the pill's mouseleave with nothing to counter
    // it, and the close-dwell timer quietly closes the dropdown out from under
    // the user's cursor.
    dropdownAttributes: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    listeners,
    style,
    isOpen,
    isPinned: pinnedRef.current,
    isDragging,
    isOver,
    isCombineTarget,
    isOverDwell,
    containsActive,
    tabs,
    tabIds,
    color: group?.color,
    label: group?.label ?? groupId,
    open,
    close,
    toggle,
    collapse,
    expand,
    dissolve,
  };
}
