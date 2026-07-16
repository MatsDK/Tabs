import { describe, expect, it } from 'vitest';
import { resolveDropEvent } from './dragResolution.js';
import type { TabBarState } from '@react-tabstack/core';

function tab(id: string) {
  return { id, label: id, closable: true };
}

function baseState(): TabBarState {
  return {
    tabs: { t1: tab('t1'), t2: tab('t2'), t3: tab('t3'), t4: tab('t4'), t5: tab('t5') },
    groups: {
      g1: { id: 'g1', label: 'G1' },
      g2: { id: 'g2', label: 'G2' },
    },
    slots: [
      { type: 'tab', tabId: 't1' },
      { type: 'group', groupId: 'g1', tabIds: ['t2', 't3'] },
      { type: 'group', groupId: 'g2', tabIds: ['t4'] },
    ],
    activeTabId: 't1',
  };
}

describe('resolveDropEvent — combine into a group via its pill', () => {
  it('a bare top-level tab dropped on a pill combines into that group', () => {
    const event = resolveDropEvent(baseState(), 't1', 'group-pill:g2', { type: 'tab', tabId: 't1' }, { type: 'group-pill', groupId: 'g2' });
    expect(event).toEqual({ kind: 'DROP_INTO_GROUP', tabId: 't1', groupId: 'g2', index: 0 });
  });

  it('a group-tab dropped on a DIFFERENT group pill moves between groups (regression: used to misroute to eject)', () => {
    const event = resolveDropEvent(
      baseState(),
      't2',
      'group-pill:g2',
      { type: 'group-tab', tabId: 't2', groupId: 'g1' },
      { type: 'group-pill', groupId: 'g2' }
    );
    expect(event).toEqual({ kind: 'MOVE_BETWEEN_GROUPS', tabId: 't2', fromGroupId: 'g1', toGroupId: 'g2', index: 1 });
  });

  it('a group-tab dropped on its OWN group pill is a no-op', () => {
    const event = resolveDropEvent(
      baseState(),
      't2',
      'group-pill:g1',
      { type: 'group-tab', tabId: 't2', groupId: 'g1' },
      { type: 'group-pill', groupId: 'g1' }
    );
    expect(event).toBeNull();
  });

  it('a whole group pill dropped on another group pill does not nest (groups cannot combine into groups)', () => {
    const event = resolveDropEvent(
      baseState(),
      'g1',
      'group-pill:g2',
      { type: 'group', groupId: 'g1' },
      { type: 'group-pill', groupId: 'g2' }
    );
    expect(event).toBeNull();
  });
});

describe('resolveDropEvent — reorder within an open group dropdown', () => {
  it('computes a precise index via simulate-then-read-back, not always 0 (regression)', () => {
    // g1 = [t2, t3]; dragging t3 to land before t2 → should resolve toIndex 0, not the old always-0 default masking real logic
    const event = resolveDropEvent(
      baseState(),
      't3',
      't2',
      { type: 'group-tab', tabId: 't3', groupId: 'g1' },
      { type: 'group-tab', tabId: 't2', groupId: 'g1' }
    );
    expect(event).toEqual({ kind: 'SORT_GROUP_TABS', tabId: 't3', groupId: 'g1', toIndex: 0 });
  });

  it('a bare tab dropped precisely on a group-tab item resolves DROP_INTO_GROUP at that item’s index', () => {
    const event = resolveDropEvent(
      baseState(),
      't1',
      't3',
      { type: 'tab', tabId: 't1' },
      { type: 'group-tab', tabId: 't3', groupId: 'g1' }
    );
    expect(event).toEqual({ kind: 'DROP_INTO_GROUP', tabId: 't1', groupId: 'g1', index: 1 });
  });

  it('a tab dropped on the empty space of an open dropdown appends at the end', () => {
    const event = resolveDropEvent(baseState(), 't1', 'group-dropdown:g1', { type: 'tab', tabId: 't1' }, { type: 'group-dropdown', groupId: 'g1' });
    expect(event).toEqual({ kind: 'DROP_INTO_GROUP', tabId: 't1', groupId: 'g1', index: 2 });
  });

  it('a group-tab moved to a DIFFERENT group via its dropdown resolves MOVE_BETWEEN_GROUPS at a precise index', () => {
    const event = resolveDropEvent(
      baseState(),
      't2',
      't4',
      { type: 'group-tab', tabId: 't2', groupId: 'g1' },
      { type: 'group-tab', tabId: 't4', groupId: 'g2' }
    );
    expect(event).toEqual({ kind: 'MOVE_BETWEEN_GROUPS', tabId: 't2', fromGroupId: 'g1', toGroupId: 'g2', index: 0 });
  });
});

describe('resolveDropEvent — eject from a group back to the strip', () => {
  it('resolves a precise strip index when dropped on a top-level tab', () => {
    const event = resolveDropEvent(baseState(), 't2', 't1', { type: 'group-tab', tabId: 't2', groupId: 'g1' }, { type: 'tab', tabId: 't1' });
    expect(event).toEqual({ kind: 'EJECT_FROM_GROUP', tabId: 't2', groupId: 'g1', stripIndex: 0 });
  });

  it('appends to the end of the strip when dropped on empty strip space', () => {
    const event = resolveDropEvent(baseState(), 't2', 'strip', { type: 'group-tab', tabId: 't2', groupId: 'g1' }, { type: 'strip' });
    expect(event).toEqual({ kind: 'EJECT_FROM_GROUP', tabId: 't2', groupId: 'g1', stripIndex: 3 });
  });
});

describe('resolveDropEvent — sort within the top-level strip', () => {
  it('sorts a bare tab against another bare tab', () => {
    const state: TabBarState = { ...baseState(), slots: [{ type: 'tab', tabId: 't1' }, { type: 'tab', tabId: 't5' }] };
    const event = resolveDropEvent(state, 't1', 't5', { type: 'tab', tabId: 't1' }, { type: 'tab', tabId: 't5' });
    expect(event).toEqual({ kind: 'SORT_STRIP', activeId: 't1', overId: 't5' });
  });

  it('sorts a whole group pill against a bare tab', () => {
    const event = resolveDropEvent(baseState(), 'g1', 't1', { type: 'group', groupId: 'g1' }, { type: 'tab', tabId: 't1' });
    expect(event).toEqual({ kind: 'SORT_STRIP', activeId: 'g1', overId: 't1' });
  });

  it('dropping in trailing empty strip space falls back to the last top-level slot', () => {
    const event = resolveDropEvent(baseState(), 't1', 'strip', { type: 'tab', tabId: 't1' }, { type: 'strip' });
    expect(event).toEqual({ kind: 'SORT_STRIP', activeId: 't1', overId: 'g2' });
  });

  it('is a no-op when dragging over yourself', () => {
    const event = resolveDropEvent(baseState(), 't1', 't1', { type: 'tab', tabId: 't1' }, { type: 'tab', tabId: 't1' });
    expect(event).toBeNull();
  });
});
