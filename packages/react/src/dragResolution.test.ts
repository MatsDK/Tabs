import { describe, expect, it } from 'vitest';
import { tabBarReducer } from '@react-tabstack/core';
import type { DndResolveEvent, TabBarState } from '@react-tabstack/core';
import { containerOf, membershipTargetFor, membershipEvent, orderingEvent } from './dragResolution.js';
import type { DragData } from './dragResolution.js';

function tab(id: string) {
  return { id, label: id, closable: true };
}

// Strip: [t1, g1(t2,t3), g2(t4), t5]
function baseState(): TabBarState {
  return {
    tabs: { t1: tab('t1'), t2: tab('t2'), t3: tab('t3'), t4: tab('t4'), t5: tab('t5') },
    groups: { g1: { id: 'g1', label: 'G1' }, g2: { id: 'g2', label: 'G2' } },
    slots: [
      { type: 'tab', tabId: 't1' },
      { type: 'group', groupId: 'g1', tabIds: ['t2', 't3'] },
      { type: 'group', groupId: 'g2', tabIds: ['t4'] },
      { type: 'tab', tabId: 't5' },
    ],
    activeTabId: 't1',
  };
}

function apply(state: TabBarState, event: DndResolveEvent | null): TabBarState {
  return event ? tabBarReducer(state, { type: 'DND_RESOLVE', dragEvent: event }) : state;
}

function groupIds(state: TabBarState, groupId: string): string[] {
  const slot = state.slots.find((s) => s.type === 'group' && s.groupId === groupId);
  return slot?.type === 'group' ? slot.tabIds : [];
}

function stripOrder(state: TabBarState): string[] {
  return state.slots.map((s) => (s.type === 'tab' ? s.tabId : s.groupId));
}

describe('membershipTargetFor', () => {
  it('maps every collision target to its container', () => {
    expect(membershipTargetFor('group-pill:g1', { type: 'group-pill', groupId: 'g1' })).toBe('g1');
    expect(membershipTargetFor('t2', { type: 'group-tab', tabId: 't2', groupId: 'g1' })).toBe('g1');
    expect(membershipTargetFor('group-dropdown:g2', { type: 'group-dropdown', groupId: 'g2' })).toBe('g2');
    expect(membershipTargetFor('t1', { type: 'tab', tabId: 't1' })).toBeNull();
    expect(membershipTargetFor('g1', { type: 'group', groupId: 'g1' })).toBeNull();
    expect(membershipTargetFor('strip', { type: 'strip' })).toBeNull();
    expect(membershipTargetFor('something-else', {})).toBeUndefined();
  });
});

describe('membershipEvent', () => {
  it('moves a strip tab into a group, appended at the end', () => {
    const next = apply(baseState(), membershipEvent(baseState(), 't1', 'g1'));
    expect(groupIds(next, 'g1')).toEqual(['t2', 't3', 't1']);
    expect(stripOrder(next)).not.toContain('t1');
  });

  it('ejects a group tab to the strip', () => {
    const next = apply(baseState(), membershipEvent(baseState(), 't2', null));
    expect(groupIds(next, 'g1')).toEqual(['t3']);
    expect(stripOrder(next)).toContain('t2');
  });

  it('moves a tab straight between groups', () => {
    const next = apply(baseState(), membershipEvent(baseState(), 't2', 'g2'));
    expect(groupIds(next, 'g1')).toEqual(['t3']);
    expect(groupIds(next, 'g2')).toEqual(['t4', 't2']);
  });

  it('is a no-op when the tab is already in the target container', () => {
    expect(membershipEvent(baseState(), 't2', 'g1')).toBeNull();
    expect(membershipEvent(baseState(), 't1', null)).toBeNull();
  });
});

describe('orderingEvent', () => {
  const asTab = (id: string): DragData => ({ type: 'tab', tabId: id });
  const asGroupTab = (id: string, g: string): DragData => ({ type: 'group-tab', tabId: id, groupId: g });

  it('sorts within the strip against another slot', () => {
    const ev = orderingEvent(baseState(), 't1', asTab('t1'), 't5', { type: 'tab', tabId: 't5' });
    expect(ev).toEqual({ kind: 'SORT_STRIP', activeId: 't1', overId: 't5' });
  });

  it('sorts a whole group pill in the strip', () => {
    const ev = orderingEvent(baseState(), 'g1', { type: 'group', groupId: 'g1' }, 't5', { type: 'tab', tabId: 't5' });
    expect(ev).toEqual({ kind: 'SORT_STRIP', activeId: 'g1', overId: 't5' });
  });

  it('resolves a precise in-group index via simulate-then-read-back', () => {
    // g1 = [t2, t3]; t3 over t2 → t3 should land at index 0
    const ev = orderingEvent(baseState(), 't3', asGroupTab('t3', 'g1'), 't2', asGroupTab('t2', 'g1'));
    expect(ev).toEqual({ kind: 'SORT_GROUP_TABS', tabId: 't3', groupId: 'g1', toIndex: 0 });
  });

  it('keeps the appended position on pill/dropdown-container drops (membership already placed it)', () => {
    expect(orderingEvent(baseState(), 't1', asTab('t1'), 'group-pill:g1', { type: 'group-pill', groupId: 'g1' })).toBeNull();
    expect(orderingEvent(baseState(), 't1', asTab('t1'), 'group-dropdown:g1', { type: 'group-dropdown', groupId: 'g1' })).toBeNull();
  });

  it('falls back to the last slot when dropped on trailing strip space', () => {
    const ev = orderingEvent(baseState(), 't1', asTab('t1'), 'strip', { type: 'strip' });
    expect(ev).toEqual({ kind: 'SORT_STRIP', activeId: 't1', overId: 't5' });
  });
});

// Full drag simulations — membership on drag-over, ordering at drop, exactly
// as TabBarProvider sequences them.
describe('drag simulations', () => {
  function dragOver(state: TabBarState, tabId: string, overId: string, overData: DragData): TabBarState {
    const target = membershipTargetFor(overId, overData);
    if (target === undefined) return state;
    return apply(state, membershipEvent(state, tabId, target));
  }

  function drop(state: TabBarState, tabId: string, activeData: DragData, overId: string, overData: DragData): TabBarState {
    const withMembership = dragOver(state, tabId, overId, overData);
    return apply(withMembership, orderingEvent(withMembership, tabId, activeData, overId, overData));
  }

  it('strip tab → precise position inside a group', () => {
    // t1 enters g1 via the pill, then is dropped on t2 (index 0)
    let s = dragOver(baseState(), 't1', 'group-pill:g1', { type: 'group-pill', groupId: 'g1' });
    expect(groupIds(s, 'g1')).toEqual(['t2', 't3', 't1']);
    s = drop(s, 't1', { type: 'group-tab', tabId: 't1', groupId: 'g1' }, 't2', { type: 'group-tab', tabId: 't2', groupId: 'g1' });
    expect(groupIds(s, 'g1')).toEqual(['t1', 't2', 't3']);
  });

  it('group tab → precise position in the strip', () => {
    // t2 leaves g1, dropped on t1 (front of strip)
    let s = dragOver(baseState(), 't2', 't1', { type: 'tab', tabId: 't1' });
    expect(containerOf(s, 't2')).toBeNull();
    s = drop(s, 't2', { type: 'group-tab', tabId: 't2', groupId: 'g1' }, 't1', { type: 'tab', tabId: 't1' });
    expect(stripOrder(s)).toEqual(['t2', 't1', 'g1', 'g2', 't5']);
    expect(groupIds(s, 'g1')).toEqual(['t3']);
  });

  it('group A → group B directly', () => {
    const s = drop(baseState(), 't2', { type: 'group-tab', tabId: 't2', groupId: 'g1' }, 't4', {
      type: 'group-tab',
      tabId: 't4',
      groupId: 'g2',
    });
    expect(groupIds(s, 'g1')).toEqual(['t3']);
    expect(groupIds(s, 'g2')).toEqual(['t2', 't4']);
  });

  it('regression: hovering group A then releasing on the strip must NOT leave the tab in A', () => {
    let s = dragOver(baseState(), 't1', 'group-pill:g1', { type: 'group-pill', groupId: 'g1' });
    expect(groupIds(s, 'g1')).toContain('t1');
    // pointer moves back to the strip mid-drag
    s = dragOver(s, 't1', 't5', { type: 'tab', tabId: 't5' });
    expect(groupIds(s, 'g1')).not.toContain('t1');
    // release over t5
    s = drop(s, 't1', { type: 'tab', tabId: 't1' }, 't5', { type: 'tab', tabId: 't5' });
    expect(groupIds(s, 'g1')).toEqual(['t2', 't3']);
    expect(stripOrder(s)).toContain('t1');
  });

  it('regression: out of a group, over the strip, then back into the SAME group', () => {
    let s = dragOver(baseState(), 't2', 't1', { type: 'tab', tabId: 't1' });
    expect(containerOf(s, 't2')).toBeNull();
    s = dragOver(s, 't2', 'group-pill:g1', { type: 'group-pill', groupId: 'g1' });
    expect(containerOf(s, 't2')).toBe('g1');
    s = drop(s, 't2', { type: 'group-tab', tabId: 't2', groupId: 'g1' }, 't3', { type: 'group-tab', tabId: 't3', groupId: 'g1' });
    expect(groupIds(s, 'g1')).toEqual(['t2', 't3']);
  });
});
