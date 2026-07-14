# react-tabstack

> Chrome-style tab bars for React — drag & drop sorting, tab groups, context menus. Headless, composable, TypeScript-first.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)

---

## Why react-tabstack?

Most tab libraries give you a styled, opinionated component you fight to customize. **react-tabstack** gives you low-level hooks that return `{ setNodeRef, attributes, listeners, style }` — just like dnd-kit — and you bring your own markup.

- **Headless** — zero styles by default, full control over your DOM
- **dnd-kit ergonomics** — hooks return spreadable primitives, not black-box components
- **Chrome-style groups** — drag tabs into groups, out of groups, between groups, sort groups
- **Context menus** — via Radix UI: ARIA-correct, keyboard navigable, fully customizable
- **Draggable by default** — opt out with `draggable={false}`, not opt in
- **Serializable state** — `JSON.stringify(state)` = complete session restore
- **TypeScript-first** — generic types for your tab/group metadata

---

## Packages

| Package | Description |
|---|---|
| `@react-tabstack/react` | Hooks, provider, everything you need |
| `@react-tabstack/core` | Types + pure reducer (no React dep) |
| `@react-tabstack/styles` | Optional pre-built CSS theme *(coming soon)* |

---

## Quick Start

```tsx
import { useState } from 'react';
import { TabBarProvider, useTabStrip, useTab, useTabPanel } from '@react-tabstack/react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import type { TabBarState } from '@react-tabstack/react';

const initialState: TabBarState = {
  tabs: {
    'home':     { id: 'home',     label: 'Home',     closable: true },
    'settings': { id: 'settings', label: 'Settings', closable: true },
  },
  groups: {},
  slots: [
    { type: 'tab', tabId: 'home' },
    { type: 'tab', tabId: 'settings' },
  ],
  activeTabId: 'home',
};

// ── Strip and Tab components using hooks ──────────────────────────────────────

function MyTab({ tabId }: { tabId: string }) {
  const { setNodeRef, attributes, listeners, style, isActive, activate, close } = useTab(tabId);

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={style} onClick={activate}>
      <span>{tabId}</span>
      <button onClick={(e) => { e.stopPropagation(); close(); }}>✕</button>
    </div>
  );
}

function MyStrip() {
  const { setNodeRef, slots, sortableIds } = useTabStrip();
  return (
    <div ref={setNodeRef} role="tablist">
      <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
        {slots.map((slot) =>
          slot.type === 'tab' && <MyTab key={slot.tabId} tabId={slot.tabId} />
        )}
      </SortableContext>
    </div>
  );
}

function MyPanel({ tabId }: { tabId: string }) {
  const { attributes } = useTabPanel(tabId);
  return <div {...attributes}>Content for {tabId}</div>;
}

// ── Root — controlled state pattern ──────────────────────────────────────────

export default function App() {
  const [state, setState] = useState(initialState);

  return (
    <TabBarProvider state={state} onStateChange={setState}>
      <MyStrip />
      <MyPanel tabId="home" />
      <MyPanel tabId="settings" />
    </TabBarProvider>
  );
}
```

---

## Hooks API

All hooks mirror dnd-kit: they return `{ setNodeRef, attributes, listeners, style }` that you spread onto your own elements.

### `useTab(tabId)`

```ts
const {
  setNodeRef,   // ref — attach to DOM node
  attributes,   // aria-*, role="tab", data-active, data-dragging, ...
  listeners,    // drag activation handlers (onPointerDown, etc.)
  style,        // { transform, transition } — apply as style prop

  isActive,     // boolean — is this tab selected?
  isDragging,   // boolean — is it being dragged?
  isOver,       // boolean — is another item hovering over it?

  activate,     // () => void — select this tab
  close,        // () => void — remove this tab
} = useTab('my-tab-id');
```

### `useTabGroup(groupId)`

```ts
const {
  setNodeRef, attributes, listeners, style,

  isOpen,       // dropdown is open
  isOver,       // a tab is being dragged over this pill
  isOverDwell,  // hover timer running — about to open
  tabs,         // Tab[] — ordered tabs in this group
  color,        // group accent color

  open, close, toggle, collapse, dissolve,  // actions
} = useTabGroup('my-group-id');
```

### `useGroupTab(tabId, groupId)`

```ts
const {
  setNodeRef, attributes, listeners, style,
  isActive, isDragging,
  activate, close,
  eject,    // () => void — move tab back to strip
} = useGroupTab('tab-id', 'group-id');
```

### `useTabStrip()`

```ts
const {
  setNodeRef,       // strip container ref
  slots,            // TabSlot[] — ordered items to render
  sortableIds,      // string[] — for <SortableContext items={...} />
  isDraggingOver,   // boolean
} = useTabStrip();
```

### `useTabPanel(tabId)`

```ts
const {
  isVisible,    // boolean — should content be shown?
  attributes,   // role="tabpanel", hidden, aria-labelledby
} = useTabPanel('tab-id');
```

---

## `<TabBarProvider>` Props

```tsx
<TabBarProvider
  state={state}                  // required — TabBarState
  onStateChange={setState}       // required — (state: TabBarState) => void

  groupHoverDelay={600}          // ms to hover before group opens during drag
  groupOpenOn="hover+click"      // 'hover' | 'click' | 'hover+click'

  onGroupEmpty={(groupId, actions) => { /* group has 0 tabs */ }}
  onDragEscape={(tabId, actions) => { /* tab dragged outside bar */ }}

  contextMenu={(target, actions) => {
    // target: { type: 'tab' | 'group' | 'group-tab' | 'strip', ... }
    // Return MenuItem[] | null
    if (target.type === 'tab') return [
      { label: 'Close',      action: () => actions.removeTab(target.tabId) },
      { label: 'Pin',        action: () => actions.pinTab(target.tabId) },
      { type: 'separator' },
      { label: 'Move to New Group',
        action: () => actions.createGroupFromTab(target.tabId, { id: 'g1', label: 'New Group' })
      },
    ];
  }}
/>
```

---

## Data Model

State is a plain, serializable object. Persist/restore sessions with `JSON.stringify` / `JSON.parse`.

```ts
interface TabBarState {
  tabs:        Record<string, Tab>;      // flat map of all tabs
  groups:      Record<string, TabGroup>; // flat map of all groups
  slots:       TabSlot[];                // ordered strip layout
  activeTabId: string | null;
}

type TabSlot =
  | { type: 'tab';   tabId: string }
  | { type: 'group'; groupId: string; tabIds: string[] };

interface Tab {
  id: string;
  label: string;
  closable?: boolean;
  pinned?: boolean;
  meta?: unknown;         // opaque — the library never reads this
}

interface TabGroup {
  id: string;
  label: string;
  color?: string;
  collapsed?: boolean;
  meta?: unknown;
}
```

---

## All Drag Interactions

| Drag source | Drop target | Result |
|---|---|---|
| Tab in strip | Strip (different position) | Reorder in strip |
| Tab in strip | Group pill (hover 600ms) | Opens dropdown → drop inside group |
| Tab in strip | Group pill (immediate drop) | Added as first tab in group |
| Tab in group dropdown | Strip | Ejected from group, inserted at position |
| Tab in group dropdown | Different group pill | Moved to that group |
| Tab in group dropdown | Same group dropdown | Reordered within group |
| Group pill | Strip (different position) | Reorder group in strip |
| Tab (pinned) | Pinned zone | Reorder within pinned zone only |
| Any | Outside tab bar | `onDragEscape` callback fires |

---

## Dev Scripts

```bash
pnpm dev           # start demo app (Vite HMR)
pnpm typecheck     # run tsc across all packages
pnpm lint          # ESLint check
pnpm lint:fix      # ESLint auto-fix
pnpm format        # Prettier format all files
pnpm format:check  # Prettier check (CI)
pnpm build         # build all packages
pnpm clean         # remove all dist/ folders
```

---

## Monorepo Structure

```
react-tabstack/
├── packages/
│   ├── core/          # types + pure reducer — zero React dependency
│   ├── react/         # hooks (useTab, useTabGroup, …) + TabBarProvider
│   └── styles/        # optional CSS custom property theme (coming soon)
└── demo/              # Vite + React interactive demo
```

---

## Roadmap

- [x] Horizontal tab strip with drag-to-sort
- [x] Tab groups — drag in/out/between
- [x] Context menus (Radix UI)
- [x] Pinned tabs
- [x] Serializable state
- [ ] Vertical orientation
- [ ] Overflow `<TabOverflowMenu>`
- [ ] `@react-tabstack/styles` pre-built theme
- [ ] `useTabKeyboardShortcuts` (Ctrl+T, Ctrl+W, Ctrl+Tab)
- [ ] Multi-bar drag (between two `<TabBarProvider>` instances)
- [ ] Storybook stories + docs site

---

## License

MIT
