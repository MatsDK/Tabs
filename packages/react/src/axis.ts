import { horizontalListSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import type { Modifier } from '@dnd-kit/core';

// ─────────────────────────────────────────────────────────────────────────────
// axis.ts — single source of truth for orientation-dependent geometry.
//
// Every module that needs to reason about "the direction tabs flow" or "the
// direction perpendicular to that" reads from here instead of re-deriving its
// own horizontal/vertical branches. Keeps collision detection, sort strategy
// selection, and dropdown placement consistent by construction.
// ─────────────────────────────────────────────────────────────────────────────

export type Orientation = 'horizontal' | 'vertical';

export interface AxisMetrics {
  orientation: Orientation;
  /** The axis tabs are laid out along */
  mainAxis: 'x' | 'y';
  /** The axis perpendicular to the strip's flow */
  crossAxis: 'x' | 'y';
  sizeProp: 'width' | 'height';
  crossSizeProp: 'width' | 'height';
  crossOriginProp: 'top' | 'left';
  sortStrategy: typeof horizontalListSortingStrategy;
  /** Side an open group's dropdown should render on relative to its pill */
  dropdownSide: 'bottom' | 'right';
  /** Default axis-lock modifier for DndContext */
  axisModifier: Modifier;
}

const HORIZONTAL: AxisMetrics = {
  orientation: 'horizontal',
  mainAxis: 'x',
  crossAxis: 'y',
  sizeProp: 'width',
  crossSizeProp: 'height',
  crossOriginProp: 'top',
  sortStrategy: horizontalListSortingStrategy,
  dropdownSide: 'bottom',
  axisModifier: restrictToHorizontalAxis,
};

const VERTICAL: AxisMetrics = {
  orientation: 'vertical',
  mainAxis: 'y',
  crossAxis: 'x',
  sizeProp: 'height',
  crossSizeProp: 'width',
  crossOriginProp: 'left',
  sortStrategy: verticalListSortingStrategy,
  dropdownSide: 'right',
  axisModifier: restrictToVerticalAxis,
};

export function getAxisMetrics(orientation: Orientation): AxisMetrics {
  return orientation === 'vertical' ? VERTICAL : HORIZONTAL;
}
