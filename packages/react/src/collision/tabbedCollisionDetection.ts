import { closestCenter } from '@dnd-kit/core';
import type { CollisionDetection } from '@dnd-kit/core';
import { getAxisMetrics } from '../axis.js';
import type { Orientation } from '../axis.js';

// Layered, pointer-first collision detection.
//
//   0. Pinned clamp — pinned actives only see pinned targets and vice versa.
//   1. Inside a mounted dropdown — direct hit-test on the dropdown's own rect;
//      resolves to the nearest group-tab by pointer position, so precise
//      in-dropdown placement works.
//   2. Beneath the strip — a pill whose main-axis range contains the pointer is
//      targeted: opens it, or if its dropdown is already open, resolves to its
//      items directly (so leaving the dropdown's own rect vertically while
//      still under the same pill doesn't cancel the interaction). No pill
//      under the pointer falls through to the layers below, deliberately —
//      see the comment further down on why "stick to any nearby dropdown"
//      was removed.
//   3. In-strip pill combine — pointer physically inside a pill's middle
//      (combineFraction), with a forgiveness margin — targets the pill.
//   4. Fallback — nearest strip-level sortable BY POINTER POSITION, not
//      closestCenter's dragged-rect-vs-candidate comparison (falls back to
//      closestCenter only when there's no pointer, i.e. keyboard drags).
//
// Every layer resolves by where the POINTER physically is, never by the
// dragged item's own rect — a long tab name grabbed mid-label must still
// combine into or sort correctly against much narrower targets.

export interface CollisionContext {
  orientation: Orientation;
  /** Fraction of a pill's main-axis extent that counts as "combine into group". Default 0.8 */
  combineFraction?: number;
  /** Forgiveness margin (px) around a dropdown's rect. Default 8 */
  dropdownHitMargin?: number;
}

type Data = Record<string, unknown> | undefined;
type Containers = Parameters<CollisionDetection>[0]['droppableContainers'];

function nearestByPointer(containers: Containers, p: { x: number; y: number }, axis: 'y' | 'xy') {
  let best: Containers[number] | null = null;
  let bestD = Infinity;
  for (const c of containers) {
    const r = c.rect.current;
    if (!r) continue;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = axis === 'y' ? Math.abs(p.y - cy) : Math.hypot(p.x - cx, p.y - cy);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function createTabbedCollisionDetection(ctx: CollisionContext): CollisionDetection {
  const combineFraction = ctx.combineFraction ?? 0.8;
  const hitMargin = ctx.dropdownHitMargin ?? 8;

  return (args) => {
    const { active, droppableContainers, pointerCoordinates: p } = args;
    const activeData = active.data.current as Data;
    const axis = getAxisMetrics(ctx.orientation);

    const activePinned = !!activeData?.pinned;
    const candidates = droppableContainers.filter(
      (c) => activePinned === !!(c.data.current as Data)?.pinned
    );
    const stripItems = candidates.filter((c) => {
      const t = (c.data.current as Data)?.type;
      return t === 'tab' || t === 'group';
    });
    // Pointer-based, not rect-based: closestCenter compares the DRAGGED item's
    // own rect to each candidate, which skews hard when that rect is much
    // wider/narrower than the candidates (a long tab name grabbed mid-label
    // drifting over a short pill). Nearest-by-pointer has no opinion about the
    // dragged item's size at all. Falls back to closestCenter only when there's
    // no pointer to go by (keyboard-driven drags).
    const sortFallback = () => {
      const pool = stripItems.length > 0 ? stripItems : candidates;
      if (p) {
        const nearest = nearestByPointer(pool, p, 'xy');
        if (nearest) return [{ id: nearest.id }];
      }
      return closestCenter({ ...args, droppableContainers: pool });
    };

    if (!p || activeData?.type === 'group') return sortFallback();

    const itemsOfGroup = (groupId: unknown) =>
      candidates.filter((c) => {
        const d = c.data.current as Data;
        return d?.type === 'group-tab' && d.groupId === groupId;
      });
    // Matched by data.type, not by an assumed id string — a consumer's
    // "expanded group" container droppable only has to carry
    // { type: 'group-dropdown', groupId }, regardless of what they name its
    // id or whether they render it in a portalled dropdown, inline in the
    // strip, or anywhere else. Same for group-pill below.
    const groupDropdownOf = (groupId: unknown) =>
      candidates.find((c) => {
        const d = c.data.current as Data;
        return d?.type === 'group-dropdown' && d.groupId === groupId;
      });
    const groupPillDropOf = (groupId: unknown) =>
      candidates.find((c) => {
        const d = c.data.current as Data;
        return d?.type === 'group-pill' && d.groupId === groupId;
      });

    // 1. Pointer inside a mounted dropdown
    for (const dd of candidates) {
      if ((dd.data.current as Data)?.type !== 'group-dropdown') continue;
      const r = dd.rect.current;
      if (!r) continue;
      const inX = p.x >= r.left - hitMargin && p.x <= r.left + r.width + hitMargin;
      const inY = p.y >= r.top - hitMargin && p.y <= r.top + r.height + hitMargin;
      if (!inX || !inY) continue;
      const nearest = nearestByPointer(itemsOfGroup((dd.data.current as Data)?.groupId), p, 'y');
      return [{ id: (nearest ?? dd).id }];
    }

    const stripRect = droppableContainers.find((c) => c.id === 'strip')?.rect.current;
    const pillMainRange = (c: Containers[number]) => {
      const r = c.rect.current;
      if (!r) return null;
      const start = axis.mainAxis === 'x' ? r.left : r.top;
      return { start, end: start + r[axis.sizeProp] };
    };

    // 2. Beneath/beside the strip, in the dropdown-opening band
    if (stripRect) {
      const crossStart = axis.crossAxis === 'y' ? stripRect.top : stripRect.left;
      const beyondStrip = p[axis.crossAxis] > crossStart + stripRect[axis.crossSizeProp];
      if (beyondStrip) {
        const pill = stripItems.find((c) => {
          if ((c.data.current as Data)?.type !== 'group') return false;
          const range = pillMainRange(c);
          return !!range && p[axis.mainAxis] >= range.start && p[axis.mainAxis] <= range.end;
        });
        if (pill) {
          const gid = (pill.data.current as Data)?.groupId as string;
          const dd = groupDropdownOf(gid);
          if (dd) {
            const nearest = nearestByPointer(itemsOfGroup(gid), p, 'y');
            return [{ id: (nearest ?? dd).id }];
          }
          const pillDrop = groupPillDropOf(gid);
          if (pillDrop) return [{ id: pillDrop.id }];
        }
        // No pill under the pointer here — fall through to the strip-level
        // layers below. (Deliberately not "stick to whatever dropdown items
        // happen to still be mounted nearby": that search wasn't scoped to
        // any particular group, so it could snap a drag back into a group
        // you'd already left while trying to reach a *different* one —
        // exactly what makes moving between two groups feel like flypaper.)
      }
    }

    // 3. Pointer physically inside a pill's combine zone (with a forgiveness
    // margin — a short-labeled pill can be a genuinely small target, and
    // requiring pixel-exact placement under a wide drag overlay is unusable)
    for (const c of stripItems) {
      const d = c.data.current as Data;
      if (d?.type !== 'group') continue;
      const r = c.rect.current;
      if (!r) continue;
      const inside =
        p.x >= r.left - hitMargin && p.x <= r.left + r.width + hitMargin &&
        p.y >= r.top - hitMargin && p.y <= r.top + r.height + hitMargin;
      if (!inside) continue;
      const range = pillMainRange(c);
      if (range) {
        const size = range.end - range.start;
        const frac = size > 0 ? (p[axis.mainAxis] - range.start) / size : 0.5;
        const m = (1 - combineFraction) / 2;
        if (frac >= m && frac <= 1 - m) {
          const pillDrop = groupPillDropOf(d.groupId);
          if (pillDrop) return [{ id: pillDrop.id }];
        }
      }
      break; // inside this pill's edge zone → sort next to it via fallback
    }

    return sortFallback();
  };
}
