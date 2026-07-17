import React, { useCallback, useRef, useState } from 'react';
import {
  TabBarProvider, useTabStrip, useTab, useTabGroup, useGroupTab, useTabPanel, useTabBarContext,
  createTabbedCollisionDetection,
} from '@react-tabstack/react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { TabSlot, TabBarState, ContextMenuTarget, MenuItem, TabBarActions } from '@react-tabstack/react';
import { EditableLabel, type EditableLabelHandle } from '../shared/EditableLabel.js';
import { TabContextMenu, DotsMenu, type MenuCtx } from '../shared/contextMenu.js';
import { useFocusGroup } from '../shared/useFocusGroup.js';
import '../marple/marple-theme.css';
import './marple-inline-theme.css';

// ─────────────────────────────────────────────────────────────────────────────
// Same real marple-insight visual tokens as the "Custom visual theme" example
// (../marple/marple-theme.css) — a group's expanded content just renders
// inline in the strip instead of in a floating dropdown, the way the
// "Inline groups" example does it. Nothing about the hooks changes between
// any of these three examples; only presentation does. See the docs page's
// "Group presentation" section for what's actually different under the hood.
// ─────────────────────────────────────────────────────────────────────────────

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

const MI_ICONS: Record<string, React.ReactNode> = {
  close: <IconClose />, eject: <IconEject />, folder: <IconFolder />, rename: <IconRename />, plus: <IconPlus />,
};

const MI_MENU_CLASSES = {
  content: 'mi-menu', item: 'mi-menu-item', itemIcon: 'mi-menu-icon', separator: 'mi-menu-sep',
  subTrigger: 'mi-menu-item', subContent: 'mi-menu', subArrow: 'mi-menu-sub-arrow',
  swatches: 'mi-menu-swatches', swatch: 'mi-menu-swatch',
};

const MI_GROUP_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2'];

const INITIAL_STATE: TabBarState = {
  tabs: {
    'mit-1': { id: 'mit-1', label: 'Cohort Overview', closable: true },
    'mit-2': { id: 'mit-2', label: 'Revenue by Segment', closable: true },
    'mit-3': { id: 'mit-3', label: 'Funnel v2', closable: true },
    'mit-4': { id: 'mit-4', label: 'Retention Curve', closable: true },
    'mit-5': { id: 'mit-5', label: 'Churn Drivers', closable: true },
    'mit-6': { id: 'mit-6', label: 'Draft — Q3 Plan', closable: true },
  },
  groups: {
    'mit-g1': { id: 'mit-g1', label: 'Growth', color: MI_GROUP_COLORS[0], collapsed: false },
    'mit-g2': { id: 'mit-g2', label: 'Risk', color: MI_GROUP_COLORS[1], collapsed: true },
  },
  slots: [
    { type: 'tab', tabId: 'mit-1' },
    { type: 'group', groupId: 'mit-g1', tabIds: ['mit-2', 'mit-3'] },
    { type: 'group', groupId: 'mit-g2', tabIds: ['mit-4', 'mit-5'] },
    { type: 'tab', tabId: 'mit-6' },
  ],
  activeTabId: 'mit-2',
};

let _tc = 10, _gc = 10;
const newTabId = () => `mit-${++_tc}`;
const newGroupId = () => `mit-g${++_gc}`;

function buildMiMenuItems(target: ContextMenuTarget, actions: TabBarActions, state: TabBarState, ctx: MenuCtx): MenuItem[] {
  const groups = Object.values(state.groups);
  const { startRename, focusGroup } = ctx;

  if (target.type === 'tab') {
    const { tabId } = target;
    return [
      { label: 'Rename…', icon: 'rename', action: startRename },
      ...(groups.length > 0 ? [{ label: 'Add to Group', icon: 'folder', submenu: groups.map(g => ({ label: g.label, action: () => { actions.addTabToGroup(tabId, g.id); focusGroup(g.id); } })) }] : []),
      { label: 'New Group', icon: 'plus', action: () => {
        const id = newGroupId();
        actions.createGroupFromTab(tabId, { id, label: 'New Group', color: MI_GROUP_COLORS[Math.floor(Math.random() * MI_GROUP_COLORS.length)] });
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
        submenu: MI_GROUP_COLORS.map(c => ({ label: c, icon: c === currentColor ? 'active' : undefined, action: () => actions.updateGroup(groupId, { color: c }) })),
      },
      { type: 'separator' as const },
      { label: 'Delete group', icon: 'close', destructive: true, action: () => actions.removeGroup(groupId) },
    ];
  }

  if (target.type === 'strip') {
    return [
      { label: 'New Tab', icon: 'plus', action: () => { const id = newTabId(); actions.addTab({ id, label: 'Untitled', closable: true }); } },
      { label: 'New Group', icon: 'folder', action: () => { const id = newGroupId(); actions.addGroup({ id, label: 'New Group', color: MI_GROUP_COLORS[Math.floor(Math.random() * MI_GROUP_COLORS.length)], collapsed: false }); } },
    ];
  }
  return [];
}

/** This example's "reveal a group" behavior: expand it inline (persistent, not hover-driven). */
function useInlineMiMenuCtx(target: ContextMenuTarget, startRename: () => void): MenuCtx {
  const { actions } = useTabBarContext();
  const focusGroup = useFocusGroup(target, (groupId) => actions.expandGroup(groupId));
  return { startRename, focusGroup };
}

function MiInlineTab({ tabId }: { tabId: string }) {
  const { state, actions } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close } = useTab(tabId);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
  const target: ContextMenuTarget = { type: 'tab', tabId };
  const ctx = useInlineMiMenuCtx(target, startRename);
  if (!tab) return null;
  return (
    <TabContextMenu target={target} ctx={ctx} icons={MI_ICONS} buildMenuItems={buildMiMenuItems} classNames={MI_MENU_CLASSES}>
      <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style} className="mi-tab mi-inline-draggable" onClick={activate}>
        <EditableLabel ref={labelRef} value={tab.label} className="mi-tab-label" onCommit={(v) => actions.updateTab(tabId, { label: v })} />
        <DotsMenu target={target} ctx={ctx} icons={MI_ICONS} buildMenuItems={buildMiMenuItems} classNames={MI_MENU_CLASSES} triggerIcon={<IconMore />} triggerClassName="mi-settings-btn mi-inline-dots" />
        {tab.closable && <button className="mi-settings-btn" style={{ opacity: 1 }} onPointerDown={stopPD} onClick={e => { e.stopPropagation(); close(); }} aria-label="Close"><IconClose /></button>}
      </div>
    </TabContextMenu>
  );
}

function MiInlineGroupMember({ tabId, groupId }: { tabId: string; groupId: string }) {
  const { state, actions } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, activate, close } = useGroupTab(tabId, groupId);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
  const target: ContextMenuTarget = { type: 'group-tab', tabId, groupId };
  const ctx = useInlineMiMenuCtx(target, startRename);
  if (!tab) return null;
  return (
    <TabContextMenu target={target} ctx={ctx} icons={MI_ICONS} buildMenuItems={buildMiMenuItems} classNames={MI_MENU_CLASSES}>
      <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style} className="mi-tab mi-inline-draggable mi-inline-tab-grouped" onClick={activate}>
        <EditableLabel ref={labelRef} value={tab.label} className="mi-tab-label" onCommit={(v) => actions.updateTab(tabId, { label: v })} />
        <DotsMenu target={target} ctx={ctx} icons={MI_ICONS} buildMenuItems={buildMiMenuItems} classNames={MI_MENU_CLASSES} triggerIcon={<IconMore />} triggerClassName="mi-settings-btn mi-inline-dots" />
        {tab.closable && <button className="mi-settings-btn" style={{ opacity: 1 }} onPointerDown={stopPD} onClick={e => { e.stopPropagation(); close(); }} aria-label="Close"><IconClose /></button>}
      </div>
    </TabContextMenu>
  );
}

function MiInlineGroup({ groupId, tabIds }: { groupId: string; tabIds: string[] }) {
  const { state, actions } = useTabBarContext();
  const {
    setNodeRef, attributes, listeners, style, isDragging, isOver, isCombineTarget, collapsed, color, label,
  } = useTabGroup(groupId);
  const labelRef = useRef<EditableLabelHandle>(null);
  const startRename = useCallback(() => labelRef.current?.startEditing(), []);
  const target: ContextMenuTarget = { type: 'group', groupId };
  const ctx = useInlineMiMenuCtx(target, startRename);

  // Matched by collision detection via data.type: 'group-dropdown' — the
  // same contract the floating-dropdown Marple example's container uses, so
  // the same in-group placement logic resolves precise drops here too.
  const { setNodeRef: setInlineRef } = useDroppable({
    id: `group-inline:${groupId}`,
    data: { type: 'group-dropdown', groupId },
  });

  if (!state.groups[groupId]) return null;
  const toggle = () => (collapsed ? actions.expandGroup(groupId) : actions.collapseGroup(groupId));

  return (
    // setNodeRef/style (dnd-kit's transform) on this wrapper, not just the
    // head below — see the equivalent comment in InlineGroupsExample.tsx.
    <div
      ref={setNodeRef} style={{ ...style, '--group-color': color } as React.CSSProperties}
      className="mi-inline-group"
      data-collapsed={collapsed ? '' : undefined}
      data-over={isOver ? '' : undefined}
      data-combine-target={isCombineTarget ? '' : undefined}
      data-dragging={isDragging ? '' : undefined}
    >
      <TabContextMenu target={target} ctx={ctx} icons={MI_ICONS} buildMenuItems={buildMiMenuItems} classNames={MI_MENU_CLASSES}>
        <div {...(attributes as any)} {...(listeners as any)} className="mi-inline-group-head" onClick={e => { e.stopPropagation(); toggle(); }}>
          <span className="mi-group-icon"><IconFolder /></span>
          <EditableLabel ref={labelRef} value={label} className="mi-group-label" onCommit={(v) => actions.updateGroup(groupId, { label: v })} />
          {collapsed && <span className="mi-inline-group-count">{tabIds.length}</span>}
          <DotsMenu target={target} ctx={ctx} icons={MI_ICONS} buildMenuItems={buildMiMenuItems} classNames={MI_MENU_CLASSES} triggerIcon={<IconMore />} triggerClassName="mi-settings-btn mi-inline-dots" />
          <span className="mi-group-chevron" style={{ transform: collapsed ? 'rotate(-90deg)' : undefined }}><IconChevron /></span>
        </div>
      </TabContextMenu>

      {!collapsed && (
        <div ref={setInlineRef} className="mi-inline-group-members">
          {tabIds.length === 0 ? (
            <div className="mi-inline-empty-drop">Drop tabs here</div>
          ) : (
            <SortableContext id={`group-inline:${groupId}`} items={tabIds} strategy={horizontalListSortingStrategy}>
              {tabIds.map(id => <MiInlineGroupMember key={id} tabId={id} groupId={groupId} />)}
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}

function MiInlineStrip() {
  const {
    setNodeRef, attributes, slots, sortableIds, sortStrategy, sortableContextId,
    canScrollBack, canScrollForward, scrollBack, scrollForward,
  } = useTabStrip();
  const stripTarget: ContextMenuTarget = { type: 'strip' };
  const stripCtx = useInlineMiMenuCtx(stripTarget, () => {});
  return (
    <TabContextMenu target={stripTarget} ctx={stripCtx} icons={MI_ICONS} buildMenuItems={buildMiMenuItems} classNames={MI_MENU_CLASSES}>
      <div className="mi-strip-wrap">
        {canScrollBack && (
          <button className="mi-scroll-btn" data-side="back" onClick={scrollBack} aria-label="Scroll back"><IconChevron /></button>
        )}
        <div ref={setNodeRef} {...(attributes as any)} className="mi-strip">
          <SortableContext id={sortableContextId} items={sortableIds} strategy={sortStrategy}>
            {slots.map((slot: TabSlot) => slot.type === 'tab' ? <MiInlineTab key={slot.tabId} tabId={slot.tabId} /> : <MiInlineGroup key={slot.groupId} groupId={slot.groupId} tabIds={slot.tabIds} />)}
          </SortableContext>
        </div>
        {canScrollForward && (
          <button className="mi-scroll-btn" data-side="forward" onClick={scrollForward} aria-label="Scroll forward"><IconChevron /></button>
        )}
        <MiInlineAddMenu />
      </div>
    </TabContextMenu>
  );
}

function MiInlineAddMenu() {
  const { actions } = useTabBarContext();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="mi-add-btn" title="Add" aria-label="Add"><IconPlus /></button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="mi-menu" align="start" sideOffset={4}>
          <DropdownMenu.Item className="mi-menu-item" onSelect={() => { const id = newTabId(); actions.addTab({ id, label: 'Untitled', closable: true }); }}>
            <span className="mi-menu-icon"><IconPlus /></span>New Tab
          </DropdownMenu.Item>
          <DropdownMenu.Item className="mi-menu-item" onSelect={() => { const id = newGroupId(); actions.addGroup({ id, label: 'New Group', color: MI_GROUP_COLORS[Math.floor(Math.random() * MI_GROUP_COLORS.length)], collapsed: false }); }}>
            <span className="mi-menu-icon"><IconFolder /></span>New Group
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MiInlinePanel({ tabId }: { tabId: string }) {
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

function MiInlinePanels() {
  const { state } = useTabBarContext();
  return <>{Object.keys(state.tabs).map(id => <MiInlinePanel key={id} tabId={id} />)}</>;
}

// See the equivalent comment in InlineGroupsExample.tsx: a moderate (not
// minimal) hit-margin balances two competing failure modes — too large and
// adjacent groups' forgiveness zones overlap (the UI jumping between two
// while dragging in the gap between them); too small and a collapsed
// group's compact pill becomes hard to actually land a drop on. A wider
// combine zone (0.92) also shrinks the "sort next to, not into" edge band
// on that same compact pill, which is otherwise wide enough on a small
// target that a natural drop right as you reach it can miss "combine"
// entirely.
const collisionDetection = (ctx: Parameters<typeof createTabbedCollisionDetection>[0]) =>
  createTabbedCollisionDetection({ ...ctx, dropdownHitMargin: 5, combineFraction: 0.92 });

export default function MarpleInlineExample() {
  const [state, setState] = useState<TabBarState>(INITIAL_STATE);
  return (
    <div className="mi-root">
      <TabBarProvider
        state={state}
        onStateChange={setState}
        orientation="horizontal"
        collisionDetection={collisionDetection}
        renderDragOverlay={(id, data) => {
          const isGroup = data.type === 'group';
          const tabId = (data.tabId ?? id) as string;
          const groupId = data.groupId as string | undefined;
          const tab = state.tabs[tabId];
          const group = groupId ? state.groups[groupId] : undefined;
          const label = tab?.label ?? group?.label ?? id;
          return isGroup
            ? <div className="mi-inline-group-head mi-drag-ghost" style={{ '--group-color': group?.color } as React.CSSProperties}><span className="mi-group-icon"><IconFolder /></span><span>{label}</span></div>
            : <div className="mi-tab mi-drag-ghost"><span className="mi-tab-label">{label}</span></div>;
        }}
      >
        <MiInlineStrip />
        <MiInlinePanels />
      </TabBarProvider>
    </div>
  );
}
