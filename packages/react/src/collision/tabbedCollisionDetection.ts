import { closestCenter } from '@dnd-kit/core';
import type { CollisionDetection } from '@dnd-kit/core';
import { getAxisMetrics } from '../axis.js';
import type { Orientation } from '../axis.js';

// Three ordered layers, narrowing the candidate set at each step:
//
//   0. Pinned clamp — a pinned tab only collides with other pinned-tab
//      droppables; an unpinned item never targets one.
//
//   1. Inside a mounted group dropdown — a direct 2D hit-test against the
//      dropdown container's own measured rect (with a small forgiving
//      margin), not an inferred threshold from the strip's position. Whatever
//      group's content is actually rendered is what gets tested — no
//      dependency on which group some piece of React state *thinks* is open.
//      Resolves to individual group-tab items so precise in-group placement
//      works, not just the container as a whole.
//
//   2. Top-level strip — closestCenter over top-level tab/group droppables.
//      If the winner is a group pill, a dead zone (middle ~80% of the pill's
//      main-axis extent) distinguishes "combine into this group" from "sort
//      next to this pill".

export interface CollisionContext {
  orientation: Orientation;
  combineFraction?: number;
  dropdownHitMargin?: number;
}

type Data = Record<string, unknown> | undefined;

export function createTabbedCollisionDetection(ctx: CollisionContext): CollisionDetection {
  const combineFraction = ctx.combineFraction ?? 0.8;
  const hitMargin = ctx.dropdownHitMargin ?? 16;

  return (args) => {
    const { active, droppableContainers, pointerCoordinates } = args;
    const activeData = active.data.current as Data;
    const axis = getAxisMetrics(ctx.orientation);

    const activePinned = !!activeData?.pinned;
    const zoneFiltered = droppableContainers.filter((c) => {
      const isPinnedTarget = !!(c.data.current as Data)?.pinned;
      return activePinned ? isPinnedTarget : !isPinnedTarget;
    });

    if (pointerCoordinates && activeData?.type !== 'group') {
      const dropdownContainers = zoneFiltered.filter((c) => String(c.id).startsWith('group-dropdown:'));
      for (const container of dropdownContainers) {
        const rect = container.rect.current;
        if (!rect) continue;
        const withinX = pointerCoordinates.x >= rect.left - hitMargin && pointerCoordinates.x <= rect.left + rect.width + hitMargin;
        const withinY = pointerCoordinates.y >= rect.top - hitMargin && pointerCoordinates.y <= rect.top + rect.height + hitMargin;
        if (!withinX || !withinY) continue;

        const groupId = (container.data.current as Data)?.groupId;
        const dropdownItems = zoneFiltered.filter((c) => {
          const data = c.data.current as Data;
          return data?.type === 'group-tab' && data.groupId === groupId;
        });
        if (dropdownItems.length > 0) {
          const collisions = closestCenter({ ...args, droppableContainers: dropdownItems });
          if (collisions.length > 0) return collisions;
        }
        return [{ id: container.id }];
      }
    }

    const topLevel = zoneFiltered.filter((c) => {
      const data = c.data.current as Data;
      return data?.type === 'tab' || data?.type === 'group' || c.id === 'strip';
    });

    const base = closestCenter({ ...args, droppableContainers: topLevel.length > 0 ? topLevel : zoneFiltered });
    if (base.length === 0) return base;

    const top = base[0];
    const targetContainer = droppableContainers.find((c) => c.id === top.id);
    const targetData = targetContainer?.data.current as Data;

    if (
      targetData?.type === 'group' &&
      activeData?.type !== 'group' &&
      pointerCoordinates &&
      targetContainer?.rect.current
    ) {
      const rect = targetContainer.rect.current;
      const mainOrigin = axis.mainAxis === 'x' ? rect.left : rect.top;
      const mainSize = rect[axis.sizeProp];
      const fraction = mainSize > 0 ? (pointerCoordinates[axis.mainAxis] - mainOrigin) / mainSize : 0.5;
      const margin = (1 - combineFraction) / 2;
      const isCombineZone = fraction >= margin && fraction <= 1 - margin;

      if (isCombineZone) {
        const pillDroppable = droppableContainers.find((c) => {
          const data = c.data.current as Data;
          return data?.type === 'group-pill' && data.groupId === targetData.groupId;
        });
        if (pillDroppable) return [{ id: pillDroppable.id }];
      }
    }

    return base;
  };
}
