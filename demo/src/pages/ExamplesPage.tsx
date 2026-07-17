import MinimalExample from '../examples/minimal/MinimalExample.js';
import BasicExample from '../examples/basic/BasicExample.js';
import DefaultExample from '../examples/default/DefaultExample.js';
import MarpleExample from '../examples/marple/MarpleExample.js';
import type { TabBarState } from '@react-tabstack/react';

const VERTICAL_STATE: TabBarState = {
  tabs: {
    'v-1': { id: 'v-1', label: 'Inbox', closable: true },
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

function Section({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="showcase-section">
      <header className="showcase-section-header">
        <span className="showcase-index">{index}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="showcase-section-body">{children}</div>
    </section>
  );
}

export default function ExamplesPage() {
  return (
    <div className="showcase-body">
      <Section
        index={1}
        title="Headless"
        description="No styling opinion at all — the hooks spread onto plain divs. This is the actual surface area every example below builds on."
      >
        <MinimalExample />
      </Section>

      <Section
        index={2}
        title="Sortable strip"
        description="A styled, draggable, sortable list of tabs. No groups yet — just useTab + useTabStrip."
      >
        <BasicExample />
      </Section>

      <Section
        index={3}
        title="Tab groups"
        description="Drag tabs into and out of groups, sort within a group's dropdown, rename inline, right-click or ⋮ for context menus. One tab is draggable={false}."
      >
        <DefaultExample orientation="horizontal" />
      </Section>

      <Section index={4} title="Vertical orientation" description="Same hooks, same data model — orientation is a single prop on TabBarProvider.">
        <div className="showcase-vertical-frame">
          <DefaultExample orientation="vertical" initialState={VERTICAL_STATE} hint="Drag to sort · hover/click groups · double-click to rename" />
        </div>
      </Section>

      <Section
        index={5}
        title="Custom visual theme"
        description="A completely separate set of presentational components and CSS, built from the exact same hooks as example 3 — proving the headless core doesn't change to hit a specific visual target."
      >
        <div className="showcase-marple-frame">
          <MarpleExample />
        </div>
      </Section>
    </div>
  );
}
