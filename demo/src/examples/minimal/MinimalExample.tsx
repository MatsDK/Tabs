import { useState } from 'react';
import { TabBarProvider, useTab, useTabBarContext, useTabStrip } from '@react-tabstack/react';
import { SortableContext } from '@dnd-kit/sortable';
import type { TabBarState } from '@react-tabstack/react';

const INITIAL_STATE: TabBarState = {
  tabs: {
    m1: { id: 'm1', label: 'Alpha' },
    m2: { id: 'm2', label: 'Beta' },
    m3: { id: 'm3', label: 'Gamma' },
  },
  groups: {},
  slots: [{ type: 'tab', tabId: 'm1' }, { type: 'tab', tabId: 'm2' }, { type: 'tab', tabId: 'm3' }],
  activeTabId: 'm1',
};

function MinimalTab({ tabId }: { tabId: string }) {
  const { state } = useTabBarContext();
  const { setNodeRef, attributes, listeners, style, isActive, activate } = useTab(tabId);
  return (
    <div
      ref={setNodeRef} {...(attributes as any)} {...(listeners as any)}
      style={{
        ...style,
        padding: '4px 12px',
        border: isActive ? '1px solid #333' : '1px solid #ccc',
        borderRadius: 4,
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontSize: 12,
      }}
      onClick={activate}
    >
      {state.tabs[tabId]?.label}
    </div>
  );
}

function MinimalStrip() {
  const { setNodeRef, attributes, slots, sortableIds, sortStrategy } = useTabStrip();
  return (
    <div ref={setNodeRef} {...(attributes as any)} style={{ display: 'flex', gap: 6 }}>
      <SortableContext items={sortableIds} strategy={sortStrategy}>
        {slots.map((s) => (s.type === 'tab' ? <MinimalTab key={s.tabId} tabId={s.tabId} /> : null))}
      </SortableContext>
    </div>
  );
}

export default function MinimalExample() {
  const [state, setState] = useState<TabBarState>(INITIAL_STATE);
  return (
    <TabBarProvider state={state} onStateChange={setState}>
      <MinimalStrip />
    </TabBarProvider>
  );
}
