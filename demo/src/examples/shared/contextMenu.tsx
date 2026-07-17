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
//   - `classNames`: each example's own visual theme has its own class-naming
//     convention (index.css's .context-menu-*, marple-theme.css's .mi-menu-*,
//     …) — defaults to the .context-menu-* set so existing callers need no
//     changes, override per-example for anything else.
//   - `ctx.focusGroup`: what "reveal this group" means in this example's
//     presentation (open a dropdown vs. expand inline) — see useFocusGroup.
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

export interface MenuClassNames {
  content: string;
  item: string;
  itemIcon: string;
  separator: string;
  subTrigger: string;
  subContent: string;
  subArrow: string;
  swatches: string;
  swatch: string;
}

const DEFAULT_CLASSES: MenuClassNames = {
  content: 'context-menu-content',
  item: 'context-menu-item',
  itemIcon: 'context-menu-item-icon',
  separator: 'context-menu-separator',
  subTrigger: 'context-menu-sub-trigger',
  subContent: 'context-menu-sub-content',
  subArrow: 'context-sub-arrow',
  swatches: 'context-menu-swatches',
  swatch: 'context-menu-swatch',
};

const IconArrow = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4h4M4 2l2 2-2 2" />
  </svg>
);

function ItemIcon({ item, icons, cls }: { item: MenuItem; icons: IconMap; cls: MenuClassNames }) {
  if (item.type === 'separator' || item.type === 'label' || !('icon' in item) || !item.icon) return null;
  return <span className={cls.itemIcon}>{icons[item.icon]}</span>;
}

/** A "__swatches__"-labeled item renders as a grid of clickable color dots
 *  instead of a normal row — each sub-item's `label` is the CSS color value
 *  and an `icon: 'active'` marks the currently-selected one. */
function SwatchGrid({ item, actions, cls }: { item: MenuItem; actions: TabBarActions; cls: MenuClassNames }) {
  if (!('submenu' in item) || !item.submenu) return null;
  return (
    <div className={cls.swatches}>
      {item.submenu.map((s, i) => (
        <button
          key={i} type="button" className={cls.swatch}
          data-active={'icon' in s && s.icon === 'active' ? '' : undefined}
          style={{ background: 'label' in s ? s.label : undefined }}
          onClick={() => 'action' in s && s.action?.(actions)}
          aria-label={'label' in s ? s.label : 'Color'}
        />
      ))}
    </div>
  );
}

function CxItem({ item, actions, icons, cls }: { item: MenuItem; actions: TabBarActions; icons: IconMap; cls: MenuClassNames }) {
  if (item.type === 'separator') return <ContextMenu.Separator className={cls.separator} />;
  if ('label' in item && item.label === '__swatches__') return <SwatchGrid item={item} actions={actions} cls={cls} />;
  if ('submenu' in item && item.submenu?.length) return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger className={cls.subTrigger}>
        <ItemIcon item={item} icons={icons} cls={cls} />{item.label}<span className={cls.subArrow}><IconArrow /></span>
      </ContextMenu.SubTrigger>
      <ContextMenu.Portal>
        <ContextMenu.SubContent className={cls.subContent}>
          {item.submenu.map((s, i) => <CxItem key={i} item={s} actions={actions} icons={icons} cls={cls} />)}
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
  return (
    <ContextMenu.Item
      className={cls.item} data-destructive={'destructive' in item && item.destructive ? '' : undefined}
      onSelect={() => 'action' in item && item.action?.(actions)}
    >
      <ItemIcon item={item} icons={icons} cls={cls} />{'label' in item ? item.label : ''}
    </ContextMenu.Item>
  );
}

function DdItem({ item, actions, icons, cls }: { item: MenuItem; actions: TabBarActions; icons: IconMap; cls: MenuClassNames }) {
  if (item.type === 'separator') return <DropdownMenu.Separator className={cls.separator} />;
  if ('label' in item && item.label === '__swatches__') return <SwatchGrid item={item} actions={actions} cls={cls} />;
  if ('submenu' in item && item.submenu?.length) return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className={cls.subTrigger}>
        <ItemIcon item={item} icons={icons} cls={cls} />{item.label}<span className={cls.subArrow}><IconArrow /></span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent className={cls.subContent}>
          {item.submenu.map((s, i) => <DdItem key={i} item={s} actions={actions} icons={icons} cls={cls} />)}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  );
  return (
    <DropdownMenu.Item
      className={cls.item} data-destructive={'destructive' in item && item.destructive ? '' : undefined}
      onSelect={() => 'action' in item && item.action?.(actions)}
    >
      <ItemIcon item={item} icons={icons} cls={cls} />{'label' in item ? item.label : ''}
    </DropdownMenu.Item>
  );
}

export function TabContextMenu({
  target, ctx, icons, buildMenuItems, classNames, children,
}: {
  target: ContextMenuTarget;
  ctx: MenuCtx;
  icons: IconMap;
  buildMenuItems: BuildMenuItems;
  classNames?: Partial<MenuClassNames>;
  children: React.ReactNode;
}) {
  const { actions, state } = useTabBarContext();
  const items = buildMenuItems(target, actions, state, ctx);
  const cls = classNames ? { ...DEFAULT_CLASSES, ...classNames } : DEFAULT_CLASSES;
  if (!items.length) return <>{children}</>;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={cls.content}>
          {items.map((item, i) => <CxItem key={i} item={item} actions={actions} icons={icons} cls={cls} />)}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export function DotsMenu({
  target, ctx, icons, buildMenuItems, classNames, triggerIcon, triggerClassName = 'tab-dots',
}: {
  target: ContextMenuTarget;
  ctx: MenuCtx;
  icons: IconMap;
  buildMenuItems: BuildMenuItems;
  classNames?: Partial<MenuClassNames>;
  triggerIcon: React.ReactNode;
  triggerClassName?: string;
}) {
  const { actions, state } = useTabBarContext();
  const items = buildMenuItems(target, actions, state, ctx);
  const cls = classNames ? { ...DEFAULT_CLASSES, ...classNames } : DEFAULT_CLASSES;
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
        <DropdownMenu.Content className={cls.content} align="end">
          {items.map((item, i) => <DdItem key={i} item={item} actions={actions} icons={icons} cls={cls} />)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
