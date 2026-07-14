# react-tabstack — Product Spec & Implementation Plan

## Overview

A headless, composable React library for building Chrome-style tab bars with:
- Horizontal and vertical orientations
- **Drag-and-drop on by default** — every tab and group is draggable unless explicitly opted out
- Tab groups (collapsible, sortable, color-coded) — Chrome-style
- Full drag interaction matrix: sort in strip, into group, out of group, between groups
- Context menus via **Radix UI** (headless, accessible, zero style opinion)
- Fully customizable rendering via render props / component slots

The design philosophy mirrors **dnd-kit** and **Mantine**: zero assumption about your styling, full control over rendering, robust hooks-first API, with an optional pre-styled layer for quick prototyping.

---

## Design Philosophy & Differentiators

| Goal | Decision |
|---|---|
| Zero style opinion | Headless core, optional `@react-tabstack/styles` addon |
| Composable, not monolithic | Fine-grained hooks + compound components |
| State ownership stays with user | Controlled-only model with optional `useTabState` hook |
| **dnd-kit** for DnD | Battle-tested, accessible, pointer/touch/keyboard sensors |
| **@radix-ui/react-context-menu** | Headless, ARIA-correct, keyboard nav, submenus — saves dev time |
| **Draggable by default** | Opt-out via `draggable={false}`, not opt-in |
| TypeScript-first | Full generic types everywhere |
| Framework-agnostic data model | Core state types are plain objects, no React dependency in model layer |

---

## Data Model

This is the most critical design decision. The model must be serializable and trivially diffable.

```ts
/** The atomic unit — a single tab */
interface Tab<TMeta = unknown> {
  id: string;
  label: string;
  icon?: ReactNode;
  closable?: boolean;
  pinned?: boolean;
  meta?: TMeta;           // user-defined payload, opaque to the library
}

/** A group is a named container of tabs */
interface TabGroup<TMeta = unknown> {
  id: string;
  label: string;
  color?: string;         // accent color for the group indicator
  collapsed?: boolean;
  meta?: TMeta;
}

/**
 * A "slot" is either a bare Tab or a Group.
 * The ordered list of slots defines the visible tab strip layout.
 */
type TabSlot =
  | { type: 'tab';   tabId: string }
  | { type: 'group'; groupId: string; tabIds: string[] };

/** Top-level state — owns everything */
interface TabBarState<TTabMeta = unknown, TGroupMeta = unknown> {
  tabs: Record<string, Tab<TTabMeta>>;
  groups: Record<string, TabGroup<TGroupMeta>>;
  /** Ordered sequence defining the strip layout */
  slots: TabSlot[];
  activeTabId: string | null;
}
```

### Why this model?

- **Flat maps + slot list** keeps re-renders surgical (only the changed slice updates).
- Groups don't need to be contiguous in the slot list — advanced layouts are possible.
- The `meta` escape hatch means the library never needs to know about your domain data.
- Serializing/restoring the full tab session is a one-liner (`JSON.stringify(state)`).

---

## Hook API — dnd-kit Ergonomics

The hook design mirrors dnd-kit exactly: hooks return **`{ attributes, listeners, setNodeRef, ... }`** that you spread onto your own DOM elements. The library never owns markup. Compound `<Tab*>` components are just thin conveniences over these hooks.

---

### `useTabState(initialState?)` — top-level state manager

Analogous to dnd-kit's `DndContext` but for tab data. Returns state slices and imperative action helpers.

```ts
const {
  // State slices (stable references, safe for memo)
  tabs,          // Record<string, Tab>
  groups,        // Record<string, TabGroup>
  slots,         // TabSlot[]  — ordered strip layout
  activeTabId,   // string | null

  // Dispatch (typed actions — easy to unit-test)
  dispatch,

  // Imperative helpers (same as dispatching actions, just ergonomic)
  addTab,              // (tab: Tab, position?: number) => void
  removeTab,           // (tabId: string) => void
  moveTab,             // (tabId: string, toIndex: number) => void
  setActiveTab,        // (tabId: string) => void
  addGroup,            // (group: TabGroup, position?: number) => void
  removeGroup,         // (groupId: string, opts?: { dissolve?: boolean }) => void
  addTabToGroup,       // (tabId: string, groupId: string, index?: number) => void
  removeTabFromGroup,  // (tabId: string) => void  — ejects to strip
  moveTabToGroup,      // (tabId: string, groupId: string, index?: number) => void
  collapseGroup,       // (groupId: string) => void
  expandGroup,         // (groupId: string) => void
  createGroupFromTab,  // (tabId: string, groupProps?: Partial<TabGroup>) => string (new groupId)
} = useTabState(initialState);
```

---

### `useTab(id)` — make any element a draggable tab

Mirrors `useSortable(id)` from dnd-kit.

```ts
const {
  // Spread onto your tab element:
  setNodeRef,    // ref callback — attach to DOM node
  attributes,    // aria-*, role="tab", tabIndex, etc.
  listeners,     // onPointerDown, onKeyDown (drag activation)
  style,         // { transform, transition } from dnd-kit transform

  // State booleans:
  isActive,      // is this the currently selected tab?
  isDragging,    // is this tab currently being dragged?
  isOver,        // is another draggable hovering over this tab?

  // Actions (pre-bound to this tab's id):
  activate,      // () => void  — set as active
  close,         // () => void  — remove tab
} = useTab('tab-1');

// Usage:
<div ref={setNodeRef} {...attributes} {...listeners} style={style}>
  {label}
</div>
```

---

### `useTabGroup(id)` — make any element a draggable group pill

```ts
const {
  setNodeRef,
  attributes,
  listeners,
  style,

  isOpen,        // is the group dropdown currently open?
  isDragging,
  isOver,        // is a tab being dragged over this pill?
  isOverDwell,   // has pointer been over this pill long enough to open dropdown?

  tabs,          // Tab[] — ordered tabs inside this group
  color,         // string — group accent color

  open,          // () => void
  close,         // () => void
  toggle,        // () => void
  collapse,      // () => void
  dissolve,      // () => void — ungroup all tabs, eject to strip
} = useTabGroup('group-1');
```

---

### `useGroupTab(tabId, groupId)` — tab inside a group dropdown

```ts
const {
  setNodeRef,
  attributes,
  listeners,
  style,

  isActive,
  isDragging,

  activate,
  close,
  eject,         // () => void — remove from group, insert into strip
} = useGroupTab('tab-2', 'group-1');
```

---

### `useTabStrip()` — the sortable container

```ts
const {
  setNodeRef,    // attach to the strip container div
  slots,         // TabSlot[] — the ordered list to render
  isDraggingOver, // something is being dragged over the strip
} = useTabStrip();

// Usage:
<div ref={setNodeRef}>
  {slots.map(slot =>
    slot.type === 'tab'
      ? <MyTab key={slot.tabId} id={slot.tabId} />
      : <MyGroup key={slot.groupId} id={slot.groupId} />
  )}
</div>
```

---

### `useTabPanel(tabId)` — content area for a tab

```ts
const {
  isVisible,     // true when this tab is active
  attributes,    // role="tabpanel", aria-labelledby, hidden (if not visible)
} = useTabPanel('tab-1');

// Usage:
<div {...attributes}>
  {children}
</div>
```

---

### `<TabBarProvider>` — the root context (wraps DndContext internally)

```tsx
<TabBarProvider
  state={tabState}           // pass state from useTabState or your own store
  onStateChange={setState}   // receive updated state
  groupHoverDelay={600}      // ms before a group opens on drag hover
  onGroupEmpty={dissolve}    // callback when a group's last tab is removed
  onDragEscape={handleTear}  // tab dragged outside bar bounds
  contextMenu={buildMenu}    // fn(target) => MenuItem[]
  sensors={customSensors}    // override dnd-kit sensors
  collisionDetection={fn}    // override collision detection
>
  {/* your layout */}
</TabBarProvider>
```

Internally this wraps `DndContext` and `SortableContext` from dnd-kit — users never need to import dnd-kit directly.

---

### Package structure (monorepo)

```
packages/
  core/           # TabBarState types, action creators, pure reducers — zero React
  react/          # All hooks (useTab, useTabGroup, etc.) + TabBarProvider
  styles/         # Optional pre-built CSS theme (CSS custom properties)
demo/             # Vite + React demo app
docs/             # Future docs site
```

---

## Drag & Drop Strategy

### Library: dnd-kit

Core packages used: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

### Draggable by Default

Every `<TabItem>` and `<TabGroupItem>` is draggable unless `draggable={false}` is passed. Pinned tabs are draggable but constrained (cannot move past the pinned zone boundary). The `<DragOverlay>` renders a clone of the dragged element as the ghost.

---

### Full Drag Interaction Matrix

This is the most complex part of the library. Every cell below must be handled.

#### DnD Item Types (what can be dragged)

| Type | Description |
|---|---|
| `tab` | A bare tab sitting in the strip |
| `group` | A group pill sitting in the strip |
| `group-tab` | A tab sitting *inside* an open group dropdown |

#### Drop Zone Types (where things can land)

| Zone | ID pattern | Accepts |
|---|---|---|
| Strip slot | `strip` | `tab`, `group`, `group-tab` (eject) |
| Between-item gap | `gap:before:{id}` | `tab`, `group` (precise placement) |
| Group pill | `group-pill:{groupId}` | `tab`, `group-tab` (add to group) |
| Group dropdown | `group-dropdown:{groupId}` | `tab`, `group-tab` (reorder inside group) |
| Group-tab slot | `group-slot:{groupId}:{index}` | `tab`, `group-tab` (precise inner sort) |

---

#### Interaction: Tab dragged in the strip

```
Drag source: tab (in strip)
Over strip slot → sort normally (closest-center)
Over group pill → [hover 600ms] → open dropdown → drop inside group
Over group pill → [drop immediately] → add as first tab of group
Over group dropdown → sort inside group (vertical nearest)
Drop on strip outside groups → finalize sort position
```

#### Interaction: Tab dragged out of a group

```
Drag source: group-tab (inside open dropdown)
Move pointer out of dropdown vertically →
  if pointer crosses dropdown boundary:
    phantom tab appears in strip at nearest position
    drop on strip → eject from group, insert at strip position
    drop back inside dropdown → re-sort within group
If group becomes empty after eject → auto-dissolve group (configurable: onGroupEmpty callback)
```

#### Interaction: Tab dragged into a different group

```
Drag source: group-tab from group A
Hover over group-pill B for 600ms → group B dropdown opens
Drop inside group B dropdown → move tab from A to B
If group A becomes empty → fire onGroupEmpty(groupId)
```

#### Interaction: Group pill dragged in strip

```
Drag source: group (entire group pill)
Sort among other tabs and groups in strip (same SortableContext)
Cannot be dropped inside another group
Drag overlay shows the group pill label + count badge
```

#### Interaction: Tab dragged over a closed group pill (no hover delay)

```
Pointer enters group pill → start 600ms timer
Pointer leaves before 600ms → cancel timer, treat as strip sort target
Pointer stays 600ms → group dropdown opens, inner SortableContext activates
Pointer in dropdown → nearest group-slot highlighted
Drop → insert at that slot index
```

#### Interaction: Pinned tab dragging

```
Pinned tabs form a locked zone at the left/top of the strip
Can be reordered only within the pinned zone
Cannot be dragged past the pinned/unpinned boundary
Unpinned tabs cannot be dragged into the pinned zone
```

#### Interaction: Drag outside the TabBar entirely

```
Pointer leaves TabBar bounds → onDragEscape(tabId) callback fires
User can implement "tear off to new window" behavior in this callback
By default: drag is cancelled if pointer is released outside
```

---

### Sensors

```ts
useSensor(PointerSensor, {
  activationConstraint: { distance: 5 }  // 5px threshold to avoid accidental drags on click
})
useSensor(KeyboardSensor)   // full keyboard DnD support via dnd-kit
useSensor(TouchSensor, {
  activationConstraint: { delay: 250, tolerance: 5 }
})
```

### Collision Detection

We'll use a **custom collision detector** (dnd-kit allows this) that:

1. First checks `pointerWithin` against all open group dropdowns (highest priority).
2. Then checks `pointerWithin` against group pills in strip.
3. Falls back to `closestCenter` for strip-level sorting.

This layered priority ensures group pills don't accidentally intercept strip sorts when the pointer is only near (not over) a pill.

### DragOverlay

A single `<DragOverlay>` at the `TabBarProvider` level renders the drag ghost. The ghost is a clone of the dragged element (tab or group pill) with `pointer-events: none` and a subtle scale + shadow animation.

We expose a `renderDragOverlay` render prop so users can fully customize the ghost appearance.

---

### Group Dropdown Hover Logic (detailed)

Implemented as a ref-based timer inside `useTabGroup`:

```
onDragOver(groupPillId):
  if (no timer running) startTimer(groupHoverDelay, openDropdown)
onDragLeave(groupPillId):
  clearTimer()
  if (pointer not inside dropdown) closeDropdown()
onDragEnd:
  closeAllDropdowns()
  clearAllTimers()
```

This is coordinated via a shared `DragStateContext` that all group pills subscribe to — they all close when any drop completes.

### `groupHoverDelay` prop (default: 600ms)

Exposed on `<TabBarProvider>`. Set to `0` for instant open, `Infinity` to require click.

---

## Context Menu Architecture

**Package: `@radix-ui/react-context-menu`** (headless, ARIA-correct, keyboard navigable, submenu support built-in).

Reasons over hand-rolling:
- Full keyboard nav (arrow keys, Home/End, typeahead) out of the box.
- Correct `role="menu"` / `role="menuitem"` ARIA tree.
- Focus trap + escape handling.
- Submenu positioning with collision avoidance already solved.
- Saves 1-2 days of tricky positioning/focus work.
- It is completely headless — we style it ourselves, zero visual opinion.

### API

We wrap Radix's primitives behind our own clean declarative API so users never touch Radix directly:

```tsx
<TabBarProvider
  contextMenu={(target) => {
    if (target.type === 'tab') return [
      { label: 'Close Tab',  action: ({ removeTab }) => removeTab(target.id) },
      { label: 'Pin Tab',    action: ({ pinTab })   => pinTab(target.id) },
      { type: 'separator' },
      { label: 'Add to Group', submenu: groups.map(g => ({
          label: g.label,
          action: ({ addTabToGroup }) => addTabToGroup(target.id, g.id)
        }))
      },
      { label: 'Move to New Group', action: ({ createGroupFromTab }) => createGroupFromTab(target.id) },
    ];
    if (target.type === 'group') return [
      { label: 'Rename Group',   action: ({ renameGroup }) => renameGroup(target.id) },
      { label: 'Ungroup All',    action: ({ dissolveGroup }) => dissolveGroup(target.id) },
      { label: 'Close Group',    action: ({ removeGroup }) => removeGroup(target.id) },
      { type: 'separator' },
      { label: 'Color',          submenu: COLOR_OPTIONS },
    ];
    if (target.type === 'strip') return [
      { label: 'New Tab', action: ({ addTab }) => addTab() },
    ];
  }}
/>
```

- `contextMenu` receives a `ContextMenuTarget` discriminated union and returns `MenuItem[]`.
- Action functions receive the full `TabBarActions` object — same as `useTabState` exposes.
- `type: 'separator'` renders a `<ContextMenu.Separator>`.
- Submenus are recursive (just nest `submenu` arrays).
- Users can render completely custom items via `renderItem` escape hatch.

### Context menu on the strip background

Right-clicking the empty strip background (not a tab, not a group) fires `target.type === 'strip'`, useful for "New Tab" or "Paste and go" style actions.

---

## Full Feature List (MVP Scope)

### Phase 1 — Core Foundation
- [ ] `TabBarState` type definitions + `useTabState` hook
- [ ] `TabBarProvider` with dnd-kit + Radix context wiring
- [ ] Horizontal tab strip with drag-to-sort (tabs + groups in same `SortableContext`)
- [ ] `<DragOverlay>` with ghost rendering + `renderDragOverlay` prop
- [ ] Active tab highlighting + `onActiveTabChange`
- [ ] `<TabPanel>` (hide/show via CSS by default, `unmountOnHide` opt-in)
- [ ] `onStateChange` controlled model
- [ ] Context menu on tabs (close, pin) via Radix
- [ ] Context menu on strip background (new tab)
- [ ] Vite demo app

### Phase 2 — Tab Groups (the hard part)
- [ ] Group pill rendering in strip (within same `SortableContext` as tabs)
- [ ] Group dropdown (vertical `SortableContext` scoped to group)
- [ ] **Drag tab → group pill** (hover 600ms opens dropdown)
- [ ] **Drag group-tab → strip** (eject from group)
- [ ] **Drag group-tab → different group** (cross-group move)
- [ ] **Drag group → sort in strip** (move entire group)
- [ ] `onGroupEmpty` callback (auto-dissolve or keep empty — configurable)
- [ ] Collapse/expand groups
- [ ] Group color accent
- [ ] Context menu for groups (rename, ungroup, close, color picker)
- [ ] `groupHoverDelay` prop

### Phase 3 — Polish & Robustness
- [ ] Vertical tab bar orientation
- [ ] Pinned tabs (locked zone, constrained drag)
- [ ] Keyboard navigation (arrow keys between tabs, Enter/Space activate)
- [ ] `onDragEscape` callback (tab dragged outside bar → "tear off" support)
- [ ] Overflow: `<TabOverflowMenu>` dropdown when strip is full
- [ ] Tab close animation
- [ ] `@react-tabstack/styles` pre-built theme (CSS custom properties)
- [ ] Full ARIA roles (`role="tablist"`, `role="tab"`, `aria-selected`)
- [ ] SSR compatibility audit
- [ ] `renderDragOverlay` render prop

### Phase 4 — Ecosystem
- [ ] Docs site
- [ ] Storybook stories
- [ ] `useTabKeyboardShortcuts` hook (Ctrl+T, Ctrl+W, Ctrl+Tab)
- [ ] Multi-tab-bar DnD (drag tab between two `<TabBar>` instances)

---

## Resolved Decisions

| Question | Decision |
|---|---|
| Context menus | ✅ `@radix-ui/react-context-menu` — headless, no styling imposed |
| DnD library | ✅ `@dnd-kit/core` + `@dnd-kit/sortable` |
| Draggable by default | ✅ Opt-out via `draggable={false}` |
| Group hover delay | ✅ 600ms default, exposed as `groupHoverDelay` prop |

## Open Questions for User Review

> [!IMPORTANT]
> **Q1 — Group dropdown outside of drag: hover-open vs click-open?**
> During a drag, hover-open after 600ms is clearly the right default. When the user is just *browsing* (no drag), should clicking the group pill open the dropdown (Chrome), or hovering? Or should `openOn` be a per-group prop (`'hover' | 'click' | 'drag-only'`)?

> [!IMPORTANT]
> **Q2 — `onGroupEmpty` default?**
> When the last tab is dragged out of a group: auto-dissolve group (Chrome behavior), or fire `onGroupEmpty` and let the user decide? I lean toward `onGroupEmpty` callback with auto-dissolve as the default, opt-out via `dissolveOnEmpty={false}`.

> [!NOTE]
> **Q3 — Naming?**
> Working name: `react-tabstack`. Alternatives: `tabflow`, `tabkit`, `react-tab-groups`. Open to suggestions.

---

## First Steps After Approval

1. `pnpm init` monorepo (pnpm workspaces)
2. Scaffold `packages/core` — TypeScript, Vitest, no React dep in core types
3. Scaffold `packages/react` — React component layer
4. Scaffold `demo/` — Vite + React, show all interactions live
5. Implement `TabBarState` types + action creators + `useTabState`
6. `TabBarProvider`: wire dnd-kit `DndContext` + `DragOverlay` + Radix context
7. Phase 1 strip with `SortableContext` (tabs + groups in same list)
8. Phase 2 group pill + dropdown + all drag interactions
9. Demo: showcase every drag scenario with labeled examples

## Dependencies Summary

```json
{
  "@dnd-kit/core": "^6",
  "@dnd-kit/sortable": "^8",
  "@dnd-kit/utilities": "^3",
  "@radix-ui/react-context-menu": "^2"
}
```

Peer deps: `react >= 18`, `react-dom >= 18`.
