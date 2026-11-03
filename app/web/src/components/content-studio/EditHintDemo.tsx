// EditHintDemo.tsx
// A short, skippable demo over the poster in the edit dialog: a pointer drags a
// box over one spot and a sample instruction appears. Plays once automatically;
// "Show me how" replays it.

import React, { useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";

const SEEN_KEY = "skalx:poster-edit-hint-seen";

/** Whether the demo has already played for this browser (false if storage is unavailable). */
export function hasSeenEditHint(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markEditHintSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode / blocked storage — the demo just plays again next time */
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/* Box the demo "selects" (fractions of the poster) — the top area, where headlines usually sit. */
const BOX = { x: 0.14, y: 0.12, w: 0.6, h: 0.16 };
const DURATION_MS = 4200;
const STILL_MS = 3500;

/**
 * Covers its positioned parent. Click anywhere, or press Esc, to skip.
 * Calls onDone when it finishes or is skipped.
 */
export default function EditHintDemo({ onDone }: { onDone: () => void }) {
  const [still] = useState(prefersReducedMotion);

  useEffect(() => {
    const timer = window.setTimeout(onDone, still ? STILL_MS : DURATION_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDone();
      }
    };
    // Capture, so Esc skips the demo instead of closing the whole dialog.
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onDone, still]);

  const anim = (name: string) => (still ? undefined : `${name} ${DURATION_MS}ms ease-in-out forwards`);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="How editing works: drag over a part of the poster, then say what to change. Click to skip."
      className="absolute inset-0 z-10 cursor-pointer overflow-hidden rounded-lg"
      onPointerDown={(e) => {
        e.stopPropagation();
        onDone();
      }}
      style={{ background: "rgba(0,0,0,0.28)", animation: anim("ehd-fade") }}
    >
      <style>{`
        @keyframes ehd-fade { 0% { opacity: 0 } 6% { opacity: 1 } 90% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes ehd-pointer {
          0%   { left: 70%; top: 70%; }
          22%  { left: ${BOX.x * 100}%; top: ${BOX.y * 100}%; }
          55%  { left: ${(BOX.x + BOX.w) * 100}%; top: ${(BOX.y + BOX.h) * 100}%; }
          100% { left: ${(BOX.x + BOX.w) * 100}%; top: ${(BOX.y + BOX.h) * 100}%; }
        }
        @keyframes ehd-box {
          0%, 22% { width: 0; height: 0; opacity: 0; }
          24%     { opacity: 1; }
          55%, 100% { width: ${BOX.w * 100}%; height: ${BOX.h * 100}%; opacity: 1; }
        }
        @keyframes ehd-bubble {
          0%, 58% { opacity: 0; transform: translateY(6px); }
          66%, 100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Selection box */}
      <div
        aria-hidden
        className="absolute rounded-md"
        style={{
          left: `${BOX.x * 100}%`,
          top: `${BOX.y * 100}%`,
          width: `${BOX.w * 100}%`,
          height: `${BOX.h * 100}%`,
          border: "2px dashed #60a5fa",
          background: "rgba(96,165,250,0.12)",
          animation: anim("ehd-box"),
        }}
      />

      {/* Pointer */}
      <div
        aria-hidden
        className="absolute"
        style={{
          left: `${(BOX.x + BOX.w) * 100}%`,
          top: `${(BOX.y + BOX.h) * 100}%`,
          animation: anim("ehd-pointer"),
        }}
      >
        <MousePointer2 className="h-6 w-6 -translate-x-1 -translate-y-1 fill-white text-neutral-900 drop-shadow" />
      </div>

      {/* Sample instruction */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: `${(BOX.y + BOX.h) * 100 + 6}%` }}
      >
        <div style={{ animation: anim("ehd-bubble") }}>
          <div className="whitespace-nowrap rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-neutral-900 shadow-lg">
            “Make this text bigger”
          </div>
        </div>
      </div>

      <p className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white/85 drop-shadow">
        Drag over a part, then say what to change · tap to skip
      </p>
    </div>
  );
}
