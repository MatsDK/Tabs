import { useState } from 'react';
import { TabBarProvider, useTab, useTabBarContext, useTabStrip } from '@react-tabstack/react';
import { SortableContext } from '@dnd-kit/sortable';
import type { TabBarState, TabSlot } from '@react-tabstack/react';

const INITIAL_STATE: TabBarState = {
  tabs: {
    b1: { id: 'b1', label: 'Overview', closable: true },
    b2: { id: 'b2', label: 'Getting Started', closable: true },
    b3: { id: 'b3', label: 'API', closable: true },
    b4: { id: 'b4', label: 'Examples', closable: true },
  },
  groups: {},
  slots: [
    { type: 'tab', tabId: 'b1' },
    { type: 'tab', tabId: 'b2' },
    { type: 'tab', tabId: 'b3' },
    { type: 'tab', tabId: 'b4' },
  ],
  activeTabId: 'b1',
};

const IconClose = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" /><line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
  </svg>
);

function BasicTab({ tabId }: { tabId: string }) {
  const { state } = useTabBarContext();
  const tab = state.tabs[tabId];
  const { setNodeRef, attributes, listeners, style, isActive, activate, close } = useTab(tabId);
  if (!tab) return null;
  return (
    <div ref={setNodeRef} {...(attributes as any)} {...(listeners as any)} style={style}
      className="tab" data-active={isActive ? '' : undefined} onClick={activate}>
      <span className="tab-label">{tab.label}</span>
      {tab.closable && (
        <button className="tab-close" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); close(); }} aria-label="Close">
          <IconClose />
        </button>
      )}
    </div>
  );
}

function BasicStrip() {
  const { setNodeRef, attributes, slots, sortableIds, sortStrategy, sortableContextId } = useTabStrip();
  return (
    <div ref={setNodeRef} {...(attributes as any)} className="tab-strip">
      <SortableContext id={sortableContextId} items={sortableIds} strategy={sortStrategy}>
        {slots.map((slot: TabSlot) => (slot.type === 'tab' ? <BasicTab key={slot.tabId} tabId={slot.tabId} /> : null))}
      </SortableContext>
    </div>
  );
}

export default function BasicExample() {
  const [state, setState] = useState<TabBarState>(INITIAL_STATE);
  return (
    <TabBarProvider state={state} onStateChange={setState}>
      <BasicStrip />
    </TabBarProvider>
  );
}
