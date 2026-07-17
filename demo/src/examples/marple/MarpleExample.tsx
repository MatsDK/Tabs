import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  TabBarProvider, useTabStrip, useTab, useTabGroup,
  useGroupTab, useTabPanel, useTabBarContext, useStickyPosition,
} from '@react-tabstack/react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { TabSlot, TabBarState, ContextMenuTarget, MenuItem, TabBarActions } from '@react-tabstack/react';
import { EditableLabel } from '../shared/EditableLabel.js';
import './marple-theme.css';

const stopPD = (e: React.PointerEvent) => e.stopPropagation();

const IconClose = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" /><line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
  </svg>
);
const IconMore = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <circle cx="6" cy="2.5" r="1.1" /><circle cx="6" cy="6" r="1.1" /><circle cx="6" cy="9.5" r="1.1" />
  </svg>
);
const IconFolder = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 3.2h3l1 1.1h5.1v5.5a.7.7 0 0 1-.7.7H2.2a.7.7 0 0 1-.7-.7V3.2Z" />
  </svg>
);
const IconChevron = () => (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M2.5 4.5 6 8l3.5-3.5" />
  </svg>
);
const IconSubArrow = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h4M4 2l2 2-2 2" />
  </svg>
);
const IconEject = () => (
  <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 7V1M2 4l3-3 3 3M1 8.5h8" />
  </svg>
);
const IconRename = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.2 1.8 10.2 3.8 3.6 10.4 1.2 10.8 1.6 8.4 8.2 1.8Z" />
  </svg>
);
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M6 2v8M2 6h8" />
  </svg>
);

const MI_ICONS: Record<string, React.ReactNode> = {
  close: <IconClose />, eject: <IconEject />, folder: <IconFolder />, rename: <IconRename />, plus: <IconPlus />,
};

const MI_GROUP_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2'];

const INITIAL_STATE: TabBarState = {
  tabs: {
    'mi-1': { id: 'mi-1', label: 'Cohort Overview', closable: true },
    'mi-2': { id: 'mi-2', label: 'Revenue by Segment', closable: true },
    'mi-3': { id: 'mi-3', label: 'Funnel v2', closable: true },
    'mi-4': { id: 'mi-4', label: 'Retention Curve', closable: true },
    'mi-5': { id: 'mi-5', label: 'Churn Drivers', closable: true },
    'mi-6': { id: 'mi-6', label: 'Draft — Q3 Plan', closable: true },
  },
  groups: {
    'mi-g1': { id: 'mi-g1', label: 'Growth', color: MI_GROUP_COLORS[0] },
    'mi-g2': { id: 'mi-g2', label: 'Risk', color: MI_GROUP_COLORS[1] },
  },
  slots: [
    { type: 'tab', tabId: 'mi-1' },
    { type: 'group', groupId: 'mi-g1', tabIds: ['mi-2', 'mi-3'] },
    { type: 'group', groupId: 'mi-g2', tabIds: ['mi-4', 'mi-5'] },
    { type: 'tab', tabId: 'mi-6' },
  ],
  activeTabId: 'mi-2',
};

let _tc = 10, _gc = 10;
const newTabId = () => `mi-${++_tc}`;
const newGroupId = () => `mi-g${++_gc}`;

function buildMiMenuItems(target: ContextMenuTarget, actions: TabBarActions, state: TabBarState): MenuItem[] {
  const groups = Object.values(state.groups);

  if (target.type === 'tab') {
    const { tabId } = target;
    return [
      ...(groups.length > 0 ? [{ label: 'Add to Group', icon: 'folder', submenu: groups.map(g => ({ label: g.label, action: () => actions.addTabToGroup(tabId, g.id) })) }] : []),
      { label: 'New Group', icon: 'plus', action: () => actions.createGroupFromTab(tabId, { id: newGroupId(), label: 'New Group', color: MI_GROUP_COLORS[Math.floor(Math.random() * MI_GROUP_COLORS.length)] }) },
      { type: 'separator' as const },
      { label: 'Delete', icon: 'close', destructive: true, action: () => actions.removeTab(tabId) },
    ];
  }

  if (target.type === 'group-tab') {
    const { tabId, groupId } = target;
    const others = groups.filter(g => g.id !== groupId);
    return [
      { label: 'Ungroup', icon: 'eject', action: () => actions.removeTabFromGroup(tabId) },
      ...(others.length > 0 ? [{ label: 'Move to Group', icon: 'folder', submenu: others.map(g => ({ label: g.label, action: () => actions.moveTabToGroup(tabId, g.id) })) }] : []),
      { type: 'separator' as const },
      { label: 'Delete', icon: 'close', destructive: true, action: () => actions.removeTab(tabId) },
    ];
  }

  if (target.type === 'group') {
    const { groupId } = target;
    return [
      { label: 'Rename…', icon: 'rename', action: () => { const n = prompt('Group name:'); if (n) actions.updateGroup(groupId, { label: n }); } },
      { label: 'Ungroup all', icon: 'eject', action: () => actions.dissolveGroup(groupId) },
      { type: 'separator' as const },
      { label: '__swatches__', submenu: MI_GROUP_COLORS.map(c => ({ label: c, action: () => actions.updateGroup(groupId, { color: c }) })) },
      { type: 'separator' as const },
      { label: 'Delete group', icon: 'close', destructive: true, action: () => actions.removeGroup(groupId) },
    ];
  }

  return [];
}

function MiMenuItem({ item, actions }: { item: MenuItem; actions: TabBarActions }) {
  if (item.type === 'separator') return <DropdownMenu.Separator className="mi-menu-sep" />;

  if ('label' in item && item.label === '__swatches__' && 'submenu' in item && item.submenu) {
    return (
      <div className="mi-menu-swatches">
        {item.submenu.map((s, i) => (
          <div key={i} className="mi-menu-swatch" data-active="" style={{ background: 'label' in s ? s.label : undefined }}
            onClick={() => 'action' in s && s.action?.(actions)} />
        ))}
      </div>
    );
  }

  if ('submenu' in item && item.submenu?.length) return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="mi-menu-item">
        {'icon' in item && item.icon && <span className="mi-menu-icon">{MI_ICONS[item.icon]}</span>}
        {item.label}<span style={{ marginLeft: 'auto', color: 'var(--mi-zinc-400)' }}><IconSubArrow /></span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className="mi-menu">
          {item.submenu.map((s, i) => <MiMenuItem key={i} item={s} actions={actions} />)}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );

  return (
    <DropdownMenu.Item
      className="mi-menu-item" data-destructive={'destructive' in item && item.destructive ? '' : undefined}
      onSelect={() => 'action' in item && item.action?.(actions)}
    >
      {'icon' in item && item.icon && <span className="mi-menu-icon">{MI_ICONS[item.icon]}</span>}
      {'label' in item ? item.label : ''}
    </DropdownMenu.Item>
  );
}

function MiSettingsMenu({ target }: { target: ContextMenuTarget }) {
  const { actions, state } = useTabBarContext();
  const items = buildMiMenuItems(target, actions, state);
  if (!items.length) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="mi-settings-btn" onPointerDown={stopPD} onClick={e => e.stopPropagation()} aria-label="More options"><IconMore /></button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="mi-menu" align="start" sideOffset={4}>
          {items.map((item, i) => <MiMenuItem key={i} item={item} actions={actions} />)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MiTab({ tabId }: { tabId: string }) {
  const { state, actions } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close } = useTab(tabId);
  if (!tab) return null;
  return (
    <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style} className="mi-tab mi-draggable" onClick={activate}>
      <EditableLabel value={tab.label} className="mi-tab-label" onCommit={(v) => actions.updateTab(tabId, { label: v })} />
      <MiSettingsMenu target={{ type: 'tab', tabId }} />
      {tab.closable && <button className="mi-settings-btn" style={{ opacity: 1 }} onPointerDown={stopPD} onClick={e => { e.stopPropagation(); close(); }} aria-label="Close"><IconClose /></button>}
    </div>
  );
}

function MiGroupTab({ tabId, groupId }: { tabId: string; groupId: string }) {
  const { state, actions, dropdown } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate } = useGroupTab(tabId, groupId);
  if (!tab) return null;
  return (
    <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style} className="mi-group-tab" onClick={() => { activate(); dropdown.closeImmediate(); }}>
      <EditableLabel value={tab.label} className="mi-group-tab-label" onCommit={(v) => actions.updateTab(tabId, { label: v })} />
      <MiSettingsMenu target={{ type: 'group-tab', tabId, groupId }} />
    </div>
  );
}

function MiGroupDropdownContent({ groupId, tabIds }: { groupId: string; tabIds: string[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-dropdown:${groupId}`, data: { type: 'group-dropdown', groupId } });
  if (tabIds.length === 0) return <div ref={setNodeRef} className="mi-empty-drop" data-over={isOver ? '' : undefined}>Drop tabs here</div>;
  return (
    <div ref={setNodeRef}>
      <SortableContext id={`group-dropdown:${groupId}`} items={tabIds} strategy={verticalListSortingStrategy}>
        {tabIds.map(id => <MiGroupTab key={id} tabId={id} groupId={groupId} />)}
      </SortableContext>
    </div>
  );
}

function MiGroupPill({ groupId }: { groupId: string }) {
  const pillRef = useRef<HTMLDivElement>(null);
  const { state, actions } = useTabBarContext();
  const {
    setNodeRef, setDropdownRef, dropdownAttributes, attributes, listeners, style,
    isOpen, isCombineTarget, containsActive, tabIds, color, label, toggle,
  } = useTabGroup(groupId);
  const rect = useStickyPosition(pillRef, isOpen);
  const activeChildName = containsActive && state.activeTabId ? state.tabs[state.activeTabId]?.label : null;

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    (pillRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  return (
    <div style={{ position: 'relative' }} className="mi-draggable">
      <div ref={setRefs} {...(attributes as any)} {...(listeners as any)}
        style={{ ...style, '--group-color': color } as React.CSSProperties}
        className="mi-group-pill" data-open={isOpen ? '' : undefined} data-combine-target={isCombineTarget ? '' : undefined}
        onClick={e => { e.stopPropagation(); toggle(); }}>
        <span className="mi-group-icon"><IconFolder /></span>
        <EditableLabel value={label} className="mi-group-label" onCommit={(v) => actions.updateGroup(groupId, { label: v })} />
        {activeChildName && <span className="mi-group-active-child">/ {activeChildName}</span>}
        <span className="mi-group-count">{tabIds.length}</span>
        <MiSettingsMenu target={{ type: 'group', groupId }} />
        <span className="mi-group-chevron"><IconChevron /></span>
      </div>

      {isOpen && rect && createPortal(
        <div ref={setDropdownRef} {...dropdownAttributes} className="mi-dropdown" style={{ left: rect.left, top: rect.top + rect.height + 4 }}>
          <MiGroupDropdownContent groupId={groupId} tabIds={tabIds} />
        </div>,
        document.body
      )}
    </div>
  );
}

function MiStrip() {
  const {
    setNodeRef, attributes, slots, sortableIds, sortStrategy, sortableContextId,
    canScrollBack, canScrollForward, scrollBack, scrollForward,
  } = useTabStrip();
  const { actions } = useTabBarContext();
  return (
    <div className="mi-strip-wrap">
      {canScrollBack && (
        <button className="mi-scroll-btn" data-side="back" onClick={scrollBack} aria-label="Scroll back"><IconChevron /></button>
      )}
      <div ref={setNodeRef} {...(attributes as any)} className="mi-strip">
        <SortableContext id={sortableContextId} items={sortableIds} strategy={sortStrategy}>
          {slots.map((slot: TabSlot) => slot.type === 'tab' ? <MiTab key={slot.tabId} tabId={slot.tabId} /> : <MiGroupPill key={slot.groupId} groupId={slot.groupId} />)}
        </SortableContext>
      </div>
      {canScrollForward && (
        <button className="mi-scroll-btn" data-side="forward" onClick={scrollForward} aria-label="Scroll forward"><IconChevron /></button>
      )}
      <button className="mi-add-btn" onClick={() => { const id = newTabId(); actions.addTab({ id, label: 'Untitled', closable: true }); }} title="New tab"><IconPlus /></button>
    </div>
  );
}

function MiPanel({ tabId }: { tabId: string }) {
  const { state } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { attributes } = useTabPanel(tabId);
  return (
    <div {...(attributes as any)} className="mi-content">
      <h2>{tab?.label}</h2>
      <p>Analysis content for “{tab?.label}” would render here.</p>
    </div>
  );
}

function MiPanels() {
  const { state } = useTabBarContext();
  return <>{Object.keys(state.tabs).map(id => <MiPanel key={id} tabId={id} />)}</>;
}

export default function MarpleExample() {
  const [state, setState] = useState<TabBarState>(INITIAL_STATE);
  return (
    <div className="mi-root">
      <TabBarProvider
        state={state}
        onStateChange={setState}
        orientation="horizontal"
        groupOpenOn="hover+click"
        dissolveEmptyGroups={false}
        renderDragOverlay={(id, data) => {
          const isGroup = data.type === 'group';
          const tabId = (data.tabId ?? id) as string;
          const groupId = data.groupId as string | undefined;
          const tab = state.tabs[tabId];
          const group = groupId ? state.groups[groupId] : undefined;
          const label = tab?.label ?? group?.label ?? id;
          return isGroup
            ? <div className="mi-group-pill mi-drag-ghost" style={{ '--group-color': group?.color } as React.CSSProperties}><span className="mi-group-icon"><IconFolder /></span><span>{label}</span></div>
            : <div className="mi-tab mi-drag-ghost"><span className="mi-tab-label">{label}</span></div>;
        }}
      >
        <MiStrip />
        <MiPanels />
      </TabBarProvider>
    </div>
  );
}
