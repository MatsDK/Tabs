import React, { useState, useCallback, useMemo, useRef } from 'react';
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
import type { DragEndEvent, DragOverEvent, DragStartEvent, SensorDescriptor } from '@dnd-kit/core';
import { tabbedCollisionDetection } from '../collision/tabbedCollisionDetection.js';
import { TabBarContext } from '../context.js';
import { tabBarReducer } from '@react-tabstack/core';
import type {
  TabBarState,
  TabBarActions,
  GroupDropState,
  DndResolveEvent,
  TabBarProviderProps,
} from '@react-tabstack/core';

// ─────────────────────────────────────────────────────────────────────────────
// TabBarProvider — root orchestration component
//
// Wraps dnd-kit's DndContext and provides TabBarContext to the tree.
// Users pass state + onStateChange (controlled model, like <input>).
// ─────────────────────────────────────────────────────────────────────────────

interface TabBarProviderInternalProps extends TabBarProviderProps {
  actions: TabBarActions;
}

function TabBarProviderInternal({
  state,
  onStateChange,
  actions,
  groupHoverDelay = 600,
  groupOpenOn = 'hover+click',
  onGroupEmpty,
  onDragEscape,
  contextMenu,
  sensors: sensorsProp,
  collisionDetection: collisionDetectionProp,
  children,
  renderDragOverlay,
}: TabBarProviderInternalProps & {
  sensors?: SensorDescriptor<any>[];
  collisionDetection?: typeof tabbedCollisionDetection;
  renderDragOverlay?: (activeId: string, data: Record<string, unknown>) => React.ReactNode;
}) {
  const [dragDropState, setDragDropState] = useState<GroupDropState>({
    openGroupId: null,
    hoveringGroupId: null,
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeData, setActiveData] = useState<Record<string, unknown> | null>(null);
  const stripRef = useRef<HTMLElement | null>(null);

  // ── Sensors ────────────────────────────────────────────────────────────────
  const defaultSensors = useSensors(
    useSensor(PointerSensor, {
      // 5px threshold prevents accidental drags on click
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  const sensors = sensorsProp ?? defaultSensors;

  // ── Drag event handlers ────────────────────────────────────────────────────

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setActiveData((active.data.current as Record<string, unknown>) ?? null);
  }, []);

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      if (!over) return;
      const overId = String(over.id);

      // Track which group pill is being hovered (for dwell timer coordination)
      if (overId.startsWith('group-pill:')) {
        const groupId = overId.replace('group-pill:', '');
        setDragDropState((prev) => ({
          ...prev,
          hoveringGroupId: groupId,
        }));
      } else {
        setDragDropState((prev) => ({
          ...prev,
          hoveringGroupId: null,
        }));
      }
    },
    []
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      // Reset drag state
      setActiveId(null);
      setActiveData(null);
      setDragDropState({ openGroupId: null, hoveringGroupId: null });

      if (!over) {
        // Dragged outside — fire escape callback if configured
        const data = active.data.current as Record<string, unknown> | undefined;
        if (data?.type === 'tab' || data?.type === 'group-tab') {
          onDragEscape?.(String(active.id), actions);
        }
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);
      const activeData = (active.data.current ?? {}) as Record<string, unknown>;
      const overData = (over.data.current ?? {}) as Record<string, unknown>;

      if (activeId === overId) return;

      let event: DndResolveEvent | null = null;

      // ── Drop into group pill (immediate drop without dwell) ──────────────
      if (overId.startsWith('group-pill:') && activeData.type === 'tab') {
        const groupId = overId.replace('group-pill:', '');
        event = {
          kind: 'DROP_INTO_GROUP',
          tabId: activeData.tabId as string,
          groupId,
          index: 0,
        };
      }

      // ── Drop into open group dropdown ─────────────────────────────────────
      else if (overId.startsWith('group-dropdown:') && activeData.type === 'group-tab') {
        const groupId = overId.replace('group-dropdown:', '');
        const fromGroupId = activeData.groupId as string;
        if (fromGroupId === groupId) {
          // Sort within same group
          event = {
            kind: 'SORT_GROUP_TABS',
            tabId: activeData.tabId as string,
            groupId,
            toIndex: overData.index as number ?? 0,
          };
        } else {
          event = {
            kind: 'MOVE_BETWEEN_GROUPS',
            tabId: activeData.tabId as string,
            fromGroupId,
            toGroupId: groupId,
            index: overData.index as number ?? 0,
          };
        }
      }

      // ── Eject from group to strip ─────────────────────────────────────────
      else if (activeData.type === 'group-tab' && overData.type !== 'group-tab') {
        const stripIdx = state.slots.findIndex(
          (s) => (s.type === 'tab' && s.tabId === overId) || (s.type === 'group' && s.groupId === overId)
        );
        event = {
          kind: 'EJECT_FROM_GROUP',
          tabId: activeData.tabId as string,
          groupId: activeData.groupId as string,
          stripIndex: Math.max(0, stripIdx),
        };
      }

      // ── Sort strip (tab or group) ─────────────────────────────────────────
      else if (
        (activeData.type === 'tab' || activeData.type === 'group') &&
        (overData.type === 'tab' || overData.type === 'group' || overId === 'strip')
      ) {
        const resolvedOverId =
          overId === 'strip'
            ? state.slots[state.slots.length - 1]?.type === 'tab'
              ? (state.slots[state.slots.length - 1] as { tabId: string }).tabId
              : (state.slots[state.slots.length - 1] as { groupId: string }).groupId
            : overId;

        if (resolvedOverId) {
          event = {
            kind: 'SORT_STRIP',
            activeId: activeData.type === 'tab' ? (activeData.tabId as string) : (activeData.groupId as string),
            overId: resolvedOverId,
          };
        }
      }

      if (event) {
        const nextState = tabBarReducer(state, { type: 'DND_RESOLVE', dragEvent: event });
        onStateChange(nextState);

        // Check for empty group after drop
        if (event.kind === 'DROP_INTO_GROUP' || event.kind === 'EJECT_FROM_GROUP' || event.kind === 'MOVE_BETWEEN_GROUPS') {
          const fromGroupId =
            event.kind === 'EJECT_FROM_GROUP' ? event.groupId
            : event.kind === 'MOVE_BETWEEN_GROUPS' ? event.fromGroupId
            : null;

          if (fromGroupId && onGroupEmpty) {
            const slot = nextState.slots.find(
              (s) => s.type === 'group' && s.groupId === fromGroupId
            );
            if (slot?.type === 'group' && slot.tabIds.length === 0) {
              onGroupEmpty(fromGroupId, actions);
            }
          }
        }
      }
    },
    [state, onStateChange, actions, onDragEscape, onGroupEmpty]
  );

  // ── Context value ──────────────────────────────────────────────────────────
  const contextValue = useMemo(
    () => ({
      state,
      actions,
      dragDropState,
      setDragDropState,
      groupHoverDelay,
      groupOpenOn,
      contextMenu,
    }),
    [state, actions, dragDropState, groupHoverDelay, groupOpenOn, contextMenu]
  );

  return (
    <TabBarContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionProp ?? tabbedCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {children as React.ReactNode}
        <DragOverlay>
          {activeId && activeData
            ? renderDragOverlay
              ? renderDragOverlay(activeId, activeData)
              : <DefaultDragOverlay activeId={activeId} activeData={activeData} state={state} />
            : null}
        </DragOverlay>
      </DndContext>
    </TabBarContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default drag overlay — renders a simple clone of the tab label
// ─────────────────────────────────────────────────────────────────────────────

function DefaultDragOverlay({
  activeId,
  activeData,
  state,
}: {
  activeId: string;
  activeData: Record<string, unknown>;
  state: TabBarState;
}) {
  const tabId = (activeData.tabId ?? activeId) as string;
  const groupId = activeData.groupId as string | undefined;
  const tab = state.tabs[tabId];
  const group = groupId ? state.groups[groupId] : undefined;

  return (
    <div
      style={{
        background: 'var(--ts-overlay-bg, #23272f)',
        color: 'var(--ts-overlay-color, #e6edf3)',
        border: '1px solid var(--ts-overlay-border, #30363d)',
        borderRadius: '6px',
        padding: '4px 12px',
        fontSize: '13px',
        fontWeight: 500,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        cursor: 'grabbing',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {group && (
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: group.color ?? 'var(--ts-group-default-color, #6e7681)',
            flexShrink: 0,
          }}
        />
      )}
      {tab?.label ?? group?.label ?? activeId}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public TabBarProvider — accepts controlled state + actions from useTabState
// ─────────────────────────────────────────────────────────────────────────────

export type { TabBarProviderProps };

export function TabBarProvider({
  state,
  onStateChange,
  children,
  ...rest
}: TabBarProviderProps & {
  sensors?: SensorDescriptor<any>[];
  collisionDetection?: typeof tabbedCollisionDetection;
  renderDragOverlay?: (activeId: string, data: Record<string, unknown>) => React.ReactNode;
}) {
  // Build the actions object bound to onStateChange
  // In the controlled model, actions dispatch to the reducer and call onStateChange
  const actions = useMemo(
    () => buildActions(state, onStateChange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, onStateChange]
  );

  return (
    <TabBarProviderInternal
      state={state}
      onStateChange={onStateChange}
      actions={actions}
      {...rest}
    >
      {children}
    </TabBarProviderInternal>
  );
}

/** Build TabBarActions bound to a controlled onStateChange */
function buildActions(
  state: TabBarState,
  onStateChange: (s: TabBarState) => void
): TabBarActions {
  const dispatch = (action: Parameters<typeof tabBarReducer>[1]) => {
    onStateChange(tabBarReducer(state, action));
  };

  return {
    addTab: (tab, position) => dispatch({ type: 'ADD_TAB', tab, position }),
    removeTab: (tabId) => dispatch({ type: 'REMOVE_TAB', tabId }),
    moveTab: (tabId, toIndex) => dispatch({ type: 'MOVE_TAB', tabId, toIndex }),
    setActiveTab: (tabId) => dispatch({ type: 'SET_ACTIVE_TAB', tabId }),
    pinTab: (tabId) => dispatch({ type: 'PIN_TAB', tabId }),
    unpinTab: (tabId) => dispatch({ type: 'UNPIN_TAB', tabId }),
    updateTab: (tabId, patch) => dispatch({ type: 'UPDATE_TAB', tabId, patch }),
    addGroup: (group, position) => dispatch({ type: 'ADD_GROUP', group, position }),
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
    createGroupFromTab: (tabId, group) => dispatch({ type: 'CREATE_GROUP_FROM_TAB', tabId, group }),
    dispatch: dispatch as TabBarActions['dispatch'],
  };
}
