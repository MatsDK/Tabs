import DefaultExample from './examples/default/DefaultExample.js';
import MarpleExample from './examples/marple/MarpleExample.js';
import MinimalExample from './examples/minimal/MinimalExample.js';
import type { TabBarState } from '@react-tabstack/react';

const VERTICAL_STATE: TabBarState = {
  tabs: {
    'v-1': { id: 'v-1', label: 'Inbox', closable: true, pinned: true },
    'v-2': { id: 'v-2', label: 'Drafts', closable: true },
    'v-3': { id: 'v-3', label: 'Sent', closable: true },
    'v-4': { id: 'v-4', label: 'Spam', closable: true },
    'v-5': { id: 'v-5', label: 'Archive', closable: true },
  },
  groups: {
    'v-g1': { id: 'v-g1', label: 'Projects', color: '#bc8cff' },
  },
  slots: [
    { type: 'tab', tabId: 'v-1' },
    { type: 'tab', tabId: 'v-2' },
    { type: 'group', groupId: 'v-g1', tabIds: ['v-3', 'v-4'] },
    { type: 'tab', tabId: 'v-5' },
  ],
  activeTabId: 'v-1',
};

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="showcase-section">
      <header className="showcase-section-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <div className="showcase-section-body">{children}</div>
    </section>
  );
}

export default function App() {
  return (
    <div className="demo-root">
      <header className="demo-header">
        <div className="demo-header-logo">
          <span>⬡</span> react-tabstack
          <span className="demo-header-logo-badge">MVP</span>
        </div>
        <span className="demo-header-desc">Headless, composable Chrome-style tab bars — drag &amp; drop, groups, context menus, orientation</span>
      </header>
      <main className="demo-body showcase-body">
        <Section
          title="Horizontal — full feature set"
          description={'Default headless styling. Groups, pinned tabs, a non-draggable tab, context menus, inline rename.'}
        >
          <DefaultExample orientation="horizontal" />
        </Section>

        <Section
          title="Vertical orientation"
          description="Same hooks, same data model — orientation is a single prop. Useful for sidebar-style tab lists."
        >
          <div className="showcase-vertical-frame">
            <DefaultExample orientation="vertical" initialState={VERTICAL_STATE} hint="Drag to sort · hover/click groups · double-click to rename" />
          </div>
        </Section>

        <Section
          title="Marple Insight visual theme"
          description="A completely separate set of presentational components and CSS, reusing the exact same hooks — proving the headless core doesn't need to change to hit a specific visual target."
        >
          <div className="showcase-marple-frame">
            <MarpleExample />
          </div>
        </Section>

        <Section
          title="Minimal / headless"
          description="No styling opinion at all — just the hooks, spread onto plain divs. This is the actual surface area a consumer starts from."
        >
          <MinimalExample />
        </Section>
      </main>
    </div>
  );
}
