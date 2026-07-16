// @react-tabstack/core — public exports
export type {
  Tab,
  TabGroup,
  TabSlot,
  TabBarState,
  TabBarAction,
  DndResolveEvent,
  ContextMenuTarget,
  MenuItem,
  TabBarActions,
  GroupDropState,
  TabBarProviderProps,
} from './types.js';

export { tabBarReducer, findEmptiedGroups } from './reducer.js';
