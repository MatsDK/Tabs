import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
} from '@dnd-kit/core';
import type { CollisionDetection } from '@dnd-kit/core';

// ─────────────────────────────────────────────────────────────────────────────
// Layered Collision Detector
//
// Priority order:
//   1. Open group dropdowns (inner SortableContext — highest priority)
//   2. Group pills in strip (for drop-into-group)
//   3. Strip-level closest center (for tab/group sorting)
//
// This prevents group pills from accidentally capturing strip sorts when
// the pointer is merely near (not over) a pill.
// ─────────────────────────────────────────────────────────────────────────────

export const tabbedCollisionDetection: CollisionDetection = (args) => {
  const { active, droppableContainers } = args;
  const activeData = active.data.current;

  // ── 1. If something is being dragged into an open group dropdown ──────────
  const dropdownContainers = droppableContainers.filter((c) =>
    String(c.id).startsWith('group-dropdown:')
  );
  if (dropdownContainers.length > 0) {
    const dropdownCollision = getFirstCollision(
      pointerWithin({ ...args, droppableContainers: dropdownContainers }),
      'id'
    );
    if (dropdownCollision) return [{ id: dropdownCollision }];
  }

  // ── 2. If dragging a tab, check group pills first ────────────────────────
  if (activeData?.type === 'tab' || activeData?.type === 'group-tab') {
    const pillContainers = droppableContainers.filter((c) =>
      String(c.id).startsWith('group-pill:')
    );
    if (pillContainers.length > 0) {
      const pillCollision = getFirstCollision(
        pointerWithin({ ...args, droppableContainers: pillContainers }),
        'id'
      );
      if (pillCollision) return [{ id: pillCollision }];
    }
  }

  // ── 3. Fall back to closestCenter for strip-level sorting ─────────────────
  const stripContainers = droppableContainers.filter(
    (c) =>
      !String(c.id).startsWith('group-dropdown:') &&
      !String(c.id).startsWith('group-pill:')
  );

  const closest = closestCenter({
    ...args,
    droppableContainers: stripContainers,
  });

  return closest;
};
