import type { MouseEvent } from 'react';

function Code({ children }: { children: string }) {
  return <pre className="docs-code">{children}</pre>;
}

function PropsTable({ rows }: { rows: { name: string; type: string; default?: string; description: string }[] }) {
  return (
    <table className="docs-table">
      <thead>
        <tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td><code>{r.name}</code></td>
            <td className="docs-table-type">{r.type}</td>
            <td className="docs-table-type">{r.default ?? '—'}</td>
            <td>{r.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DocsSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="docs-section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const HOOKS = [
  { name: 'useTabState(initialState?)', description: 'Batteries-included: a reducer plus every action, for uncontrolled usage without wiring your own state.' },
  { name: 'useTab(tabId)', description: 'Make a DOM node a draggable, sortable, selectable tab in the top-level strip.' },
  { name: 'useTabGroup(groupId)', description: "A draggable group pill: open/collapsed state, hover/combine state, this group's ordered tabs." },
  { name: 'useGroupTab(tabId, groupId)', description: "A tab rendered inside an open group's dropdown — same drag identity as useTab." },
  { name: 'useTabStrip()', description: 'The strip container: ordered slots, sortable ids/strategy, scroll-overflow state.' },
  { name: 'useTabPanel(tabId)', description: 'Visibility + ARIA attributes for a tab\'s content panel.' },
  { name: 'useStickyPosition(ref, active)', description: "rAF-tracked viewport position for a trigger element — for positioning a portalled dropdown that won't drift during drag-driven reflow." },
  { name: 'useTabBarContext()', description: 'Escape hatch: the full context value (state, actions, orientation, dwell, dropdown coordinator, …) for building custom components.' },
];

const PROVIDER_PROPS = [
  { name: 'state / onStateChange', type: 'TabBarState / (s) => void', description: 'Controlled state, like <input>. Required.' },
  { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", description: 'Strip layout axis.' },
  { name: 'dwell', type: '{ open?, close?: number }', default: '{ open: 150, close: 300 }', description: 'Hover/drag-hover delay before a group dropdown opens or closes.' },
  { name: 'groupOpenOn', type: "'hover' | 'click' | 'hover+click'", default: "'hover+click'", description: 'How a group opens outside a drag. Overridable per-group.' },
  { name: 'dissolveEmptyGroups', type: 'boolean', default: 'false', description: "Default for a group's dissolveOnEmpty when it doesn't set its own." },
  { name: 'autoScroll', type: 'boolean', default: 'true', description: 'Auto-scroll the strip when a drag reaches its edge.' },
  { name: 'onGroupEmpty', type: '(groupId, actions) => void', description: 'Fires when a group transitions from having tabs to having none.' },
  { name: 'onDragEscape', type: '(tabId, actions) => void', description: 'Fires when a tab is released outside the bar — e.g. to tear off a new window.' },
  { name: 'contextMenu', type: '(target, actions) => MenuItem[] | null', description: 'Build a context menu for a right-click target. Fully consumer-rendered.' },
  { name: 'renderDragOverlay', type: '(id, data) => ReactNode', description: 'The drag ghost. No default styling — a headless library shouldn\'t guess your theme.' },
];

const TAB_FIELDS = [
  { name: 'id / label', type: 'string', description: 'Required.' },
  { name: 'closable', type: 'boolean', description: 'Show a close affordance — rendering is up to you.' },
  { name: 'pinned', type: 'boolean', description: 'Locked to the front of the strip; mutually exclusive with group membership.' },
  { name: 'draggable', type: 'boolean', default: 'true', description: 'Opt a single tab out of dragging.' },
  { name: 'meta', type: 'TMeta', description: 'Opaque escape hatch — the library never reads it.' },
];

const GROUP_FIELDS = [
  { name: 'id / label', type: 'string', description: 'Required.' },
  { name: 'color', type: 'string', description: 'CSS color — the library never applies it, your components read it.' },
  { name: 'collapsed', type: 'boolean', description: "Persistent collapse flag, read back via useTabGroup()'s own collapsed field — independent of the dropdown coordinator's isOpen. See “Group presentation” below." },
  { name: 'draggable', type: 'boolean', default: 'true', description: 'Opt this one group out of dragging.' },
  { name: 'openOn', type: "'hover' | 'click' | 'hover+click'", description: 'Per-group override of the provider default.' },
  { name: 'dissolveOnEmpty', type: 'boolean', description: "Per-group override of the provider's dissolveEmptyGroups." },
];

// Plain hash anchors would hand window.location.hash to the app's own
// page router (App.tsx), which treats anything not starting with "#docs"
// as "navigate to the examples page" — so a docs nav click bounced you
// straight off the docs page instead of scrolling. Scroll manually instead
// and leave the URL hash (and page router) alone.
function scrollToSection(id: string) {
  return (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

export default function DocsPage() {
  return (
    <div className="docs-body">
      <nav className="docs-nav">
        <a href="#overview" onClick={scrollToSection('overview')}>Overview</a>
        <a href="#install" onClick={scrollToSection('install')}>Install</a>
        <a href="#quick-start" onClick={scrollToSection('quick-start')}>Quick start</a>
        <a href="#data-model" onClick={scrollToSection('data-model')}>Data model</a>
        <a href="#hooks" onClick={scrollToSection('hooks')}>Hooks</a>
        <a href="#provider" onClick={scrollToSection('provider')}>Provider</a>
        <a href="#config" onClick={scrollToSection('config')}>Tab / group options</a>
        <a href="#group-presentation" onClick={scrollToSection('group-presentation')}>Group presentation</a>
      </nav>

      <div className="docs-content">
        <DocsSection id="overview" title="Overview">
          <p>
            react-tabstack is a headless, hooks-first tab bar library. Every hook returns
            <code> {'{ setNodeRef, attributes, listeners, style }'} </code>
            — the same shape dnd-kit's own <code>useSortable</code> returns — for you to spread onto your own markup. The library never
            renders a single DOM node itself; the six examples on the previous page all share the exact same hooks with entirely
            different presentation layers.
          </p>
        </DocsSection>

        <DocsSection id="install" title="Install">
          <Code>{`pnpm add @react-tabstack/react @react-tabstack/core\n# peer deps: react >=18, react-dom >=18`}</Code>
        </DocsSection>

        <DocsSection id="quick-start" title="Quick start">
          <Code>{`import { useState } from 'react';
import { TabBarProvider, useTab, useTabStrip } from '@react-tabstack/react';
import { SortableContext } from '@dnd-kit/sortable';

function Tab({ tabId }) {
  const { setNodeRef, attributes, listeners, style, activate } = useTab(tabId);
  return <div ref={setNodeRef} {...attributes} {...listeners} style={style} onClick={activate} />;
}

function Strip() {
  const { setNodeRef, attributes, slots, sortableIds, sortStrategy, sortableContextId } = useTabStrip();
  return (
    <div ref={setNodeRef} {...attributes}>
      <SortableContext id={sortableContextId} items={sortableIds} strategy={sortStrategy}>
        {slots.map(s => s.type === 'tab' && <Tab key={s.tabId} tabId={s.tabId} />)}
      </SortableContext>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(initialState);
  return (
    <TabBarProvider state={state} onStateChange={setState}>
      <Strip />
    </TabBarProvider>
  );
}`}</Code>
        </DocsSection>

        <DocsSection id="data-model" title="Data model">
          <p>Plain, serializable — persisting or restoring a session is <code>JSON.stringify(state)</code>.</p>
          <Code>{`interface TabBarState {
  tabs: Record<string, Tab>;
  groups: Record<string, TabGroup>;
  slots: TabSlot[];       // ordered strip layout; a group's tabIds live inline
  activeTabId: string | null;
}

type TabSlot =
  | { type: 'tab'; tabId: string }
  | { type: 'group'; groupId: string; tabIds: string[] };`}</Code>
        </DocsSection>

        <DocsSection id="hooks" title="Hooks">
          <table className="docs-table">
            <tbody>
              {HOOKS.map((h) => (
                <tr key={h.name}>
                  <td><code>{h.name}</code></td>
                  <td>{h.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocsSection>

        <DocsSection id="provider" title="<TabBarProvider> props">
          <PropsTable rows={PROVIDER_PROPS} />
        </DocsSection>

        <DocsSection id="config" title="Tab / group options">
          <p>Configuration lives on the data itself, not scattered provider flags — it serializes and travels with the entity.</p>
          <h3 className="docs-subhead">Tab</h3>
          <PropsTable rows={TAB_FIELDS} />
          <h3 className="docs-subhead">TabGroup</h3>
          <PropsTable rows={GROUP_FIELDS} />
        </DocsSection>

        <DocsSection id="group-presentation" title="Group presentation: dropdown vs. inline">
          <p>
            There's no separate API for this — <code>useTabGroup</code> and <code>useGroupTab</code> are the exact same hooks
            whether a group's tabs render in a floating dropdown ("Tab groups") or expand inline in the strip itself,
            Chrome-style ("Inline groups"). What differs is (1) which state drives visibility, and (2) how you wire up the
            container that represents a group's expanded content.
          </p>

          <h3 className="docs-subhead">Two independent "is this group's content visible" flags</h3>
          <PropsTable rows={[
            { name: 'isOpen', type: 'boolean · useTabGroup()', description: 'Driven by the hover/drag-hover dropdown coordinator (dwell timers, only one group open at a time). Use it for a floating dropdown.' },
            { name: 'collapsed', type: 'boolean · useTabGroup()', description: "The group's own persistent TabGroup.collapsed field, toggled explicitly via collapse()/expand() and unaffected by hover. Use it for an inline, always-mounted presentation." },
          ]} />
          <p>You can use either, both, or neither — nothing about them conflicts, they're just two independent mechanisms for the same underlying question.</p>

          <h3 className="docs-subhead">The container-droppable contract</h3>
          <p>
            Wherever you render a group's expanded content, collision detection needs one <code>useDroppable</code> registered
            for that container carrying <code>type: 'group-dropdown'</code> and the group's id. That's the whole contract —
            the id string you give the droppable itself is never inspected, so name and place it however your layout needs.
            It's what lets a drag resolve precise placement inside the container (nearest item by pointer position) instead of
            only "somewhere in this group."
          </p>
          <Code>{`const { setNodeRef } = useDroppable({
  id: 'anything-you-want',   // not read by collision detection
  data: { type: 'group-dropdown', groupId },
});`}</Code>

          <h3 className="docs-subhead">Laying members out horizontally instead of vertically</h3>
          <p>
            A dropdown list's members are usually a vertical <code>SortableContext</code>; an inline group's are a horizontal
            row instead — pass <code>horizontalListSortingStrategy</code> rather than the vertical one. And put the drag
            registration (<code>useTabGroup</code>'s <code>setNodeRef</code>/<code>style</code>) on the element representing
            the group's <em>full visual footprint</em> — label plus members — not just a small handle inside it. dnd-kit only
            measures and repositions whatever node <code>setNodeRef</code> is attached to during a drag; attaching it to a
            small handle while the rest of the group sits in a larger sibling element makes that larger part visually lag
            behind the handle mid-drag. Drag <em>activation</em> (<code>listeners</code>) can still be scoped to just the
            handle — only the sizing/positioning ref needs to cover the whole thing.
          </p>
        </DocsSection>
      </div>
    </div>
  );
}
