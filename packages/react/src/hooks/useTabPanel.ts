import { useTabBarContext } from '../context.js';

// ─────────────────────────────────────────────────────────────────────────────
// useTabPanel — content area for a tab
// ─────────────────────────────────────────────────────────────────────────────

export interface UseTabPanelReturn {
  isVisible: boolean;
  attributes: {
    role: 'tabpanel';
    hidden: boolean;
    'aria-labelledby': string;
    'data-tab-panel': string;
  };
}

export function useTabPanel(tabId: string): UseTabPanelReturn {
  const { state } = useTabBarContext();
  const isVisible = state.activeTabId === tabId;

  return {
    isVisible,
    attributes: {
      role: 'tabpanel',
      hidden: !isVisible,
      'aria-labelledby': `tab-${tabId}`,
      'data-tab-panel': tabId,
    },
  };
}
