import React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTabBarContext } from '@react-tabstack/react';
import type { ContextMenuTarget, MenuItem, TabBarActions, TabBarState } from '@react-tabstack/react';

// ─────────────────────────────────────────────────────────────────────────────
// Shared context-menu/dots-menu chrome — every example that wants right-click
// and ⋮ menus (with submenus, a color-swatch grid, and inline rename) uses
// this instead of hand-rolling its own Radix wiring. What's example-specific
// stays example-specific and is passed in as props:
//   - `buildMenuItems`: what the menu actually contains for a given target
//   - `icons`: the icon set (examples draw their icons at different sizes/styles)
//   - `ctx.focusGroup`: what "reveal this group" means in this example's
//     presentation (open a dropdown vs. expand inline) — see useRenameHandle
//     below for the other half (starting an inline rename).
// ─────────────────────────────────────────────────────────────────────────────

export interface MenuCtx {
  /** Opens the inline-editable input on whichever tab/group this menu belongs to. */
  startRename: () => void;
  /** Selects the moved tab and reveals its destination group, so a "Move to
   *  Group"/"Move to New Group" click has an immediate, visible result. */
  focusGroup: (groupId: string) => void;
}

export type IconMap = Record<string, React.ReactNode>;

export type BuildMenuItems = (
  target: ContextMenuTarget,
  actions: TabBarActions,
  state: TabBarState,
  ctx: MenuCtx
) => MenuItem[];

const IconArrow = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h4M4 2l2 2-2 2" />
  </svg>
);

function ItemIcon({ item, icons }: { item: MenuItem; icons: IconMap }) {
  if (item.type === 'separator' || item.type === 'label' || !('icon' in item) || !item.icon) return null;
  return <span className="context-menu-item-icon">{icons[item.icon]}</span>;
}

/** A "__swatches__"-labeled item renders as a grid of clickable color dots
 *  instead of a normal row — each sub-item's `label` is the CSS color value
 *  and an `icon: 'active'` marks the currently-selected one. */
function SwatchGrid({ item, actions }: { item: MenuItem; actions: TabBarActions }) {
  if (!('submenu' in item) || !item.submenu) return null;
  return (
    <div className="context-menu-swatches">
      {item.submenu.map((s, i) => (
        <button
          key={i} type="button" className="context-menu-swatch"
          data-active={'icon' in s && s.icon === 'active' ? '' : undefined}
          style={{ background: 'label' in s ? s.label : undefined }}
          onClick={() => 'action' in s && s.action?.(actions)}
          aria-label={'label' in s ? s.label : 'Color'}
        />
      ))}
    </div>
  );
}

function CxItem({ item, actions, icons }: { item: MenuItem; actions: TabBarActions; icons: IconMap }) {
  if (item.type === 'separator') return <ContextMenu.Separator className="context-menu-separator" />;
  if ('label' in item && item.label === '__swatches__') return <SwatchGrid item={item} actions={actions} />;
  if ('submenu' in item && item.submenu?.length) return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger className="context-menu-sub-trigger">
        <ItemIcon item={item} icons={icons} />{item.label}<span className="context-sub-arrow"><IconArrow /></span>
      </ContextMenu.SubTrigger>
      <ContextMenu.Portal>
        <ContextMenu.SubContent className="context-menu-sub-content">
          {item.submenu.map((s, i) => <CxItem key={i} item={s} actions={actions} icons={icons} />)}
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
  return (
    <ContextMenu.Item
      className="context-menu-item" data-destructive={'destructive' in item && item.destructive ? '' : undefined}
      onSelect={() => 'action' in item && item.action?.(actions)}
    >
      <ItemIcon item={item} icons={icons} />{'label' in item ? item.label : ''}
    </ContextMenu.Item>
  );
}

function DdItem({ item, actions, icons }: { item: MenuItem; actions: TabBarActions; icons: IconMap }) {
  if (item.type === 'separator') return <DropdownMenu.Separator className="context-menu-separator" />;
  if ('label' in item && item.label === '__swatches__') return <SwatchGrid item={item} actions={actions} />;
  if ('submenu' in item && item.submenu?.length) return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="context-menu-sub-trigger">
        <ItemIcon item={item} icons={icons} />{item.label}<span className="context-sub-arrow"><IconArrow /></span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className="context-menu-sub-content">
          {item.submenu.map((s, i) => <DdItem key={i} item={s} actions={actions} icons={icons} />)}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
  return (
    <DropdownMenu.Item
      className="context-menu-item" data-destructive={'destructive' in item && item.destructive ? '' : undefined}
      onSelect={() => 'action' in item && item.action?.(actions)}
    >
      <ItemIcon item={item} icons={icons} />{'label' in item ? item.label : ''}
    </DropdownMenu.Item>
  );
}

export function TabContextMenu({
  target, ctx, icons, buildMenuItems, children,
}: {
  target: ContextMenuTarget;
  ctx: MenuCtx;
  icons: IconMap;
  buildMenuItems: BuildMenuItems;
  children: React.ReactNode;
}) {
  const { actions, state } = useTabBarContext();
  const items = buildMenuItems(target, actions, state, ctx);
  if (!items.length) return <>{children}</>;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="context-menu-content">
          {items.map((item, i) => <CxItem key={i} item={item} actions={actions} icons={icons} />)}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export function DotsMenu({
  target, ctx, icons, buildMenuItems, triggerIcon, triggerClassName = 'tab-dots',
}: {
  target: ContextMenuTarget;
  ctx: MenuCtx;
  icons: IconMap;
  buildMenuItems: BuildMenuItems;
  triggerIcon: React.ReactNode;
  triggerClassName?: string;
}) {
  const { actions, state } = useTabBarContext();
  const items = buildMenuItems(target, actions, state, ctx);
  if (!items.length) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={triggerClassName}
          onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
          aria-label="More options"
        >
          {triggerIcon}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="context-menu-content" align="end">
          {items.map((item, i) => <DdItem key={i} item={item} actions={actions} icons={icons} />)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
