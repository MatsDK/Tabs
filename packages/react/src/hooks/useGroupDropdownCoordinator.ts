import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// useGroupDropdownCoordinator — single source of truth for "which one group
// dropdown is open right now."
//
// Replaces the old dead `dragDropState.openGroupId` (previously written nowhere,
// read nowhere useful). Every caller — drag-hover, non-drag mouse hover, and
// click-to-open — funnels through the same `setHoverTarget`/`openImmediate` API,
// so only one dropdown can ever be open by construction: opening a new target
// always supersedes any pending close of the previous one.
// ─────────────────────────────────────────────────────────────────────────────

export interface DwellConfig {
  open: number;
  close: number;
}

export interface GroupDropdownCoordinator {
  openGroupId: string | null;
  /** Call continuously with whichever group is currently targeted (drag-hover or mouse-hover), or null for none. */
  setHoverTarget: (groupId: string | null) => void;
  /** Open a group immediately, bypassing the open-dwell timer (e.g. click-to-open). */
  openImmediate: (groupId: string) => void;
  /** Close whichever group is open immediately, bypassing the close-dwell timer. */
  closeImmediate: () => void;
}

export function useGroupDropdownCoordinator(dwell: DwellConfig): GroupDropdownCoordinator {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const openGroupIdRef = useRef<string | null>(null);
  openGroupIdRef.current = openGroupId;

  const hoverTargetRef = useRef<string | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openImmediate = useCallback(
    (groupId: string) => {
      clearOpenTimer();
      clearCloseTimer();
      setOpenGroupId(groupId);
    },
    [clearOpenTimer, clearCloseTimer]
  );

  const closeImmediate = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    setOpenGroupId(null);
  }, [clearOpenTimer, clearCloseTimer]);

  const setHoverTarget = useCallback(
    (groupId: string | null) => {
      if (hoverTargetRef.current === groupId) return;
      hoverTargetRef.current = groupId;

      // Re-entered the already-open group before its close timer fired — settle.
      if (groupId === openGroupIdRef.current) {
        clearCloseTimer();
        clearOpenTimer();
        return;
      }

      clearOpenTimer();
      if (openGroupIdRef.current && !closeTimerRef.current) {
        closeTimerRef.current = setTimeout(() => {
          closeTimerRef.current = null;
          setOpenGroupId(null);
        }, dwell.close);
      }

      if (groupId) {
        openTimerRef.current = setTimeout(() => {
          openTimerRef.current = null;
          clearCloseTimer();
          setOpenGroupId(groupId);
        }, dwell.open);
      }
    },
    [dwell.close, dwell.open, clearOpenTimer, clearCloseTimer]
  );

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    [clearOpenTimer, clearCloseTimer]
  );

  // Referentially stable across renders where nothing here actually changed —
  // a fresh object literal every render would defeat TabBarProviderInternal's
  // own contextValue memoization (it depends on this object's identity),
  // forcing every consumer to re-render on every unrelated state change in the
  // provider (there are many, in quick succession, during a drag).
  return useMemo(
    () => ({ openGroupId, setHoverTarget, openImmediate, closeImmediate }),
    [openGroupId, setHoverTarget, openImmediate, closeImmediate]
  );
}
