import { useCallback, useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTabBarContext } from '../context.js';
import type { Tab } from '@react-tabstack/core';

// ─────────────────────────────────────────────────────────────────────────────
// useTabGroup — make any element a draggable group pill in the strip
//
// The group pill is:
//   1. A sortable item in the strip (drag to reorder)
//   2. A droppable target (tabs can be dropped into it)
//   3. Has its own open/close state for the dropdown
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTabGroupReturn {
  /** Attach to your group pill's DOM node */
  setNodeRef: (node: HTMLElement | null) => void;
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  style: React.CSSProperties;

  // State
  isOpen: boolean;
  isPinned: boolean;
  isDragging: boolean;
  /** A tab is hovering directly over this pill */
  isOver: boolean;
  /** Hover timer is running — about to open */
  isOverDwell: boolean;
  /** The tabs inside this group (in order) */
  tabs: Tab[];
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
  const { state, actions, groupHoverDelay, groupOpenOn, dragDropState } =
    useTabBarContext();

  const [isOpen, setIsOpen] = useState(false);
  const [isOverDwell, setIsOverDwell] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const group = state.groups[groupId];
  const groupSlot = state.slots.find(
    (s) => s.type === 'group' && s.groupId === groupId
  );
  const tabIds = groupSlot?.type === 'group' ? groupSlot.tabIds : [];
  const tabs = tabIds.map((id) => state.tabs[id]).filter(Boolean) as Tab[];

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
  });

  // Also register as a droppable for tabs being dragged into this group
  const { setNodeRef: setDroppableRef, isOver: isDropOver } = useDroppable({
    id: `group-pill:${groupId}`,
    data: { type: 'group-pill', groupId },
  });

  const isOver = isSortableOver || isDropOver;

  // Merge the two refs
  const setNodeRef = useCallback(
    (node: HTMLElement | null) => {
      setSortableRef(node);
      setDroppableRef(node);
    },
    [setSortableRef, setDroppableRef]
  );

  // ── Hover dwell timer for drag-open ───────────────────────────────────────
  useEffect(() => {
    if (isDropOver && dragDropState.openGroupId !== groupId) {
      // Start dwell timer
      setIsOverDwell(true);
      hoverTimerRef.current = setTimeout(() => {
        setIsOpen(true);
      }, groupHoverDelay);
    } else {
      // Clear timer
      setIsOverDwell(false);
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    }
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, [isDropOver, groupId, groupHoverDelay, dragDropState.openGroupId]);

  // Close dropdown when drag ends globally (dragDropState.openGroupId becomes null)
  useEffect(() => {
    if (dragDropState.openGroupId === null && !isDropOver) {
      // Don't close immediately — might still be hovering non-drag
    }
  }, [dragDropState.openGroupId, isDropOver]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    '--group-color': group?.color,
  } as React.CSSProperties;

  // ── Non-drag open/close based on groupOpenOn ──────────────────────────────
  const handleMouseEnter = useCallback(() => {
    if (groupOpenOn === 'hover' || groupOpenOn === 'hover+click') {
      setIsOpen(true);
    }
  }, [groupOpenOn]);

  const handleMouseLeave = useCallback(() => {
    if (groupOpenOn === 'hover') {
      setIsOpen(false);
    }
    // 'hover+click' stays open until explicit click/close
  }, [groupOpenOn]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const collapse = useCallback(() => actions.collapseGroup(groupId), [actions, groupId]);
  const expand = useCallback(() => actions.expandGroup(groupId), [actions, groupId]);
  const dissolve = useCallback(() => actions.dissolveGroup(groupId), [actions, groupId]);

  return {
    setNodeRef,
    attributes: {
      ...attributes,
      role: 'button',
      'aria-expanded': isOpen,
      'aria-label': `Tab group: ${group?.label ?? groupId}`,
      'data-group-id': groupId,
      'data-open': isOpen ? '' : undefined,
      'data-dragging': isDragging ? '' : undefined,
      'data-over': isOver ? '' : undefined,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    listeners,
    style,
    isOpen,
    isPinned: false,
    isDragging,
    isOver,
    isOverDwell,
    tabs,
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
