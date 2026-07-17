// ─────────────────────────────────────────────────────────────────────────────
// @react-tabstack/react — public exports
// ─────────────────────────────────────────────────────────────────────────────

// Provider
export { TabBarProvider } from './components/TabBarProvider.js';
export type { TabBarProviderProps } from './components/TabBarProvider.js';

// Hooks
export { useTabState } from './hooks/useTabState.js';
export type { UseTabStateReturn } from './hooks/useTabState.js';

export { useTab } from './hooks/useTab.js';
export type { UseTabReturn } from './hooks/useTab.js';

export { useTabGroup } from './hooks/useTabGroup.js';
export type { UseTabGroupReturn } from './hooks/useTabGroup.js';

export { useGroupTab } from './hooks/useGroupTab.js';
export type { UseGroupTabReturn } from './hooks/useGroupTab.js';

export { useTabStrip } from './hooks/useTabStrip.js';
export type { UseTabStripReturn } from './hooks/useTabStrip.js';

export { useTabPanel } from './hooks/useTabPanel.js';
export type { UseTabPanelReturn } from './hooks/useTabPanel.js';

export { useStickyPosition } from './hooks/useStickyPosition.js';
export type { StickyRect } from './hooks/useStickyPosition.js';

// Advanced / custom-component building blocks
export { useTabBarContext } from './context.js';
export type { TabBarContextValue } from './context.js';

export { getAxisMetrics } from './axis.js';
export type { Orientation, AxisMetrics } from './axis.js';

export { createTabbedCollisionDetection } from './collision/tabbedCollisionDetection.js';
export type { CollisionContext } from './collision/tabbedCollisionDetection.js';

export { crossContainerAnimateLayoutChanges } from './animateLayoutChanges.js';

// Re-export core types for convenience — users shouldn't need to install core separately
export type {
  Tab,
  TabGroup,
  TabSlot,
  TabBarState,
  TabBarAction,
  TabBarActions,
  ContextMenuTarget,
  MenuItem,
  GroupDropState,
} from '@react-tabstack/core';
