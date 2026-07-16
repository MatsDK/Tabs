import { describe, expect, it } from 'vitest';
import { tabBarReducer, findEmptiedGroups } from './reducer.js';
import type { TabBarState } from './types.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function tab(id: string, extra: Partial<TabBarState['tabs'][string]> = {}) {
  return { id, label: id, closable: true, ...extra };
}

function baseState(): TabBarState {
  return {
    tabs: {
      p1: tab('p1', { pinned: true }),
      t1: tab('t1'),
      t2: tab('t2'),
      t3: tab('t3'),
      t4: tab('t4'),
    },
    groups: {
      g1: { id: 'g1', label: 'Group 1', color: '#3fb950' },
    },
    slots: [
      { type: 'tab', tabId: 'p1' },
      { type: 'tab', tabId: 't1' },
      { type: 'tab', tabId: 't2' },
      { type: 'group', groupId: 'g1', tabIds: ['t3', 't4'] },
    ],
    activeTabId: 't1',
  };
}

function slotOrder(state: TabBarState): string[] {
  return state.slots.map((s) => (s.type === 'tab' ? s.tabId : `[${s.groupId}:${s.tabIds.join(',')}]`));
}

// ─── Basic tab/group CRUD ───────────────────────────────────────────────────────

describe('tabBarReducer — basic tab actions', () => {
  it('ADD_TAB inserts at the requested position', () => {
    const state = baseState();
    const next = tabBarReducer(state, { type: 'ADD_TAB', tab: tab('t5'), position: 1 });
    expect(slotOrder(next)).toEqual(['p1', 't5', 't1', 't2', '[g1:t3,t4]']);
  });

  it('REMOVE_TAB removes the tab and activates the nearest remaining tab', () => {
    const state = baseState();
    const next = tabBarReducer(state, { type: 'REMOVE_TAB', tabId: 't1' });
    expect(next.tabs.t1).toBeUndefined();
    expect(next.activeTabId).toBe('t2');
  });

  it('REMOVE_TAB removes a grouped tab from its group slot, not the top level', () => {
    const state = baseState();
    const next = tabBarReducer(state, { type: 'REMOVE_TAB', tabId: 't3' });
    expect(slotOrder(next)).toEqual(['p1', 't1', 't2', '[g1:t4]']);
  });
});

describe('tabBarReducer — pinned-zone clamp (MOVE_TAB)', () => {
  it('a pinned tab cannot be moved past the pinned/unpinned boundary', () => {
    const state = baseState(); // only p1 is pinned, boundary is index 1
    const next = tabBarReducer(state, { type: 'MOVE_TAB', tabId: 'p1', toIndex: 3 });
    // clamped back to the pinned boundary (index 0, the only pinned slot) — stays put
    expect(slotOrder(next)[0]).toBe('p1');
  });

  it('an unpinned tab cannot be moved into the pinned zone', () => {
    const state = baseState();
    const next = tabBarReducer(state, { type: 'MOVE_TAB', tabId: 't2', toIndex: 0 });
    // t2 should land at the pinned boundary (right after p1), not before it
    expect(slotOrder(next)[0]).toBe('p1');
    expect(slotOrder(next)[1]).toBe('t2');
  });

  it('unpinned tabs still reorder freely among themselves', () => {
    const state = baseState();
    const next = tabBarReducer(state, { type: 'MOVE_TAB', tabId: 't1', toIndex: 2 });
    expect(slotOrder(next)).toEqual(['p1', 't2', 't1', '[g1:t3,t4]']);
  });
});

describe('tabBarReducer — DND_RESOLVE SORT_STRIP', () => {
  it('reorders two top-level tabs precisely (regression: used to silently no-op via stale index math)', () => {
    const state = baseState();
    const next = tabBarReducer(state, {
      type: 'DND_RESOLVE',
      dragEvent: { kind: 'SORT_STRIP', activeId: 't1', overId: 't2' },
    });
    expect(slotOrder(next)).toEqual(['p1', 't2', 't1', '[g1:t3,t4]']);
  });

  it('reorders a whole group pill among top-level tabs', () => {
    const state = baseState();
    const next = tabBarReducer(state, {
      type: 'DND_RESOLVE',
      dragEvent: { kind: 'SORT_STRIP', activeId: 'g1', overId: 't1' },
    });
    expect(slotOrder(next)).toEqual(['p1', '[g1:t3,t4]', 't1', 't2']);
  });

  it('respects the pinned boundary when resolved via drag (not just the imperative MOVE_TAB action)', () => {
    const state = baseState();
    const next = tabBarReducer(state, {
      type: 'DND_RESOLVE',
      dragEvent: { kind: 'SORT_STRIP', activeId: 't2', overId: 'p1' },
    });
    expect(slotOrder(next)[0]).toBe('p1'); // t2 clamps to right after p1, doesn't overtake it
  });
});

describe('tabBarReducer — group drop resolution (regression coverage)', () => {
  it('DROP_INTO_GROUP inserts a top-level tab at a precise index, not always 0', () => {
    const state = baseState();
    const next = tabBarReducer(state, {
      type: 'DND_RESOLVE',
      dragEvent: { kind: 'DROP_INTO_GROUP', tabId: 't1', groupId: 'g1', index: 1 },
    });
    const groupSlot = next.slots.find((s) => s.type === 'group');
    expect(groupSlot?.type === 'group' && groupSlot.tabIds).toEqual(['t3', 't1', 't4']);
  });

  it('MOVE_BETWEEN_GROUPS moves a tab from one group straight into another at a precise index', () => {
    const state: TabBarState = {
      ...baseState(),
      groups: { g1: { id: 'g1', label: 'G1' }, g2: { id: 'g2', label: 'G2' } },
      slots: [
        { type: 'tab', tabId: 'p1' },
        { type: 'group', groupId: 'g1', tabIds: ['t1', 't2'] },
        { type: 'group', groupId: 'g2', tabIds: ['t3'] },
      ],
    };
    const next = tabBarReducer(state, {
      type: 'DND_RESOLVE',
      dragEvent: { kind: 'MOVE_BETWEEN_GROUPS', tabId: 't1', fromGroupId: 'g1', toGroupId: 'g2', index: 0 },
    });
    const g1 = next.slots.find((s) => s.type === 'group' && s.groupId === 'g1');
    const g2 = next.slots.find((s) => s.type === 'group' && s.groupId === 'g2');
    expect(g1?.type === 'group' && g1.tabIds).toEqual(['t2']);
    expect(g2?.type === 'group' && g2.tabIds).toEqual(['t1', 't3']);
  });

  it('EJECT_FROM_GROUP moves a tab out of a group to a precise strip index', () => {
    const state = baseState();
    const next = tabBarReducer(state, {
      type: 'DND_RESOLVE',
      dragEvent: { kind: 'EJECT_FROM_GROUP', tabId: 't3', groupId: 'g1', stripIndex: 1 },
    });
    expect(slotOrder(next)).toEqual(['p1', 't3', 't1', 't2', '[g1:t4]']);
  });
});

describe('tabBarReducer — dissolveOnEmpty pruning', () => {
  it('auto-removes a group when its last tab leaves and dissolveOnEmpty is true', () => {
    const state: TabBarState = {
      ...baseState(),
      groups: { g1: { id: 'g1', label: 'G1', dissolveOnEmpty: true } },
      slots: [{ type: 'tab', tabId: 't1' }, { type: 'group', groupId: 'g1', tabIds: ['t2'] }],
    };
    const next = tabBarReducer(state, { type: 'REMOVE_TAB_FROM_GROUP', tabId: 't2' });
    expect(next.groups.g1).toBeUndefined();
    expect(next.slots.some((s) => s.type === 'group')).toBe(false);
  });

  it('keeps an emptied group by default (dissolveOnEmpty unset)', () => {
    const state: TabBarState = {
      ...baseState(),
      groups: { g1: { id: 'g1', label: 'G1' } },
      slots: [{ type: 'tab', tabId: 't1' }, { type: 'group', groupId: 'g1', tabIds: ['t2'] }],
    };
    const next = tabBarReducer(state, { type: 'REMOVE_TAB_FROM_GROUP', tabId: 't2' });
    expect(next.groups.g1).toBeDefined();
    const groupSlot = next.slots.find((s) => s.type === 'group');
    expect(groupSlot?.type === 'group' && groupSlot.tabIds).toEqual([]);
  });

  it('never prunes a freshly-created group that was never populated, even with dissolveOnEmpty true', () => {
    const state = baseState();
    const next = tabBarReducer(state, {
      type: 'ADD_GROUP',
      group: { id: 'g2', label: 'Empty', dissolveOnEmpty: true },
    });
    expect(next.groups.g2).toBeDefined();
    expect(next.slots.some((s) => s.type === 'group' && s.groupId === 'g2')).toBe(true);
  });
});

describe('findEmptiedGroups', () => {
  it('reports a group that transitioned from having tabs to having none', () => {
    const state: TabBarState = {
      ...baseState(),
      groups: { g1: { id: 'g1', label: 'G1' } },
      slots: [{ type: 'tab', tabId: 't1' }, { type: 'group', groupId: 'g1', tabIds: ['t2'] }],
    };
    const next = tabBarReducer(state, { type: 'REMOVE_TAB_FROM_GROUP', tabId: 't2' });
    expect(findEmptiedGroups(state, next)).toEqual(['g1']);
  });

  it('does not report a group that was already empty before the action', () => {
    const state: TabBarState = {
      ...baseState(),
      groups: { g1: { id: 'g1', label: 'G1' } },
      slots: [{ type: 'tab', tabId: 't1' }, { type: 'group', groupId: 'g1', tabIds: [] }],
    };
    const next = tabBarReducer(state, { type: 'SET_ACTIVE_TAB', tabId: 't1' });
    expect(findEmptiedGroups(state, next)).toEqual([]);
  });

  it('does not report a group that still has tabs', () => {
    const state = baseState();
    const next = tabBarReducer(state, { type: 'SET_ACTIVE_TAB', tabId: 't2' });
    expect(findEmptiedGroups(state, next)).toEqual([]);
  });
});
