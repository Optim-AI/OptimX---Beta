// Loaders, by context (animations in styles/globals.css):
//  ArcSpinner   — buttons and small inline waits
//  DotWave      — AI replies (strategist, chat, research)
//  ShimmerTile  — grid placeholders (base Skeleton shimmers too)
//  StepProgress — long jobs: names what's happening, step by step
import * as React from "react";
import { cn } from "../../../../../lib/utils";
import colors from "@/lib/ui/colors";

type SpinnerProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** Pixel size; otherwise h-/w- classes or 1em */
  size?: number;
};

/** Gradient arc spinner. Takes the text colour; drop-in for `<Loader2 className="… animate-spin" />`. */
export function ArcSpinner({ size, className, style, ...rest }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      {...rest}
      className={cn("sx-arc h-[1em] w-[1em]", className?.replace(/\banimate-spin\b/g, ""))}
      style={size ? { width: size, height: size, ...style } : style}
    />
  );
}

/** Three dots in a wave — "the AI is working on a reply". */
export function DotWave({ className, style, label = "Thinking" }: { className?: string; style?: React.CSSProperties; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("sx-dot-wave inline-flex items-center gap-[0.3em]", className)} style={style}>
      <span />
      <span />
      <span />
    </span>
  );
}

/** A shimmering placeholder block (grid cards, thumbnails). */
export function ShimmerTile({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn("sx-shimmer rounded-xl", className)} style={{ background: colors.muted, ...style }} />;
}

/** A grid of shimmering cards with a title line, for lists that are loading. */
export function ShimmerGrid({ count = 4, className, tileClassName }: { count?: number; className?: string; tileClassName?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2">
          <ShimmerTile className={cn("aspect-square", tileClassName)} />
          <ShimmerTile className="h-3 w-3/4 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Long-running job: what's happening now, step N of M, and a bar that eases toward
 * the end over `estimatedMs` (never claims to be done before it is).
 * Pass `step` to drive it from real progress; otherwise steps advance on a timer.
 */
export function StepProgress({
  steps,
  step,
  estimatedMs = 30_000,
  className,
  hint,
}: {
  steps: string[];
  step?: number;
  estimatedMs?: number;
  className?: string;
  hint?: string;
}) {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 250);
    return () => clearInterval(t);
  }, []);
  const timed = Math.min(steps.length - 1, Math.floor((elapsed / estimatedMs) * steps.length));
  const current = Math.max(0, Math.min(steps.length - 1, step ?? timed));
  // Eases toward 92% so a slow job keeps visibly moving without hitting 100%.
  const pct = Math.round(92 * (1 - Math.exp((-2.2 * elapsed) / estimatedMs)));
  const shown = Math.max(pct, Math.round((current / steps.length) * 100));
  return (
    <div role="status" aria-live="polite" className={cn("w-full max-w-sm", className)}>
      <p key={current} className="sx-step-text text-sm font-medium" style={{ color: colors.foreground }}>
        {steps[current]}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: colors.muted }}>
        <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${shown}%`, background: colors.primary }} />
      </div>
      <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>
        Step {current + 1} of {steps.length}
        {hint ? ` · ${hint}` : ""}
      </p>
    </div>
  );
}
