import React, { useCallback, useRef, useState } from 'react';
import {
  TabBarProvider, useTabStrip, useTab, useTabGroup, useGroupTab,
  useTabPanel, useTabBarContext,
} from '@react-tabstack/react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { TabSlot, TabBarState, ContextMenuTarget, MenuItem, TabBarActions } from '@react-tabstack/react';
import { EditableLabel, type EditableLabelHandle } from '../shared/EditableLabel.js';
import { TabContextMenu, DotsMenu, type MenuCtx } from '../shared/contextMenu.js';
import { useFocusGroup } from '../shared/useFocusGroup.js';
import './inline-groups.css';

// ─────────────────────────────────────────────────────────────────────────────
// Chrome actually expands a tab group's members inline, in the strip itself —
// no popover. That's a different *presentation* of the exact same headless
// hooks used by the "Tab groups" example (which shows a dropdown instead):
// useTabGroup still owns the group's own sortable/droppable registration and
// useGroupTab still owns each member tab's — this example just renders that
// same state differently, with an ordinary nested <SortableContext> instead
// of a portal, and group.collapsed/collapseGroup/expandGroup driving a
// persistent toggle instead of the hover-dwell dropdown coordinator.
// Context menus and rename reuse the exact same shared/contextMenu.tsx and
// shared/EditableLabel.tsx as the "Tab groups" example — only buildMenuItems
// (the menu *contents*) and the "reveal a group" strategy are local to this
// example; everything else is configuration passed into shared components.
// ─────────────────────────────────────────────────────────────────────────────

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

const MENU_ICONS: Record<string, React.ReactNode> = {
  close: <IconClose />, eject: <IconEject />, folder: <IconFolder />,
  rename: <IconRename />, newGroup: <IconNewGroup />, plus: <IconPlus />,
};

const GROUP_COLORS = [
  { label: 'Green',  value: '#3fb950' },
  { label: 'Blue',   value: '#2f81f7' },
  { label: 'Purple', value: '#bc8cff' },
  { label: 'Orange', value: '#d29922' },
  { label: 'Red',    value: '#f85149' },
];

const INITIAL_STATE: TabBarState = {
  tabs: {
    'ig-1': { id: 'ig-1', label: 'Overview', closable: true },
    'ig-2': { id: 'ig-2', label: 'Components', closable: true },
    'ig-3': { id: 'ig-3', label: 'API Docs', closable: true },
    'ig-4': { id: 'ig-4', label: 'Examples', closable: true },
    'ig-5': { id: 'ig-5', label: 'Changelog', closable: true },
    'ig-6': { id: 'ig-6', label: 'Settings', closable: true },
  },
  groups: {
    'ig-g1': { id: 'ig-g1', label: 'Docs', color: GROUP_COLORS[1].value, collapsed: false },
    'ig-g2': { id: 'ig-g2', label: 'Meta', color: GROUP_COLORS[3].value, collapsed: true },
  },
  slots: [
    { type: 'tab', tabId: 'ig-1' },
    { type: 'group', groupId: 'ig-g1', tabIds: ['ig-2', 'ig-3'] },
    { type: 'tab', tabId: 'ig-4' },
    { type: 'group', groupId: 'ig-g2', tabIds: ['ig-5'] },
    { type: 'tab', tabId: 'ig-6' },
  ],
  activeTabId: 'ig-1',
};

let _tc = 10, _gc = 10;
const newTabId = () => `ig-${++_tc}`;
const newGroupId = () => `ig-g${++_gc}`;

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
        actions.createGroupFromTab(tabId, { id, label: 'New Group', color: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)].value });
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
      { label: 'New Group', icon: 'newGroup', action: () => { const id = newGroupId(); actions.addGroup({ id, label: 'New Group', color: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)].value, collapsed: false }); } },
    ];
  }
  return [];
}

/** This example's "reveal a group" behavior: expand it inline (persistent, not hover-driven). */
function useInlineMenuCtx(target: ContextMenuTarget, startRename: () => void): MenuCtx {
  const { actions } = useTabBarContext();
  const focusGroup = useFocusGroup(target, (groupId) => actions.expandGroup(groupId));
  return { startRename, focusGroup };
}

function InlineTab({ tabId }: { tabId: string }) {
  const { state, actions } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close } = useTab(tabId);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
  const target: ContextMenuTarget = { type: 'tab', tabId };
  const ctx = useInlineMenuCtx(target, startRename);
  if (!tab) return null;
  return (
    <TabContextMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems}>
      <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style} className="ig-tab" onClick={activate}>
        <EditableLabel ref={labelRef} value={tab.label} className="ig-tab-label" onCommit={(v) => actions.updateTab(tabId, { label: v })} />
        <DotsMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems} triggerIcon={<IconDots />} triggerClassName="ig-dots" />
        {tab.closable && (
          <button className="ig-close" onPointerDown={stopPD} onClick={e => { e.stopPropagation(); close(); }} aria-label="Close">
            <IconClose />
          </button>
        )}
      </div>
    </TabContextMenu>
  );
}

function InlineGroupMember({ tabId, groupId }: { tabId: string; groupId: string }) {
  const { state, actions } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close, eject } = useGroupTab(tabId, groupId);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
  const target: ContextMenuTarget = { type: 'group-tab', tabId, groupId };
  const ctx = useInlineMenuCtx(target, startRename);
  if (!tab) return null;
  return (
    <TabContextMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems}>
      <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style} className="ig-tab ig-tab-grouped" onClick={activate}>
        <EditableLabel ref={labelRef} value={tab.label} className="ig-tab-label" onCommit={(v) => actions.updateTab(tabId, { label: v })} />
        <button className="ig-eject" onPointerDown={stopPD} onClick={e => { e.stopPropagation(); eject(); }} title="Eject from group">
          <IconEject />
        </button>
        <DotsMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems} triggerIcon={<IconDots />} triggerClassName="ig-dots" />
        {tab.closable && (
          <button className="ig-close" onPointerDown={stopPD} onClick={e => { e.stopPropagation(); close(); }} aria-label="Close">
            <IconClose />
          </button>
        )}
      </div>
    </TabContextMenu>
  );
}

function InlineGroup({ groupId, tabIds }: { groupId: string; tabIds: string[] }) {
  const { state, actions } = useTabBarContext();
  const {
    setNodeRef, attributes, listeners, style, isDragging, isOver, isCombineTarget, collapsed, color, label,
  } = useTabGroup(groupId);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
  const target: ContextMenuTarget = { type: 'group', groupId };
  const ctx = useInlineMenuCtx(target, startRename);

  // The "inside this group" container — matched by collision detection via
  // data.type: 'group-dropdown', the same contract the dropdown-style example
  // uses, so the exact same drag logic resolves precise in-group placement
  // here with no id-naming coupling to worry about.
  const { setNodeRef: setInlineRef } = useDroppable({
    id: `group-inline:${groupId}`,
    data: { type: 'group-dropdown', groupId },
  });

  if (!state.groups[groupId]) return null;
  const toggle = () => (collapsed ? actions.expandGroup(groupId) : actions.collapseGroup(groupId));

  return (
    // setNodeRef/style (dnd-kit's transform) live on THIS wrapper, not just
    // the head chip below — this div is the group's full visual footprint
    // (head + members + the color-bar border), and it's what the top-level
    // strip actually reflows around during a drag. Registering the sortable
    // node on the head chip alone measured and moved only that small chip,
    // leaving the members row (and the color bar drawn on this wrapper)
    // visually behind — the bar "not moving" during a drag was exactly that:
    // the transformed node and the visible group footprint were two
    // different elements. Drag *activation* (listeners) stays scoped to the
    // head chip only, so grabbing a member tab still starts a tab drag, not
    // a group drag.
    <div
      ref={setNodeRef} style={{ ...style, '--group-color': color } as React.CSSProperties}
      className="ig-group"
      data-collapsed={collapsed ? '' : undefined}
      data-over={isOver ? '' : undefined}
      data-combine-target={isCombineTarget ? '' : undefined}
      data-dragging={isDragging ? '' : undefined}
    >
      <TabContextMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems}>
        <div
          {...(attributes as any)} {...(listeners as any)}
          className="ig-group-head"
          onClick={e => { e.stopPropagation(); toggle(); }}
        >
          <span className="ig-group-dot" />
          <EditableLabel ref={labelRef} value={label} className="ig-group-label" onCommit={(v) => actions.updateGroup(groupId, { label: v })} />
          {collapsed && <span className="ig-group-count">{tabIds.length}</span>}
          <DotsMenu target={target} ctx={ctx} icons={MENU_ICONS} buildMenuItems={buildMenuItems} triggerIcon={<IconDots />} triggerClassName="ig-dots ig-dots-on-head" />
          <span className="ig-group-chevron" data-collapsed={collapsed ? '' : undefined}><IconChevron /></span>
        </div>
      </TabContextMenu>

      {!collapsed && (
        <div ref={setInlineRef} className="ig-group-members">
          {tabIds.length === 0 ? (
            <div className="ig-empty-drop">Drop tabs here</div>
          ) : (
            <SortableContext id={`group-inline:${groupId}`} items={tabIds} strategy={horizontalListSortingStrategy}>
              {tabIds.map(tabId => <InlineGroupMember key={tabId} tabId={tabId} groupId={groupId} />)}
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}

function InlineStrip() {
  const {
    setNodeRef, attributes, slots, sortableIds, sortStrategy, sortableContextId,
    canScrollBack, canScrollForward, scrollBack, scrollForward,
  } = useTabStrip();
  const { actions } = useTabBarContext();
  const addTab = () => { const id = newTabId(); actions.addTab({ id, label: `Tab ${id.split('-')[1]}`, closable: true }); };
  const stripTarget: ContextMenuTarget = { type: 'strip' };
  const stripCtx = useInlineMenuCtx(stripTarget, () => {});
  return (
    <TabContextMenu target={stripTarget} ctx={stripCtx} icons={MENU_ICONS} buildMenuItems={buildMenuItems}>
      <div className="ig-strip-wrap">
        {canScrollBack && (
          <button className="ig-scroll-btn" data-side="back" onClick={scrollBack} aria-label="Scroll back"><IconArrow /></button>
        )}
        <div ref={setNodeRef} {...(attributes as any)} className="ig-strip">
          <SortableContext id={sortableContextId} items={sortableIds} strategy={sortStrategy}>
            {slots.map((slot: TabSlot) =>
              slot.type === 'tab'
                ? <InlineTab key={slot.tabId} tabId={slot.tabId} />
                : <InlineGroup key={slot.groupId} groupId={slot.groupId} tabIds={slot.tabIds} />
            )}
          </SortableContext>
          <button className="ig-new-tab" onClick={addTab} title="New tab (right-click for more)">+</button>
        </div>
        {canScrollForward && (
          <button className="ig-scroll-btn" data-side="forward" onClick={scrollForward} aria-label="Scroll forward"><IconArrow /></button>
        )}
      </div>
    </TabContextMenu>
  );
}

function InlinePanelItem({ tabId }: { tabId: string }) {
  const { state } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { attributes } = useTabPanel(tabId);
  return (
    <div {...(attributes as any)} className="ig-panel">
      <h2 className="ig-panel-title">{tab?.label}</h2>
      <p className="ig-panel-body">Content for <strong>{tab?.label}</strong>. Right-click or click ⋮ for options.</p>
    </div>
  );
}

function InlinePanels() {
  const { state } = useTabBarContext();
  return <>{Object.keys(state.tabs).map(id => <InlinePanelItem key={id} tabId={id} />)}</>;
}

function InlineToolbar() {
  const { actions } = useTabBarContext();
  const addTab = () => { const id = newTabId(); actions.addTab({ id, label: `Tab ${id.split('-')[1]}`, closable: true }); };
  const addGroup = () => {
    const id = newGroupId();
    actions.addGroup({ id, label: 'New Group', color: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)].value, collapsed: false });
  };
  return (
    <div className="ig-toolbar">
      <button className="ig-btn ig-btn-primary" onClick={addTab}>+ New Tab</button>
      <button className="ig-btn" onClick={addGroup}>⊞ New Group</button>
      <span className="ig-hint">Drag tabs in/out/between groups · click a group's label to collapse/expand · right-click or ⋮ for options</span>
    </div>
  );
}

export default function InlineGroupsExample() {
  const [state, setState] = useState<TabBarState>(INITIAL_STATE);
  return (
    <TabBarProvider state={state} onStateChange={setState} orientation="horizontal">
      <InlineToolbar />
      <InlineStrip />
      <InlinePanels />
    </TabBarProvider>
  );
}
