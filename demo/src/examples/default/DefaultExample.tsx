import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  TabBarProvider, useTabStrip, useTab, useTabGroup,
  useGroupTab, useTabPanel, useTabBarContext, useStickyPosition,
} from '@react-tabstack/react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { TabSlot, TabBarState, ContextMenuTarget, MenuItem, TabBarActions, Orientation } from '@react-tabstack/react';
import { EditableLabel, type EditableLabelHandle } from '../shared/EditableLabel.js';
import { TabContextMenu, DotsMenu, type MenuCtx } from '../shared/contextMenu.js';
import { useFocusGroup } from '../shared/useFocusGroup.js';

const stopPD = (e: React.PointerEvent) => e.stopPropagation();

const IconClose = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" /><line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
  </svg>
);
const IconDots = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <circle cx="6" cy="2.5" r="1.1" /><circle cx="6" cy="6" r="1.1" /><circle cx="6" cy="9.5" r="1.1" />
  </svg>
);
const IconEject = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 7V1M2 4l3-3 3 3M1 8.5h8" />
  </svg>
);
const IconChevron = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M1.5 2.5L4 5l2.5-2.5" />
  </svg>
);
const IconArrow = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h4M4 2l2 2-2 2" />
  </svg>
);
const IconFolder = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 3.2h3l1 1.1h5.1v5.5a.7.7 0 0 1-.7.7H2.2a.7.7 0 0 1-.7-.7V3.2Z" />
  </svg>
);
const IconPalette = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6.3" r="4.3" /><circle cx="6" cy="4" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="4" cy="6.5" r="0.6" fill="currentColor" stroke="none" /><circle cx="8" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);
const IconRename = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.2 1.8 10.2 3.8 3.6 10.4 1.2 10.8 1.6 8.4 8.2 1.8Z" />
  </svg>
);
const IconNewGroup = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 3.2h3l1 1.1h5.1v5.5a.7.7 0 0 1-.7.7H2.2a.7.7 0 0 1-.7-.7V3.2Z" /><path d="M6 5.6v2.6M4.7 6.9h2.6" />
  </svg>
);
const IconPlus = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M6 2v8M2 6h8" />
  </svg>
);
const IconLock = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="5.5" width="7" height="5" rx="1" /><path d="M4 5.5V3.8a2 2 0 0 1 4 0v1.7" />
  </svg>
);

const MENU_ICONS: Record<string, React.ReactNode> = {
  close: <IconClose />, eject: <IconEject />, folder: <IconFolder />,
  palette: <IconPalette />, rename: <IconRename />, newGroup: <IconNewGroup />, plus: <IconPlus />,
};

const INITIAL_STATE: TabBarState = {
  tabs: {
    'tab-1': { id: 'tab-1', label: 'Overview',   closable: true },
    'tab-2': { id: 'tab-2', label: 'Components', closable: true },
    'tab-3': { id: 'tab-3', label: 'API Docs',   closable: true },
    'tab-4': { id: 'tab-4', label: 'Examples',   closable: true },
    'tab-5': { id: 'tab-5', label: 'Changelog',  closable: true },
    'tab-6': { id: 'tab-6', label: 'Settings',   closable: true },
    'tab-7': { id: 'tab-7', label: 'Read-only',  closable: true, draggable: false },
  },
  groups: {
    'group-1': { id: 'group-1', label: 'Design', color: '#3fb950' },
    'group-2': { id: 'group-2', label: 'Dev',    color: '#2f81f7', openOn: 'click' },
  },
  slots: [
    { type: 'tab',   tabId: 'tab-6' },
    { type: 'tab',   tabId: 'tab-1' },
    { type: 'tab',   tabId: 'tab-2' },
    { type: 'group', groupId: 'group-1', tabIds: ['tab-3', 'tab-4'] },
    { type: 'group', groupId: 'group-2', tabIds: ['tab-5'] },
    { type: 'tab',   tabId: 'tab-7' },
  ],
  activeTabId: 'tab-1',
};

const GROUP_COLORS = [
  { label: 'Green',  value: '#3fb950' },
  { label: 'Blue',   value: '#2f81f7' },
  { label: 'Purple', value: '#bc8cff' },
  { label: 'Orange', value: '#d29922' },
  { label: 'Red',    value: '#f85149' },
  { label: 'Gray',   value: '#6e7681' },
];

let _tc = 10, _gc = 10;
const newTabId = () => `tab-${++_tc}`;
const newGroupId = () => `group-${++_gc}`;

function buildMenuItems(target: ContextMenuTarget, actions: TabBarActions, state: TabBarState, ctx: MenuCtx): MenuItem[] {
  const groups = Object.values(state.groups);
  const { startRename, focusGroup } = ctx;

  if (target.type === 'tab') {
    const { tabId } = target;
    return [
      { label: 'Rename…', icon: 'rename', action: startRename },
      ...(groups.length > 0 ? [{
        label: 'Move to Group', icon: 'folder',
        submenu: groups.map(g => ({ label: g.label, action: () => { actions.addTabToGroup(tabId, g.id); focusGroup(g.id); } })),
      }] : []),
      { label: 'Move to New Group', icon: 'newGroup', action: () => {
        const id = newGroupId();
        actions.createGroupFromTab(tabId, { id, label: 'New Group', color: '#6e7681' });
        focusGroup(id);
      } },
      { type: 'separator' as const },
      { label: 'Close Tab', icon: 'close', destructive: true, action: () => actions.removeTab(tabId) },
    ];
  }

  if (target.type === 'group-tab') {
    const { tabId, groupId } = target;
    const otherGroups = groups.filter(g => g.id !== groupId);
    return [
      { label: 'Rename…', icon: 'rename', action: startRename },
      { label: 'Eject from Group', icon: 'eject', action: () => actions.removeTabFromGroup(tabId) },
      ...(otherGroups.length > 0 ? [{
        label: 'Move to Group', icon: 'folder',
        submenu: otherGroups.map(g => ({ label: g.label, action: () => { actions.moveTabToGroup(tabId, g.id); focusGroup(g.id); } })),
      }] : []),
      { type: 'separator' as const },
      { label: 'Close Tab', icon: 'close', destructive: true, action: () => actions.removeTab(tabId) },
    ];
  }

  if (target.type === 'group') {
    const { groupId } = target;
    const currentColor = state.groups[groupId]?.color;
    return [
      { label: 'Rename…', icon: 'rename', action: startRename },
      { label: 'Ungroup All', icon: 'eject', action: () => actions.dissolveGroup(groupId) },
      { type: 'separator' as const },
      {
        label: '__swatches__',
        submenu: GROUP_COLORS.map(c => ({
          label: c.value,
          icon: c.value === currentColor ? 'active' : undefined,
          action: () => actions.updateGroup(groupId, { color: c.value }),
        })),
      },
      { type: 'separator' as const },
      { label: 'Close Group', icon: 'close', destructive: true, action: () => actions.removeGroup(groupId) },
    ];
  }

  if (target.type === 'strip') {
    return [
      { label: 'New Tab', icon: 'plus', action: () => { const id = newTabId(); actions.addTab({ id, label: `Tab ${id.split('-')[1]}`, closable: true }); } },
      { label: 'New Group', icon: 'newGroup', action: () => { const id = newGroupId(); actions.addGroup({ id, label: 'New Group', color: GROUP_COLORS[Math.floor(Math.random()*GROUP_COLORS.length)].value }); } },
    ];
  }
  return [];
}

/** This example's "reveal a group" behavior: open its floating dropdown. */
function useDropdownMenuCtx(target: ContextMenuTarget, startRename: () => void): MenuCtx {
  const { dropdown } = useTabBarContext();
  const focusGroup = useFocusGroup(target, (groupId) => dropdown.openImmediate(groupId));
  return { startRename, focusGroup };
}

function TabItem({ tabId }: { tabId: string }) {
  const { state, actions } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close } = useTab(tabId);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
  const target: ContextMenuTarget = { type: 'tab', tabId };
  const ctx = useDropdownMenuCtx(target, startRename);
  if (!tab) return null;
  return (
    <TabContextMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems}>
      <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style}
        className="tab" onClick={activate} title={tab.draggable === false ? `${tab.label} (not draggable)` : tab.label}>
        {tab.draggable === false && <span className="tab-lock-icon"><IconLock /></span>}
        <EditableLabel ref={labelRef} value={tab.label} className="tab-label" onCommit={(v) => actions.updateTab(tabId, { label: v })} />
        <DotsMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems} triggerIcon={<IconDots />} />
        {tab.closable && (
          <button className="tab-close" onPointerDown={stopPD} onClick={e => { e.stopPropagation(); close(); }} aria-label="Close">
            <IconClose />
          </button>
        )}
      </div>
    </TabContextMenu>
  );
}

function GroupTabItem({ tabId, groupId }: { tabId: string; groupId: string }) {
  const { state, actions, dropdown } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close, eject } = useGroupTab(tabId, groupId);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
  const target: ContextMenuTarget = { type: 'group-tab', tabId, groupId };
  const ctx = useDropdownMenuCtx(target, startRename);
  if (!tab) return null;
  return (
    <TabContextMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems}>
      <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style}
        className="group-tab-item" onClick={() => { activate(); dropdown.closeImmediate(); }}>
        <EditableLabel ref={labelRef} value={tab.label} className="group-tab-label" onCommit={(v) => actions.updateTab(tabId, { label: v })} />
        <button className="group-tab-eject" onPointerDown={stopPD} onClick={e => { e.stopPropagation(); eject(); }} title="Eject from group">
          <IconEject />
        </button>
        <DotsMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems} triggerIcon={<IconDots />} />
        {tab.closable && (
          <button className="tab-close" style={{ opacity: 1, position: 'static' }}
            onPointerDown={stopPD} onClick={e => { e.stopPropagation(); close(); }} title="Close">
            <IconClose />
          </button>
        )}
      </div>
    </TabContextMenu>
  );
}

function GroupDropZone({ groupId, tabIds }: { groupId: string; tabIds: string[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-dropdown:${groupId}`, data: { type: 'group-dropdown', groupId } });
  if (tabIds.length === 0) return (
    <div ref={setNodeRef} className="group-empty-drop-zone" data-over={isOver ? '' : undefined}>
      Drop tabs here
    </div>
  );
  return (
    <div ref={setNodeRef} className="group-tabs-list">
      <SortableContext id={`group-dropdown:${groupId}`} items={tabIds} strategy={verticalListSortingStrategy}>
        {tabIds.map(tabId => <GroupTabItem key={tabId} tabId={tabId} groupId={groupId} />)}
      </SortableContext>
    </div>
  );
}

function GroupPill({ groupId }: { groupId: string }) {
  const pillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
  const { orientation, actions } = useTabBarContext();
  const {
    setNodeRef, setDropdownRef, dropdownAttributes, attributes, listeners, style,
    isOpen, isOver, isCombineTarget, tabIds, color, label, toggle, dissolve,
  } = useTabGroup(groupId);

  const rect = useStickyPosition(pillRef, isOpen);
  const pos = rect
    ? orientation === 'vertical'
      // No gap between pill and dropdown (touching, not offset) — a real gap
      // is a hover dead-zone: the pointer briefly hovers neither element while
      // crossing it, the pill's mouseleave schedules a close-dwell, and a
      // deliberate (not-instant) mouse movement toward the dropdown could lose
      // the race and close it before the pointer arrives.
      ? { left: rect.left + rect.width, top: rect.top }
      : { left: rect.left, top: rect.top + rect.height }
    : null;

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    (pillRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  const target: ContextMenuTarget = { type: 'group', groupId };
  const ctx = useDropdownMenuCtx(target, startRename);

  return (
    <TabContextMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems}>
      <div style={{ position: 'relative' }}>
        <div ref={setRefs} {...(attributes as any)} {...(listeners as any)}
          style={{ ...style, '--group-color': color } as React.CSSProperties}
          className="group-pill" data-open={isOpen ? '' : undefined} data-over={isOver ? '' : undefined}
          data-combine-target={isCombineTarget ? '' : undefined}
          onClick={e => { e.stopPropagation(); toggle(); }}>
          <span className="group-dot" />
          <EditableLabel ref={labelRef} value={label} className="group-label" onCommit={(v) => actions.updateGroup(groupId, { label: v })} />
          <span className="group-count">{tabIds.length}</span>
          <DotsMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems} triggerIcon={<IconDots />} />
          <span className="group-chevron"><IconChevron /></span>
        </div>

        {isOpen && pos && createPortal(
          <div ref={setDropdownRef} {...dropdownAttributes} className="group-dropdown" data-side={orientation === 'vertical' ? 'right' : 'bottom'} style={{ left: pos.left, top: pos.top }}>
            <div className="group-dropdown-header">
              <span className="group-dot" style={{ '--group-color': color } as React.CSSProperties} />
              <span className="group-dropdown-title">{label}</span>
              <button className="group-action-btn" onClick={dissolve}>Ungroup all</button>
            </div>
            <GroupDropZone groupId={groupId} tabIds={tabIds} />
          </div>,
          document.body
        )}
      </div>
    </TabContextMenu>
  );
}

function TabStrip() {
  const {
    setNodeRef, attributes, slots, isDraggingOver, sortableIds, sortStrategy, sortableContextId, orientation,
    canScrollBack, canScrollForward, scrollBack, scrollForward,
  } = useTabStrip();
  const { actions } = useTabBarContext();
  const addTab = () => { const id = newTabId(); actions.addTab({ id, label: `Tab ${id.split('-')[1]}`, closable: true }); };
  const stripTarget: ContextMenuTarget = { type: 'strip' };
  const stripCtx = useDropdownMenuCtx(stripTarget, () => {});
  return (
    <TabContextMenu target={stripTarget} ctx={stripCtx} icons={MENU_ICONS} buildMenuItems={buildMenuItems}>
      <div className="tab-strip-wrap" data-orientation={orientation}>
        {canScrollBack && (
          <button className="tab-strip-scroll-btn" data-side="back" onClick={scrollBack} aria-label="Scroll back">
            <IconArrow />
          </button>
        )}
        <div ref={setNodeRef} {...(attributes as any)} className="tab-strip" data-dragging-over={isDraggingOver ? '' : undefined} data-orientation={orientation}>
          <SortableContext id={sortableContextId} items={sortableIds} strategy={sortStrategy}>
            {slots.map((slot: TabSlot) =>
              slot.type === 'tab'
                ? <TabItem key={slot.tabId} tabId={slot.tabId} />
                : <GroupPill key={slot.groupId} groupId={slot.groupId} />
            )}
          </SortableContext>
          <button className="tab tab-new" onClick={addTab} title="New tab (right-click for more)">+</button>
        </div>
        {canScrollForward && (
          <button className="tab-strip-scroll-btn" data-side="forward" onClick={scrollForward} aria-label="Scroll forward">
            <IconArrow />
          </button>
        )}
      </div>
    </TabContextMenu>
  );
}

function TabPanelItem({ tabId }: { tabId: string }) {
  const { state } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { attributes } = useTabPanel(tabId);
  return (
    <div {...(attributes as any)} className="tab-panel">
      <h2 className="tab-panel-title">{tab?.label}</h2>
      <p className="tab-panel-body">
        Content for <strong>{tab?.label}</strong>. Drag to reorder · drag into a group ·
        right-click or click ⋮ for options.
        {tab?.draggable === false && <span style={{ color: 'var(--c-muted)', marginLeft: 8 }}>· Not draggable</span>}
      </p>
      <pre className="tab-panel-code">{JSON.stringify({ id: tabId, draggable: tab?.draggable ?? true }, null, 2)}</pre>
    </div>
  );
}

function TabPanels() {
  const { state } = useTabBarContext();
  return (
    <div className="tab-panel-area">
      {Object.keys(state.tabs).map(tabId => <TabPanelItem key={tabId} tabId={tabId} />)}
    </div>
  );
}

function StateInspector() {
  const { state } = useTabBarContext();
  const [open, setOpen] = useState(false);
  const summary = state.slots.map((s: TabSlot) =>
    s.type === 'tab'
      ? `tab: ${state.tabs[s.tabId]?.label ?? s.tabId}`
      : `group "${state.groups[s.groupId]?.label}" [${s.tabIds.map(id => state.tabs[id]?.label ?? id).join(', ')}]`
  ).join('\n');
  return (
    <div className="state-inspector">
      <div className="state-inspector-header" onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
        <span className="state-inspector-dot" />State Inspector
        <span style={{ marginLeft: 'auto', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="state-inspector-body">
          {'active: '}{state.activeTabId ? (state.tabs[state.activeTabId]?.label ?? state.activeTabId) : 'none'}{'\n\n'}
          {'slots:\n'}{summary}
        </div>
      )}
    </div>
  );
}

function DemoToolbar({ hint }: { hint: string }) {
  const { actions } = useTabBarContext();
  const addTab = () => { const id = newTabId(); actions.addTab({ id, label: `Tab ${id.split('-')[1]}`, closable: true }); };
  const addGroup = () => { const id = newGroupId(); actions.addGroup({ id, label: 'New Group', color: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)].value }); };
  return (
    <div className="demo-controls">
      <button className="btn primary" onClick={addTab}>+ New Tab</button>
      <button className="btn" onClick={addGroup}>⊞ New Group</button>
      <span className="btn-sep" />
      <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>{hint}</span>
    </div>
  );
}

function DemoDragOverlay({ activeId, data, state }: { activeId: string; data: Record<string, unknown>; state: TabBarState }) {
  const isGroup = data.type === 'group';
  const tabId = (data.tabId ?? activeId) as string;
  const groupId = data.groupId as string | undefined;
  const tab = state.tabs[tabId];
  const group = groupId ? state.groups[groupId] : undefined;
  const label = tab?.label ?? group?.label ?? activeId;

  if (isGroup) {
    return (
      <div className="group-pill drag-ghost" style={{ '--group-color': group?.color } as React.CSSProperties}>
        <span className="group-dot" />
        <span className="group-label">{label}</span>
      </div>
    );
  }
  return (
    <div className="tab drag-ghost" data-active={state.activeTabId === tabId ? '' : undefined}>
      <span className="tab-label">{label}</span>
    </div>
  );
}

export default function DefaultExample({
  orientation = 'horizontal',
  initialState = INITIAL_STATE,
  hint = 'Right-click or click ⋮ on any tab · Drag to sort · Drag into groups · double-click a label to rename',
}: {
  orientation?: Orientation;
  initialState?: TabBarState;
  hint?: string;
}) {
  const [state, setState] = useState<TabBarState>(initialState);
  return (
    <TabBarProvider
      state={state}
      onStateChange={setState}
      orientation={orientation}
      groupOpenOn="hover+click"
      dissolveEmptyGroups={false}
      renderDragOverlay={(id, data) => <DemoDragOverlay activeId={id} data={data} state={state} />}
    >
      <DemoToolbar hint={hint} />
      <div className={`demo-content-row demo-content-row--${orientation}`}>
        <div className={`demo-section demo-strip-section demo-strip-section--${orientation}`}>
          <TabStrip />
        </div>
        <div className="demo-content-main">
          <TabPanels />
          <StateInspector />
        </div>
      </div>
    </TabBarProvider>
  );
}
