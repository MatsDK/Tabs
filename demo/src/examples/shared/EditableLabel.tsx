import { useEffect, useRef, useState } from 'react';

export function EditableLabel({
  value,
  onCommit,
  className,
  inputClassName,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Enter/Escape resolve the edit immediately and explicitly. Without this,
  // the blur that follows setEditing(false) unmounting the input can fire a
  // second, stale-closure commit on top of (or instead of) the one Enter/Escape
  // just made — which read as "Enter does nothing, but Escape somehow applies it".
  const settledRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      settledRef.current = false;
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = (raw: string) => {
    settledRef.current = true;
    setEditing(false);
    const trimmed = raw.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
  };

  const cancel = () => {
    settledRef.current = true;
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={inputClassName ?? className}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => {
          if (!settledRef.current) commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(e.currentTarget.value);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
      />
    );
  }

  return (
    <span
      className={className}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Double-click to rename"
    >
      {value}
    </span>
  );
}
