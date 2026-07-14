import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  TabBarProvider, useTabStrip, useTab, useTabGroup,
  useGroupTab, useTabPanel, useTabBarContext,
} from '@react-tabstack/react';
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { TabSlot, TabBarState, ContextMenuTarget, MenuItem, TabBarActions } from '@react-tabstack/react';

// ── Icons ─────────────────────────────────────────────────────────────────────

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

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: TabBarState = {
  tabs: {
    'tab-1': { id: 'tab-1', label: 'Overview',   closable: true },
    'tab-2': { id: 'tab-2', label: 'Components', closable: true },
    'tab-3': { id: 'tab-3', label: 'API Docs',   closable: true },
    'tab-4': { id: 'tab-4', label: 'Examples',   closable: true },
    'tab-5': { id: 'tab-5', label: 'Changelog',  closable: true },
    'tab-6': { id: 'tab-6', label: 'Settings',   closable: true, pinned: true },
  },
  groups: {
    'group-1': { id: 'group-1', label: 'Design', color: '#3fb950' },
    'group-2': { id: 'group-2', label: 'Dev',    color: '#2f81f7' },
  },
  slots: [
    { type: 'tab',   tabId: 'tab-6' },
    { type: 'tab',   tabId: 'tab-1' },
    { type: 'tab',   tabId: 'tab-2' },
    { type: 'group', groupId: 'group-1', tabIds: ['tab-3', 'tab-4'] },
    { type: 'group', groupId: 'group-2', tabIds: ['tab-5'] },
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

// ── Menu items builder ────────────────────────────────────────────────────────

function buildMenuItems(target: ContextMenuTarget, actions: TabBarActions, state: TabBarState): MenuItem[] {
  const groups = Object.values(state.groups);

  if (target.type === 'tab') {
    const { tabId } = target;
    const tab = state.tabs[tabId];
    const inGroup = state.slots.some(s => s.type === 'group' && s.tabIds.includes(tabId));
    return [
      { label: tab?.pinned ? 'Unpin Tab' : 'Pin Tab', action: () => tab?.pinned ? actions.unpinTab(tabId) : actions.pinTab(tabId) },
      { type: 'separator' as const },
      ...(groups.length > 0 ? [{
        label: 'Move to Group',
        submenu: groups.map(g => ({ label: g.label, action: () => actions.addTabToGroup(tabId, g.id) })),
      }] : []),
      { label: 'Move to New Group', action: () => actions.createGroupFromTab(tabId, { id: newGroupId(), label: 'New Group', color: '#6e7681' }) },
      { type: 'separator' as const },
      { label: 'Close Tab', action: () => actions.removeTab(tabId) },
    ];
  }

  if (target.type === 'group-tab') {
    const { tabId, groupId } = target;
    const otherGroups = groups.filter(g => g.id !== groupId);
    return [
      { label: 'Eject from Group', action: () => actions.removeTabFromGroup(tabId) },
      ...(otherGroups.length > 0 ? [{
        label: 'Move to Group',
        submenu: otherGroups.map(g => ({ label: g.label, action: () => actions.moveTabToGroup(tabId, g.id) })),
      }] : []),
      { type: 'separator' as const },
      { label: 'Close Tab', action: () => actions.removeTab(tabId) },
    ];
  }

  if (target.type === 'group') {
    const { groupId } = target;
    return [
      { label: 'Rename…', action: () => { const n = prompt('New name:'); if (n) actions.updateGroup(groupId, { label: n }); } },
      { label: 'Ungroup All', action: () => actions.dissolveGroup(groupId) },
      { type: 'separator' as const },
      { label: 'Color', submenu: GROUP_COLORS.map(c => ({ label: c.label, action: () => actions.updateGroup(groupId, { color: c.value }) })) },
      { type: 'separator' as const },
      { label: 'Close Group', action: () => actions.removeGroup(groupId) },
    ];
  }

  if (target.type === 'strip') {
    return [
      { label: 'New Tab', action: () => { const id = newTabId(); actions.addTab({ id, label: `Tab ${id.split('-')[1]}`, closable: true }); } },
      { label: 'New Group', action: () => { const id = newGroupId(); actions.addGroup({ id, label: 'New Group', color: GROUP_COLORS[Math.floor(Math.random()*GROUP_COLORS.length)].value }); } },
    ];
  }
  return [];
}

// ── Shared menu renderer helpers ──────────────────────────────────────────────

function CxItem({ item, actions }: { item: MenuItem; actions: TabBarActions }) {
  if (item.type === 'separator') return <ContextMenu.Separator className="ctx-sep" />;
  if ('submenu' in item && item.submenu?.length) return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger className="ctx-item">{item.label}<span className="ctx-arrow"><IconArrow /></span></ContextMenu.SubTrigger>
      <ContextMenu.Portal>
        <ContextMenu.SubContent className="ctx-content">
          {item.submenu.map((s, i) => <CxItem key={i} item={s} actions={actions} />)}
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
  return (
    <ContextMenu.Item className="ctx-item" onSelect={() => 'action' in item && item.action?.(actions)}>
      {'label' in item ? item.label : ''}
    </ContextMenu.Item>
  );
}

function DdItem({ item, actions }: { item: MenuItem; actions: TabBarActions }) {
  if (item.type === 'separator') return <DropdownMenu.Separator className="ctx-sep" />;
  if ('submenu' in item && item.submenu?.length) return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="ctx-item">{item.label}<span className="ctx-arrow"><IconArrow /></span></DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className="ctx-content">
          {item.submenu.map((s, i) => <DdItem key={i} item={s} actions={actions} />)}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
  return (
    <DropdownMenu.Item className="ctx-item" onSelect={() => 'action' in item && item.action?.(actions)}>
      {'label' in item ? item.label : ''}
    </DropdownMenu.Item>
  );
}

// ── TabContextMenu — right-click wrapper ──────────────────────────────────────

function TabContextMenu({ target, children }: { target: ContextMenuTarget; children: React.ReactNode }) {
  const { actions, state } = useTabBarContext();
  const items = buildMenuItems(target, actions, state);
  if (!items.length) return <>{children}</>;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="ctx-content">
          {items.map((item, i) => <CxItem key={i} item={item} actions={actions} />)}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

// ── DotsMenu — click-trigger 3-dot dropdown ───────────────────────────────────

function DotsMenu({ target }: { target: ContextMenuTarget }) {
  const { actions, state } = useTabBarContext();
  const items = buildMenuItems(target, actions, state);
  if (!items.length) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="tab-dots" onClick={e => e.stopPropagation()} aria-label="More options">
          <IconDots />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="ctx-content" align="end">
          {items.map((item, i) => <DdItem key={i} item={item} actions={actions} />)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ── TabItem ───────────────────────────────────────────────────────────────────

function TabItem({ tabId }: { tabId: string }) {
  const { state } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close } = useTab(tabId);
  if (!tab) return null;
  return (
    <TabContextMenu target={{ type: 'tab', tabId }}>
      <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style}
        className="tab" onClick={activate} title={tab.label}>
        <span className="tab-label">{tab.label}</span>
        <DotsMenu target={{ type: 'tab', tabId }} />
        {tab.closable && (
          <button className="tab-close" onClick={e => { e.stopPropagation(); close(); }} aria-label="Close">
            <IconClose />
          </button>
        )}
      </div>
    </TabContextMenu>
  );
}

// ── GroupTabItem ──────────────────────────────────────────────────────────────

function GroupTabItem({ tabId, groupId }: { tabId: string; groupId: string }) {
  const { state } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close, eject } = useGroupTab(tabId, groupId);
  if (!tab) return null;
  return (
    <TabContextMenu target={{ type: 'group-tab', tabId, groupId }}>
      <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style}
        className="group-tab-item" onClick={activate}>
        <span className="group-tab-label">{tab.label}</span>
        <button className="group-tab-eject" onClick={e => { e.stopPropagation(); eject(); }} title="Eject from group">
          <IconEject />
        </button>
        <DotsMenu target={{ type: 'group-tab', tabId, groupId }} />
        {tab.closable && (
          <button className="tab-close" style={{ opacity: 1, position: 'static' }}
            onClick={e => { e.stopPropagation(); close(); }} title="Close">
            <IconClose />
          </button>
        )}
      </div>
    </TabContextMenu>
  );
}

// ── GroupDropZone ─────────────────────────────────────────────────────────────

function GroupDropZone({ groupId, tabIds }: { groupId: string; tabIds: string[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-dropdown:${groupId}`, data: { type: 'group-dropdown', groupId } });
  if (tabIds.length === 0) return (
    <div ref={setNodeRef} className="group-empty-drop-zone" data-over={isOver ? '' : undefined}>
      Drop tabs here
    </div>
  );
  return (
    <div ref={setNodeRef} className="group-tabs-list">
      <SortableContext items={tabIds.map(id => `group-tab:${id}`)} strategy={verticalListSortingStrategy}>
        {tabIds.map(tabId => <GroupTabItem key={tabId} tabId={tabId} groupId={groupId} />)}
      </SortableContext>
    </div>
  );
}

// ── GroupPill — portalled dropdown ────────────────────────────────────────────

function GroupPill({ groupId }: { groupId: string }) {
  const pillRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const { setNodeRef, attributes, listeners, style, isOpen, isOver, tabs, color, label, toggle, dissolve } = useTabGroup(groupId);
  const tabIds = tabs.map(t => t.id);

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    (pillRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  useEffect(() => {
    if (!isOpen) { setPos(null); return; }
    const measure = () => {
      if (!pillRef.current) return;
      const r = pillRef.current.getBoundingClientRect();
      setPos({ left: r.left, top: r.bottom + 3 });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [isOpen]);

  return (
    <TabContextMenu target={{ type: 'group', groupId }}>
      <div style={{ position: 'relative' }}>
        <div ref={setRefs} {...(attributes as any)} {...(listeners as any)}
          style={{ ...style, '--group-color': color } as React.CSSProperties}
          className="group-pill" data-open={isOpen ? '' : undefined} data-over={isOver ? '' : undefined}
          onClick={e => { e.stopPropagation(); toggle(); }}>
          <span className="group-dot" />
          <span className="group-label">{label}</span>
          <span className="group-count">{tabIds.length}</span>
          <DotsMenu target={{ type: 'group', groupId }} />
          <span className="group-chevron"><IconChevron /></span>
        </div>

        {isOpen && pos && createPortal(
          <div className="group-dropdown" style={{ left: pos.left, top: pos.top }}>
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

// ── TabStrip ──────────────────────────────────────────────────────────────────

function TabStrip() {
  const { setNodeRef, slots, isDraggingOver, sortableIds } = useTabStrip();
  const { actions } = useTabBarContext();
  const addTab = () => { const id = newTabId(); actions.addTab({ id, label: `Tab ${id.split('-')[1]}`, closable: true }); };
  return (
    <TabContextMenu target={{ type: 'strip' }}>
      <div ref={setNodeRef} className="tab-strip" data-dragging-over={isDraggingOver ? '' : undefined} role="tablist">
        <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
          {slots.map((slot: TabSlot) =>
            slot.type === 'tab'
              ? <TabItem key={slot.tabId} tabId={slot.tabId} />
              : <GroupPill key={slot.groupId} groupId={slot.groupId} />
          )}
        </SortableContext>
        <button className="tab tab-new" onClick={addTab} title="New tab (right-click for more)">+</button>
      </div>
    </TabContextMenu>
  );
}

// ── TabPanels ─────────────────────────────────────────────────────────────────

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
        {tab?.pinned && <span style={{ color: 'var(--c-accent)', marginLeft: 8 }}>· Pinned</span>}
      </p>
      <pre className="tab-panel-code">{JSON.stringify({ id: tabId, pinned: tab?.pinned ?? false }, null, 2)}</pre>
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

// ── StateInspector ────────────────────────────────────────────────────────────

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

// ── DemoToolbar ───────────────────────────────────────────────────────────────

function DemoToolbar() {
  const { actions } = useTabBarContext();
  const addTab = () => { const id = newTabId(); actions.addTab({ id, label: `Tab ${id.split('-')[1]}`, closable: true }); };
  const addGroup = () => { const id = newGroupId(); actions.addGroup({ id, label: 'New Group', color: GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)].value }); };
  return (
    <div className="demo-controls">
      <button className="btn primary" onClick={addTab}>+ New Tab</button>
      <button className="btn" onClick={addGroup}>⊞ New Group</button>
      <span className="btn-sep" />
      <span style={{ color: 'var(--c-muted)', fontSize: 12 }}>
        Right-click or click ⋮ on any tab · Drag to sort · Drag into groups
      </span>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, setState] = useState<TabBarState>(INITIAL_STATE);
  return (
    <div className="demo-root">
      <header className="demo-header">
        <div className="demo-header-logo">
          <span>⬡</span> react-tabstack
          <span className="demo-header-logo-badge">MVP</span>
        </div>
        <span className="demo-header-desc">Chrome-style tabs · drag &amp; drop · groups · context menus · headless</span>
      </header>
      <main className="demo-body">
        <TabBarProvider state={state} onStateChange={setState} groupHoverDelay={600} groupOpenOn="hover+click">
          <DemoToolbar />
          <div className="demo-section">
            <div className="demo-section-label">Horizontal Tab Bar — drag to sort · click groups · right-click or ⋮ for menu</div>
            <TabStrip />
          </div>
          <TabPanels />
          <StateInspector />
        </TabBarProvider>
      </main>
    </div>
  );
}
