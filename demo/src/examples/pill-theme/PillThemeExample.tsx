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
import { EditableLabel, type EditableLabelHandle } from '../shared/EditableLabel.js';
import { DotsMenu, type MenuCtx } from '../shared/contextMenu.js';
import { useFocusGroup } from '../shared/useFocusGroup.js';
import './pill-theme.css';

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

const PT_ICONS: Record<string, React.ReactNode> = {
  close: <IconClose />, eject: <IconEject />, folder: <IconFolder />, rename: <IconRename />, plus: <IconPlus />,
};

const PT_GROUP_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2'];

const INITIAL_STATE: TabBarState = {
  tabs: {
    'pt-1': { id: 'pt-1', label: 'Cohort Overview', closable: true },
    'pt-2': { id: 'pt-2', label: 'Revenue by Segment', closable: true },
    'pt-3': { id: 'pt-3', label: 'Funnel v2', closable: true },
    'pt-4': { id: 'pt-4', label: 'Retention Curve', closable: true },
    'pt-5': { id: 'pt-5', label: 'Churn Drivers', closable: true },
    'pt-6': { id: 'pt-6', label: 'Draft — Q3 Plan', closable: true },
  },
  groups: {
    'pt-g1': { id: 'pt-g1', label: 'Growth', color: PT_GROUP_COLORS[0] },
    'pt-g2': { id: 'pt-g2', label: 'Risk', color: PT_GROUP_COLORS[1] },
  },
  slots: [
    { type: 'tab', tabId: 'pt-1' },
    { type: 'group', groupId: 'pt-g1', tabIds: ['pt-2', 'pt-3'] },
    { type: 'group', groupId: 'pt-g2', tabIds: ['pt-4', 'pt-5'] },
    { type: 'tab', tabId: 'pt-6' },
  ],
  activeTabId: 'pt-2',
};

let _tc = 10, _gc = 10;
const newTabId = () => `pt-${++_tc}`;
const newGroupId = () => `pt-g${++_gc}`;

const PT_MENU_CLASSES = {
  content: 'pt-menu', item: 'pt-menu-item', itemIcon: 'pt-menu-icon', separator: 'pt-menu-sep',
  subTrigger: 'pt-menu-item', subContent: 'pt-menu', subArrow: 'pt-menu-sub-arrow',
  swatches: 'pt-menu-swatches', swatch: 'pt-menu-swatch',
};

function buildPtMenuItems(target: ContextMenuTarget, actions: TabBarActions, state: TabBarState, ctx: MenuCtx): MenuItem[] {
  const groups = Object.values(state.groups);
  const { startRename, focusGroup } = ctx;

  if (target.type === 'tab') {
    const { tabId } = target;
    return [
      { label: 'Rename…', icon: 'rename', action: startRename },
      ...(groups.length > 0 ? [{ label: 'Add to Group', icon: 'folder', submenu: groups.map(g => ({ label: g.label, action: () => { actions.addTabToGroup(tabId, g.id); focusGroup(g.id); } })) }] : []),
      { label: 'New Group', icon: 'plus', action: () => {
        const id = newGroupId();
        actions.createGroupFromTab(tabId, { id, label: 'New Group', color: PT_GROUP_COLORS[Math.floor(Math.random() * PT_GROUP_COLORS.length)] });
        focusGroup(id);
      } },
      { type: 'separator' as const },
      { label: 'Delete', icon: 'close', destructive: true, action: () => actions.removeTab(tabId) },
    ];
  }

  if (target.type === 'group-tab') {
    const { tabId, groupId } = target;
    const others = groups.filter(g => g.id !== groupId);
    return [
      { label: 'Rename…', icon: 'rename', action: startRename },
      { label: 'Ungroup', icon: 'eject', action: () => actions.removeTabFromGroup(tabId) },
      ...(others.length > 0 ? [{ label: 'Move to Group', icon: 'folder', submenu: others.map(g => ({ label: g.label, action: () => { actions.moveTabToGroup(tabId, g.id); focusGroup(g.id); } })) }] : []),
      { type: 'separator' as const },
      { label: 'Delete', icon: 'close', destructive: true, action: () => actions.removeTab(tabId) },
    ];
  }

  if (target.type === 'group') {
    const { groupId } = target;
    const currentColor = state.groups[groupId]?.color;
    return [
      { label: 'Rename…', icon: 'rename', action: startRename },
      { label: 'Ungroup all', icon: 'eject', action: () => actions.dissolveGroup(groupId) },
      { type: 'separator' as const },
      {
        label: '__swatches__',
        submenu: PT_GROUP_COLORS.map(c => ({ label: c, icon: c === currentColor ? 'active' : undefined, action: () => actions.updateGroup(groupId, { color: c }) })),
      },
      { type: 'separator' as const },
      { label: 'Delete group', icon: 'close', destructive: true, action: () => actions.removeGroup(groupId) },
    ];
  }

  return [];
}

/** This example's "reveal a group" behavior: open its floating dropdown. */
function usePtMenuCtx(target: ContextMenuTarget, startRename: () => void): MenuCtx {
  const { dropdown } = useTabBarContext();
  const focusGroup = useFocusGroup(target, (groupId) => dropdown.openImmediate(groupId));
  return { startRename, focusGroup };
}

function PtSettingsMenu({ target, startRename }: { target: ContextMenuTarget; startRename: () => void }) {
  const ctx = usePtMenuCtx(target, startRename);
  return (
    <DotsMenu
      target={target} ctx={ctx} icons={PT_ICONS} buildMenuItems={buildPtMenuItems} classNames={PT_MENU_CLASSES}
      triggerIcon={<IconMore />} triggerClassName="pt-settings-btn"
    />
  );
}

function PtTab({ tabId }: { tabId: string }) {
  const { state, actions } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close } = useTab(tabId);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
  if (!tab) return null;
  return (
    <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style} className="pt-tab pt-draggable" onClick={activate}>
      <EditableLabel ref={labelRef} value={tab.label} className="pt-tab-label" onCommit={(v) => actions.updateTab(tabId, { label: v })} />
      <PtSettingsMenu target={{ type: 'tab', tabId }} startRename={startRename} />
      {tab.closable && <button className="pt-settings-btn" style={{ opacity: 1 }} onPointerDown={stopPD} onClick={e => { e.stopPropagation(); close(); }} aria-label="Close"><IconClose /></button>}
    </div>
  );
}

function PtGroupTab({ tabId, groupId }: { tabId: string; groupId: string }) {
  const { state, actions, dropdown } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate } = useGroupTab(tabId, groupId);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
  if (!tab) return null;
  return (
    <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style} className="pt-group-tab" onClick={() => { activate(); dropdown.closeImmediate(); }}>
      <EditableLabel ref={labelRef} value={tab.label} className="pt-group-tab-label" onCommit={(v) => actions.updateTab(tabId, { label: v })} />
      <PtSettingsMenu target={{ type: 'group-tab', tabId, groupId }} startRename={startRename} />
    </div>
  );
}

function PtGroupDropdownContent({ groupId, tabIds }: { groupId: string; tabIds: string[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-dropdown:${groupId}`, data: { type: 'group-dropdown', groupId } });
  if (tabIds.length === 0) return <div ref={setNodeRef} className="pt-empty-drop" data-over={isOver ? '' : undefined}>Drop tabs here</div>;
  return (
    <div ref={setNodeRef}>
      <SortableContext id={`group-dropdown:${groupId}`} items={tabIds} strategy={verticalListSortingStrategy}>
        {tabIds.map(id => <PtGroupTab key={id} tabId={id} groupId={groupId} />)}
      </SortableContext>
    </div>
  );
}

function PtGroupPill({ groupId }: { groupId: string }) {
  const pillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
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
    <div style={{ position: 'relative' }} className="pt-draggable">
      <div ref={setRefs} {...(attributes as any)} {...(listeners as any)}
        style={{ ...style, '--group-color': color } as React.CSSProperties}
        className="pt-group-pill" data-open={isOpen ? '' : undefined} data-combine-target={isCombineTarget ? '' : undefined}
        onClick={e => { e.stopPropagation(); toggle(); }}>
        <span className="pt-group-icon"><IconFolder /></span>
        <EditableLabel ref={labelRef} value={label} className="pt-group-label" onCommit={(v) => actions.updateGroup(groupId, { label: v })} />
        {activeChildName && <span className="pt-group-active-child">/ {activeChildName}</span>}
        <span className="pt-group-count">{tabIds.length}</span>
        <PtSettingsMenu target={{ type: 'group', groupId }} startRename={startRename} />
        <span className="pt-group-chevron"><IconChevron /></span>
      </div>

      {/* No gap to the pill — see the comment on the equivalent calc in DefaultExample.tsx */}
      {isOpen && rect && createPortal(
        <div ref={setDropdownRef} {...dropdownAttributes} className="pt-dropdown" style={{ left: rect.left, top: rect.top + rect.height }}>
          <PtGroupDropdownContent groupId={groupId} tabIds={tabIds} />
        </div>,
        document.body
      )}
    </div>
  );
}

function PtStrip() {
  const {
    setNodeRef, attributes, slots, sortableIds, sortStrategy, sortableContextId,
    canScrollBack, canScrollForward, scrollBack, scrollForward,
  } = useTabStrip();
  return (
    <div className="pt-strip-wrap">
      {canScrollBack && (
        <button className="pt-scroll-btn" data-side="back" onClick={scrollBack} aria-label="Scroll back"><IconChevron /></button>
      )}
      <div ref={setNodeRef} {...(attributes as any)} className="pt-strip">
        <SortableContext id={sortableContextId} items={sortableIds} strategy={sortStrategy}>
          {slots.map((slot: TabSlot) => slot.type === 'tab' ? <PtTab key={slot.tabId} tabId={slot.tabId} /> : <PtGroupPill key={slot.groupId} groupId={slot.groupId} />)}
        </SortableContext>
      </div>
      {canScrollForward && (
        <button className="pt-scroll-btn" data-side="forward" onClick={scrollForward} aria-label="Scroll forward"><IconChevron /></button>
      )}
      <PtAddMenu />
    </div>
  );
}

function PtAddMenu() {
  const { actions } = useTabBarContext();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="pt-add-btn" title="Add" aria-label="Add"><IconPlus /></button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="pt-menu" align="start" sideOffset={4}>
          <DropdownMenu.Item className="pt-menu-item" onSelect={() => { const id = newTabId(); actions.addTab({ id, label: 'Untitled', closable: true }); }}>
            <span className="pt-menu-icon"><IconPlus /></span>New Tab
          </DropdownMenu.Item>
          <DropdownMenu.Item className="pt-menu-item" onSelect={() => { const id = newGroupId(); actions.addGroup({ id, label: 'New Group', color: PT_GROUP_COLORS[Math.floor(Math.random() * PT_GROUP_COLORS.length)] }); }}>
            <span className="pt-menu-icon"><IconFolder /></span>New Group
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function PtPanel({ tabId }: { tabId: string }) {
  const { state } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { attributes } = useTabPanel(tabId);
  return (
    <div {...(attributes as any)} className="pt-content">
      <h2>{tab?.label}</h2>
      <p>Analysis content for “{tab?.label}” would render here.</p>
    </div>
  );
}

function PtPanels() {
  const { state } = useTabBarContext();
  return <>{Object.keys(state.tabs).map(id => <PtPanel key={id} tabId={id} />)}</>;
}

export default function PillThemeExample() {
  const [state, setState] = useState<TabBarState>(INITIAL_STATE);
  return (
    <div className="pt-root">
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
            ? <div className="pt-group-pill pt-drag-ghost" style={{ '--group-color': group?.color } as React.CSSProperties}><span className="pt-group-icon"><IconFolder /></span><span>{label}</span></div>
            : <div className="pt-tab pt-drag-ghost"><span className="pt-tab-label">{label}</span></div>;
        }}
      >
        <PtStrip />
        <PtPanels />
      </TabBarProvider>
    </div>
  );
}
