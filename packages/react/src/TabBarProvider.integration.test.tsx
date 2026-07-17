import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { TabBarProvider } from './components/TabBarProvider.js';
import { useTabBarContext } from './context.js';
import type { TabBarActions, TabBarState } from '@react-tabstack/core';

function initialState(): TabBarState {
  return {
    tabs: {
      t1: { id: 't1', label: 't1' },
      t2: { id: 't2', label: 't2' },
      t3: { id: 't3', label: 't3' },
    },
    groups: {
      g1: { id: 'g1', label: 'G1' },
    },
    slots: [
      { type: 'tab', tabId: 't1' },
      { type: 'tab', tabId: 't2' },
      { type: 'group', groupId: 'g1', tabIds: ['t3'] },
    ],
    activeTabId: 't1',
  };
}

let capturedState: TabBarState;
let capturedActions: TabBarActions;

function Capture() {
  const ctx = useTabBarContext();
  capturedState = ctx.state;
  capturedActions = ctx.actions;
  return null;
}

function Harness() {
  const [state, setState] = useState<TabBarState>(initialState());
  return (
    <TabBarProvider state={state} onStateChange={setState}>
      <Capture />
    </TabBarProvider>
  );
}

describe('TabBarProvider — actions from context actually commit', () => {
  it('pinTab moves the tab into the pinned zone and marks it pinned', () => {
    render(<Harness />);
    act(() => capturedActions.pinTab('t2'));
    expect(capturedState.tabs.t2.pinned).toBe(true);
    expect(capturedState.slots[0]).toEqual({ type: 'tab', tabId: 't2' });
  });

  it('unpinTab reverses pinTab and keeps the tab at the front (regression)', () => {
    render(<Harness />);
    act(() => capturedActions.pinTab('t2'));
    act(() => capturedActions.unpinTab('t2'));
    expect(capturedState.tabs.t2.pinned).toBe(false);
    expect(capturedState.slots[0]).toEqual({ type: 'tab', tabId: 't2' });
  });

  it('addTabToGroup ("Move to Group") moves a top-level tab into an existing group', () => {
    render(<Harness />);
    act(() => capturedActions.addTabToGroup('t1', 'g1'));
    const groupSlot = capturedState.slots.find((s) => s.type === 'group');
    expect(groupSlot?.type === 'group' && groupSlot.tabIds).toContain('t1');
    expect(capturedState.slots.some((s) => s.type === 'tab' && s.tabId === 't1')).toBe(false);
  });

  it('createGroupFromTab ("Move to New Group") wraps a tab in a brand-new group', () => {
    render(<Harness />);
    act(() => capturedActions.createGroupFromTab('t1', { id: 'g2', label: 'New Group' }));
    expect(capturedState.groups.g2).toBeDefined();
    const newGroupSlot = capturedState.slots.find((s) => s.type === 'group' && s.groupId === 'g2');
    expect(newGroupSlot?.type === 'group' && newGroupSlot.tabIds).toEqual(['t1']);
  });

  it('two sequential actions both apply (regression: a stale closure would drop the second)', () => {
    render(<Harness />);
    act(() => capturedActions.pinTab('t2'));
    act(() => capturedActions.addTabToGroup('t1', 'g1'));
    expect(capturedState.tabs.t2.pinned).toBe(true);
    const groupSlot = capturedState.slots.find((s) => s.type === 'group');
    expect(groupSlot?.type === 'group' && groupSlot.tabIds).toContain('t1');
  });

  it('two actions fired in the same synchronous handler both apply (regression: dispatch closed over the pre-click state prop, so the second call\'s onStateChange(next) fully overwrote the first\'s instead of composing — e.g. a "Move to Group" menu item that also calls setActiveTab silently dropped the group move)', () => {
    render(<Harness />);
    // Both calls inside one act() — no re-render (and therefore no fresh
    // `state` prop) between them, exactly like two actions fired from the
    // same click handler before React has a chance to flush.
    act(() => {
      capturedActions.addTabToGroup('t1', 'g1');
      capturedActions.setActiveTab('t1');
    });
    const groupSlot = capturedState.slots.find((s) => s.type === 'group');
    expect(groupSlot?.type === 'group' && groupSlot.tabIds).toContain('t1');
    expect(capturedState.activeTabId).toBe('t1');
  });

  it('moveTabToGroup resolves its source group against the mid-tick state, not the pre-handler snapshot', () => {
    render(<Harness />);
    act(() => {
      capturedActions.createGroupFromTab('t2', { id: 'g2', label: 'G2' });
      // t2 only exists inside g2 as of the line above, within this same tick.
      capturedActions.moveTabToGroup('t2', 'g1');
    });
    const g1 = capturedState.slots.find((s) => s.type === 'group' && s.groupId === 'g1');
    const g2 = capturedState.slots.find((s) => s.type === 'group' && s.groupId === 'g2');
    expect(g1?.type === 'group' && g1.tabIds).toContain('t2');
    expect(g2?.type === 'group' && g2.tabIds).not.toContain('t2');
  });
});
