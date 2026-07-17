import React, { useState } from 'react';
import {
  TabBarProvider, useTabStrip, useTab, useTabGroup, useGroupTab,
  useTabPanel, useTabBarContext,
} from '@react-tabstack/react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { TabSlot, TabBarState } from '@react-tabstack/react';
import './inline-groups.css';

// ─────────────────────────────────────────────────────────────────────────────
// Chrome actually expands a tab group's members inline, in the strip itself —
// no popover. That's a different *presentation* of the exact same headless
// hooks used by the "Tab groups" example (which shows a dropdown instead):
// useTabGroup still owns the group's own sortable/droppable registration and
// useGroupTab still owns each member tab's — this example just renders that
// same state differently, with an ordinary nested <SortableContext> instead
// of a portal. Nothing in packages/core or packages/react is example-specific.
// ─────────────────────────────────────────────────────────────────────────────

const stopPD = (e: React.PointerEvent) => e.stopPropagation();

const IconClose = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" /><line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
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

const GROUP_COLORS = ['#3fb950', '#2f81f7', '#bc8cff', '#d29922', '#f85149'];

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
    'ig-g1': { id: 'ig-g1', label: 'Docs', color: GROUP_COLORS[1], collapsed: false },
    'ig-g2': { id: 'ig-g2', label: 'Meta', color: GROUP_COLORS[3], collapsed: true },
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

function InlineTab({ tabId }: { tabId: string }) {
  const { state } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close } = useTab(tabId);
  if (!tab) return null;
  return (
    <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style} className="ig-tab" onClick={activate}>
      <span className="ig-tab-label">{tab.label}</span>
      {tab.closable && (
        <button className="ig-close" onPointerDown={stopPD} onClick={e => { e.stopPropagation(); close(); }} aria-label="Close">
          <IconClose />
        </button>
      )}
    </div>
  );
}

function InlineGroupMember({ tabId, groupId }: { tabId: string; groupId: string }) {
  const { state } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close } = useGroupTab(tabId, groupId);
  if (!tab) return null;
  return (
    <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style} className="ig-tab ig-tab-grouped" onClick={activate}>
      <span className="ig-tab-label">{tab.label}</span>
      {tab.closable && (
        <button className="ig-close" onPointerDown={stopPD} onClick={e => { e.stopPropagation(); close(); }} aria-label="Close">
          <IconClose />
        </button>
      )}
    </div>
  );
}

function InlineGroup({ groupId, tabIds }: { groupId: string; tabIds: string[] }) {
  const { state, actions } = useTabBarContext();
  const group = state.groups[groupId];
  const {
    setNodeRef, attributes, listeners, style, isDragging, isOver, isCombineTarget, color, label,
  } = useTabGroup(groupId);

  // The "inside this group" container — matched by collision detection via
  // data.type: 'group-dropdown', the same contract the dropdown-style example
  // uses, so the exact same drag logic resolves precise in-group placement
  // here with no id-naming coupling to worry about.
  const { setNodeRef: setInlineRef } = useDroppable({
    id: `group-inline:${groupId}`,
    data: { type: 'group-dropdown', groupId },
  });

  if (!group) return null;
  const collapsed = !!group.collapsed;
  const toggle = () => (collapsed ? actions.expandGroup(groupId) : actions.collapseGroup(groupId));

  return (
    <div
      className="ig-group"
      data-collapsed={collapsed ? '' : undefined}
      data-over={isOver ? '' : undefined}
      data-combine-target={isCombineTarget ? '' : undefined}
      style={{ '--group-color': color } as React.CSSProperties}
    >
      <div
        ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style}
        className="ig-group-head" data-dragging={isDragging ? '' : undefined}
        onClick={e => { e.stopPropagation(); toggle(); }}
      >
        <span className="ig-group-dot" />
        <span className="ig-group-label">{label}</span>
        {collapsed && <span className="ig-group-count">{tabIds.length}</span>}
        <span className="ig-group-chevron" data-collapsed={collapsed ? '' : undefined}><IconChevron /></span>
      </div>

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
  return (
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
        <button className="ig-new-tab" onClick={addTab} title="New tab">+</button>
      </div>
      {canScrollForward && (
        <button className="ig-scroll-btn" data-side="forward" onClick={scrollForward} aria-label="Scroll forward"><IconArrow /></button>
      )}
    </div>
  );
}

function InlinePanelItem({ tabId }: { tabId: string }) {
  const { state } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { attributes } = useTabPanel(tabId);
  return (
    <div {...(attributes as any)} className="ig-panel">
      <h2 className="ig-panel-title">{tab?.label}</h2>
      <p className="ig-panel-body">Content for <strong>{tab?.label}</strong>.</p>
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
    actions.addGroup({ id, label: 'New Group', color: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)], collapsed: false });
  };
  return (
    <div className="ig-toolbar">
      <button className="ig-btn ig-btn-primary" onClick={addTab}>+ New Tab</button>
      <button className="ig-btn" onClick={addGroup}>⊞ New Group</button>
      <span className="ig-hint">Drag tabs in/out/between groups · click a group's label to collapse/expand</span>
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
