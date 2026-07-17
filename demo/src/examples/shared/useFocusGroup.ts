import { useTabBarContext } from '@react-tabstack/react';
import type { ContextMenuTarget } from '@react-tabstack/react';
import type { MenuCtx } from './contextMenu.js';

/** A group's "reveal" behavior differs by presentation (open a floating
 *  dropdown vs. expand inline) — each example builds its own MenuCtx by
 *  passing its own `reveal` strategy in here, rather than one being baked
 *  into the shared menu-rendering module. */
export function useFocusGroup(
  target: ContextMenuTarget,
  reveal: (groupId: string) => void
): MenuCtx['focusGroup'] {
  const { actions } = useTabBarContext();
  return (groupId: string) => {
    if (target.type === 'tab' || target.type === 'group-tab') actions.setActiveTab(target.tabId);
    reveal(groupId);
  };
}
