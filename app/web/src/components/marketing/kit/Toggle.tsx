'use client';

import React, { useRef } from 'react';

export type ToggleOption<T extends string> = { id: T; label: string };

/**
 * Two-or-more option segmented switch (ARIA tabs: arrow keys, Home/End).
 * `panelId` links the tabs to the panel they control.
 */
export function Toggle<T extends string>({
  options,
  value,
  onChange,
  label,
  panelId,
  className = '',
}: {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  panelId?: string;
  className?: string;
}) {
  const refs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const index = Math.max(0, options.findIndex((o) => o.id === value));

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next == null) return;
    e.preventDefault();
    onChange(options[next].id);
    refs.current[options[next].id]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`relative inline-grid rounded-full border border-line bg-surface p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full bg-ink transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[o.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={onKeyDown}
            className={`relative z-10 min-h-11 whitespace-nowrap rounded-full px-5 text-[15px] font-medium transition-colors duration-300 sm:px-7 ${
              selected ? 'text-paper' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
