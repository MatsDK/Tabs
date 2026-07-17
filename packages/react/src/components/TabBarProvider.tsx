import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type {
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  Modifier,
  SensorDescriptor,
} from '@dnd-kit/core';
import { createTabbedCollisionDetection } from '../collision/tabbedCollisionDetection.js';
import type { CollisionContext } from '../collision/tabbedCollisionDetection.js';
import type { Orientation } from '../axis.js';
import { useGroupDropdownCoordinator } from '../hooks/useGroupDropdownCoordinator.js';
import type { GroupDropdownCoordinator } from '../hooks/useGroupDropdownCoordinator.js';
import { membershipTargetFor, membershipEvent, orderingEvent } from '../dragResolution.js';
import type { DragData } from '../dragResolution.js';
import { TabBarContext } from '../context.js';
import { tabBarReducer, findEmptiedGroups } from '@react-tabstack/core';
import type {
  TabBarState,
  TabBarActions,
  TabGroup,
  TabBarProviderProps,
} from '@react-tabstack/core';

// ─────────────────────────────────────────────────────────────────────────────
// TabBarProvider — root orchestration component
//
// Wraps dnd-kit's DndContext and provides TabBarContext to the tree. Users pass
// state + onStateChange (controlled model, like <input>). During a drag, a local
// preview mirror of `state` is updated on every dragOver (resolved via the same
// logic used at drop time), so cross-container moves reorder live instead of only
// snapping into place on drop; the real onStateChange only fires once, on
// dragEnd — see resolveDropEvent below.
// ─────────────────────────────────────────────────────────────────────────────

type Data = DragData;

interface TabBarProviderInternalProps extends Omit<TabBarProviderProps, 'children' | 'onStateChange'> {
  actions: TabBarActions;
  /** Commits a fully-resolved next state: updates the controlled state and fires onGroupEmpty for any newly-emptied groups. */
  commit: (next: TabBarState, intentionallyRemovedGroupIds?: string[]) => void;
  children?: React.ReactNode;
  sensors?: SensorDescriptor<Record<string, unknown>>[];
  collisionDetection?: (ctx: CollisionContext) => ReturnType<typeof createTabbedCollisionDetection>;
  modifiers?: Modifier[];
  renderDragOverlay?: (activeId: string, data: Data) => React.ReactNode;
}

const EMPTY_MODIFIERS: Modifier[] = [];

function TabBarProviderInternal({
  state,
  commit,
  actions,
  orientation: orientationProp,
  dwell: dwellProp,
  groupHoverDelay,
  groupOpenOn = 'hover+click',
  dissolveEmptyGroups = false,
  autoScroll = true,
  onDragEscape,
  contextMenu,
  sensors: sensorsProp,
  collisionDetection: collisionDetectionProp,
  modifiers: modifiersProp,
  children,
  renderDragOverlay,
}: TabBarProviderInternalProps) {
  const orientation: Orientation = orientationProp ?? 'horizontal';
  // Near-instant by default: this gates the ONLY moment a group's dropdown
  // content exists in the DOM at all (see GroupPill's `isOpen` mount condition
  // in the demo). Anything much slower than ~60ms makes it feel like you can't
  // drag "into" a group at all, because there's nothing there yet to collide
  // with. Marple's own production value for the drag case is 50ms.
  const dwellOpen = dwellProp?.open ?? groupHoverDelay ?? 60;
  const dwellClose = dwellProp?.close ?? 200;
  const dwell = useMemo(() => ({ open: dwellOpen, close: dwellClose }), [dwellOpen, dwellClose]);

  const dropdown: GroupDropdownCoordinator = useGroupDropdownCoordinator(dwell);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<Data | null>(null);
  const [previewState, setPreviewState] = useState<TabBarState | null>(null);

  // Refs so the memoized dnd-kit handlers below don't need to be recreated (and
  // don't close over stale values) on every render.
  const stateRef = useRef(state);
  stateRef.current = state;
  const previewStateRef = useRef(previewState);
  previewStateRef.current = previewState;

  // ── Sensors ────────────────────────────────────────────────────────────────
  const defaultSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );
  const sensors = sensorsProp ?? defaultSensors;

  const collisionDetection = useMemo(
    () => (collisionDetectionProp ? collisionDetectionProp({ orientation }) : createTabbedCollisionDetection({ orientation })),
    [collisionDetectionProp, orientation]
  );

  // No axis-lock by default: restrictToHorizontalAxis/VerticalAxis pins the drag
  // *overlay* to one axis, but moving a tab into a group's dropdown fundamentally
  // requires cross-axis pointer movement (e.g. down, out of a horizontal strip).
  // Locking it by default made the overlay visually lag the real pointer and made
  // group targeting feel broken. `axis.axisModifier` is still exported for
  // consumers with no groups who want a strictly single-axis sortable list.
  const modifiers = modifiersProp ?? EMPTY_MODIFIERS;

  // ── Drag event handlers ────────────────────────────────────────────────────

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setActiveData((active.data.current as Data) ?? null);
    setPreviewState(stateRef.current);
  }, []);

  // During a drag, preview state tracks MEMBERSHIP only (which container holds
  // the tab). Ordering inside a container is previewed by dnd-kit's own
  // transforms — the tab shares one sortable id everywhere, so once membership
  // moves it, it natively joins the target SortableContext's make-space sorting.
  // The final order is resolved once, at drop.
  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over) {
        dropdown.setHoverTarget(null);
        return;
      }
      const overData = (over.data.current ?? {}) as Data;
      const activeData0 = (active.data.current ?? {}) as Data;
      const overIdStr = String(over.id);

      const target = membershipTargetFor(overIdStr, overData);
      dropdown.setHoverTarget(typeof target === 'string' ? target : null);

      if (activeData0.type === 'group' || target === undefined) return;
      setPreviewState((prev) => {
        const base = prev ?? stateRef.current;
        const tabId = (activeData0.tabId ?? String(active.id)) as string;
        const event = membershipEvent(base, tabId, target);
        if (!event) return prev;
        return tabBarReducer(base, { type: 'DND_RESOLVE', dragEvent: event });
      });
    },
    [dropdown]
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      const base0 = previewStateRef.current ?? stateRef.current;
      setActiveId(null);
      setActiveData(null);
      setPreviewState(null);
      dropdown.closeImmediate();

      const activeData0 = (active.data.current ?? {}) as Data;
      if (!over) {
        if (activeData0.type === 'tab' || activeData0.type === 'group-tab') {
          onDragEscape?.(String(active.id), actions);
        }
        return;
      }

      const overData = (over.data.current ?? {}) as Data;
      const overIdStr = String(over.id);
      const activeIdStr = String(active.id);

      let base = base0;
      if (activeData0.type !== 'group') {
        const target = membershipTargetFor(overIdStr, overData);
        if (target !== undefined) {
          const tabId = (activeData0.tabId ?? activeIdStr) as string;
          const event = membershipEvent(base, tabId, target);
          if (event) base = tabBarReducer(base, { type: 'DND_RESOLVE', dragEvent: event });
        }
      }
      const ordering = orderingEvent(base, activeIdStr, activeData0, overIdStr, overData);
      const final = ordering ? tabBarReducer(base, { type: 'DND_RESOLVE', dragEvent: ordering }) : base;
      if (final !== stateRef.current) commit(final);
    },
    [actions, onDragEscape, commit, dropdown]
  );

  const handleDragCancel = useCallback(
    (_event: DragCancelEvent) => {
      setActiveId(null);
      setActiveData(null);
      setPreviewState(null);
      dropdown.closeImmediate();
    },
    [dropdown]
  );

  // ── Context value ──────────────────────────────────────────────────────────
  const displayState = previewState ?? state;

  const contextValue = useMemo(
    () => ({
      state: displayState,
      actions,
      orientation,
      isDragActive: activeId !== null,
      dropdown,
      dwell,
      groupOpenOn,
      dissolveEmptyGroups,
      contextMenu,
    }),
    [displayState, actions, orientation, activeId, dropdown, dwell, groupOpenOn, dissolveEmptyGroups, contextMenu]
  );

  return (
    <TabBarContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        autoScroll={autoScroll}
        modifiers={modifiers}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
          {activeId && activeData
            ? renderDragOverlay
              ? renderDragOverlay(activeId, activeData)
              : <DefaultDragOverlay activeId={activeId} activeData={activeData} state={displayState} />
            : null}
        </DragOverlay>
      </DndContext>
    </TabBarContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default drag overlay — unstyled. A headless library shouldn't guess at a
// consumer's theme; style `[data-ts-drag-overlay]` or pass `renderDragOverlay`.
// ─────────────────────────────────────────────────────────────────────────────

function DefaultDragOverlay({ activeId, activeData, state }: { activeId: string; activeData: Data; state: TabBarState }) {
  const tabId = (activeData.tabId ?? activeId) as string;
  const groupId = activeData.groupId as string | undefined;
  const tab = state.tabs[tabId];
  const group = groupId ? state.groups[groupId] : undefined;

  return (
    <div data-ts-drag-overlay="" data-ts-dragging-type={String(activeData.type ?? '')} style={{ cursor: 'grabbing' }}>
      {tab?.label ?? group?.label ?? activeId}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public TabBarProvider — builds actions bound to onStateChange, and centralizes
// the commit path (state update + onGroupEmpty notification) so every mutation —
// drag-resolved or not — goes through the same logic.
// ─────────────────────────────────────────────────────────────────────────────

export type { TabBarProviderProps };

export function TabBarProvider({
  state,
  onStateChange,
  onGroupEmpty,
  dissolveEmptyGroups = false,
  children,
  ...rest
}: TabBarProviderProps & {
  sensors?: SensorDescriptor<Record<string, unknown>>[];
  collisionDetection?: (ctx: CollisionContext) => ReturnType<typeof createTabbedCollisionDetection>;
  modifiers?: Modifier[];
  renderDragOverlay?: (activeId: string, data: Data) => React.ReactNode;
}) {
  // actions reference commit, commit references actions (for the onGroupEmpty
  // callback's second argument) — broken via a ref, set once actions exist.
  const actionsRef = useRef<TabBarActions | null>(null);

  const commit = useCallback(
    (next: TabBarState, intentionallyRemovedGroupIds?: string[]) => {
      // Exclude groups the action *itself* just deliberately removed/dissolved —
      // findEmptiedGroups can't tell "went empty then got pruned" apart from
      // "user explicitly deleted the group" from state alone, since both leave
      // an identical before/after diff. The action creators below know which
      // case they're in, so they pass the exclusion through.
      const exclude = new Set(intentionallyRemovedGroupIds ?? []);
      const emptied = findEmptiedGroups(state, next).filter((id) => !exclude.has(id));
      onStateChange(next);
      if (actionsRef.current) {
        for (const groupId of emptied) onGroupEmpty?.(groupId, actionsRef.current);
      }
    },
    [state, onStateChange, onGroupEmpty]
  );

  const actions = useMemo(() => {
    const built = buildActions(state, commit, dissolveEmptyGroups);
    actionsRef.current = built;
    return built;
  }, [state, commit, dissolveEmptyGroups]);

  return (
    <TabBarProviderInternal
      state={state}
      commit={commit}
      actions={actions}
      onGroupEmpty={onGroupEmpty}
      dissolveEmptyGroups={dissolveEmptyGroups}
      {...rest}
    >
      {children as React.ReactNode}
    </TabBarProviderInternal>
  );
}

/** Build TabBarActions bound to a controlled commit function. */
function buildActions(
  state: TabBarState,
  commit: (s: TabBarState, intentionallyRemovedGroupIds?: string[]) => void,
  dissolveEmptyGroupsDefault: boolean
): TabBarActions {
  const dispatch = (action: Parameters<typeof tabBarReducer>[1]) => {
    // REMOVE_GROUP/DISSOLVE_GROUP are the only actions that can make a group
    // vanish on purpose — exclude their target from the onGroupEmpty diff so a
    // deliberate "Ungroup"/"Close group" doesn't also fire the "went empty"
    // notification for the very group the user just chose to remove.
    const intentional = action.type === 'REMOVE_GROUP' || action.type === 'DISSOLVE_GROUP' ? [action.groupId] : undefined;
    commit(tabBarReducer(state, action), intentional);
  };

  const withGroupDefaults = (group: TabGroup): TabGroup => ({
    ...group,
    dissolveOnEmpty: group.dissolveOnEmpty ?? dissolveEmptyGroupsDefault,
  });

  return {
    addTab: (tab, position) => dispatch({ type: 'ADD_TAB', tab, position }),
    removeTab: (tabId) => dispatch({ type: 'REMOVE_TAB', tabId }),
    moveTab: (tabId, toIndex) => dispatch({ type: 'MOVE_TAB', tabId, toIndex }),
    setActiveTab: (tabId) => dispatch({ type: 'SET_ACTIVE_TAB', tabId }),
    pinTab: (tabId) => dispatch({ type: 'PIN_TAB', tabId }),
    unpinTab: (tabId) => dispatch({ type: 'UNPIN_TAB', tabId }),
    updateTab: (tabId, patch) => dispatch({ type: 'UPDATE_TAB', tabId, patch }),
    addGroup: (group, position) => dispatch({ type: 'ADD_GROUP', group: withGroupDefaults(group), position }),
    removeGroup: (groupId, opts) => dispatch({ type: 'REMOVE_GROUP', groupId, dissolve: opts?.dissolve }),
    moveGroup: (groupId, toIndex) => dispatch({ type: 'MOVE_GROUP', groupId, toIndex }),
    updateGroup: (groupId, patch) => dispatch({ type: 'UPDATE_GROUP', groupId, patch }),
    collapseGroup: (groupId) => dispatch({ type: 'COLLAPSE_GROUP', groupId }),
    expandGroup: (groupId) => dispatch({ type: 'EXPAND_GROUP', groupId }),
    dissolveGroup: (groupId) => dispatch({ type: 'DISSOLVE_GROUP', groupId }),
    addTabToGroup: (tabId, groupId, index) => dispatch({ type: 'ADD_TAB_TO_GROUP', tabId, groupId, index }),
    removeTabFromGroup: (tabId, stripIndex) => dispatch({ type: 'REMOVE_TAB_FROM_GROUP', tabId, stripIndex }),
    moveTabInGroup: (tabId, groupId, toIndex) => dispatch({ type: 'MOVE_TAB_IN_GROUP', tabId, groupId, toIndex }),
    moveTabToGroup: (tabId, toGroupId, toIndex) => {
      const fromSlot = state.slots.find((s) => s.type === 'group' && s.tabIds.includes(tabId));
      if (fromSlot?.type === 'group') {
        dispatch({ type: 'MOVE_TAB_BETWEEN_GROUPS', tabId, fromGroupId: fromSlot.groupId, toGroupId, toIndex });
      } else {
        dispatch({ type: 'ADD_TAB_TO_GROUP', tabId, groupId: toGroupId, index: toIndex });
      }
    },
    createGroupFromTab: (tabId, group) => dispatch({ type: 'CREATE_GROUP_FROM_TAB', tabId, group: withGroupDefaults(group) }),
    dispatch: dispatch as TabBarActions['dispatch'],
  };
}
