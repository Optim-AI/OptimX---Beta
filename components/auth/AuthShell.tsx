"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { GoogleIcon } from "@/components/auth/oauth-icons";
import { TRY_STEPS } from "@/app/web/src/components/onboarding/TryStepper";
import { OnboardingStage } from "@/app/web/src/components/onboarding/ob-ui";
import { PILLARS } from "@/lib/marketing/content";

type AuthShellProps = {
  /** "signup" shows what happens after creating an account; "signin" shows what SkalX does. */
  variant?: "signin" | "signup";
  accountSwitch: React.ReactNode;
  title: string;
  titleId: string;
  lead: string;
  onGoogle: () => void;
  onSubmit: (event: React.FormEvent) => void;
  submitLabel: string;
  loadingLabel: string;
  loading: boolean;
  error: React.ReactNode | null;
  info: string | null;
  secondary?: React.ReactNode;
  children: React.ReactNode;
};

/** One line per onboarding step, shown to new accounts. */
const NEXT_STEP_DETAIL: Record<(typeof TRY_STEPS)[number], string> = {
  "Your brand": "Share your brand name and website.",
  "Brand profile": "SkalX reads your site and builds your brand profile.",
  "Free demo": "See sample ads made for your brand. No card needed.",
  "Choose a plan": "Pick a monthly plan when you're ready, or keep exploring.",
};

/** Brand side: website copy and steps, no invented metrics. */
function BrandPanel({ variant }: { variant: "signin" | "signup" }) {
  return (
    <div className="flex h-full flex-col">
      <p className="mb-5 inline-flex items-center gap-3 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-accent-on-ink">
        <span aria-hidden className="h-px w-6 bg-paper/30" />
        For D2C, marketing teams, solo founders
      </p>
      <p className="font-display text-[clamp(2.1rem,3.6vw,3.25rem)] font-semibold leading-[1] tracking-[-0.04em]">
        Your Marketing.
        <br />
        All Figured Out.
      </p>
      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-paper/65">
        SkalX handles it all, from research and strategy to ready-to-use content, so you can focus on growing your
        business.
      </p>

      {variant === "signup" ? (
        <div className="mt-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-paper/55">What happens next</p>
          <ol className="border-t border-paper/10">
            {TRY_STEPS.map((step, i) => (
              <li
                key={step}
                className="ob-enter grid grid-cols-[2.25rem_1fr] gap-x-3 border-b border-paper/10 py-3.5"
                style={{ "--d": `${200 + i * 90}ms` } as React.CSSProperties}
              >
                <span aria-hidden className="font-display text-sm font-semibold tabular-nums text-accent-on-ink">
                  0{i + 1}
                </span>
                <span>
                  <span className="block text-[15px] font-medium text-paper">{step}</span>
                  <span className="mt-0.5 block text-[13.5px] text-paper/55">{NEXT_STEP_DETAIL[step]}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="mt-10">
          <ol className="border-t border-paper/10">
            {PILLARS.map((p, i) => (
              <li
                key={p.id}
                className="ob-enter grid grid-cols-[2.25rem_1fr] gap-x-3 border-b border-paper/10 py-3.5"
                style={{ "--d": `${200 + i * 90}ms` } as React.CSSProperties}
              >
                <span aria-hidden className="font-display text-sm font-semibold tabular-nums text-accent-on-ink">
                  0{i + 1}
                </span>
                <span>
                  <span className="block text-[15px] font-medium text-paper">{p.title}</span>
                  <span className="mt-0.5 block text-[13.5px] text-paper/55">{p.lead}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="mt-auto pt-10 text-xs text-paper/45">Built in Chennai · Monthly plans · Cancel anytime</p>
    </div>
  );
}

/** Form classes shared by every auth page (inputs, labels, checkbox, helper links). */
function AuthStyles() {
  return (
    <style jsx global>{`
        .auth-switch {
          margin: 0;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
        }
        .auth-switch a {
          color: var(--color-paper);
          font-weight: 600;
          text-decoration: underline;
          text-decoration-color: rgba(255, 255, 255, 0.3);
          text-underline-offset: 4px;
        }
        .auth-switch a:hover {
          text-decoration-color: currentColor;
        }
        .auth-label {
          display: block;
          margin-bottom: 6px;
          font-size: 13.5px;
          font-weight: 500;
          color: var(--color-paper);
        }
        .auth-field {
          position: relative;
        }
        .auth-input {
          width: 100%;
          height: 48px;
          border-radius: 14px;
          padding: 0 16px;
          font-family: inherit;
          font-size: 15px;
          background: var(--ob-bg);
          border: 1px solid var(--ob-line-strong);
          color: var(--color-paper);
          transition: border-color 0.2s ease;
        }
        .auth-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        .auth-input:hover {
          border-color: rgba(255, 255, 255, 0.35);
        }
        .auth-input:focus-visible {
          outline: 2px solid var(--color-accent-on-ink);
          outline-offset: 2px;
          border-color: rgba(255, 255, 255, 0.5);
        }
        .auth-eye {
          position: absolute;
          right: 6px;
          bottom: 6px;
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: rgba(255, 255, 255, 0.6);
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .auth-eye:hover {
          color: var(--color-paper);
          background: rgba(255, 255, 255, 0.06);
        }
        .auth-hint {
          margin: 6px 0 0;
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.5);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .auth-hint[data-ok="true"] {
          color: var(--color-accent-on-ink);
        }
        .auth-agree {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 0;
          font-size: 13.5px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.65);
          cursor: pointer;
        }
        .auth-agree input {
          appearance: none;
          width: 18px;
          height: 18px;
          margin-top: 1px;
          border-radius: 5px;
          border: 1px solid rgba(255, 255, 255, 0.35);
          background: transparent;
          display: grid;
          place-items: center;
          flex: none;
          cursor: pointer;
          transition: background-color 0.15s, border-color 0.15s;
        }
        .auth-agree input:checked {
          background: var(--color-paper);
          border-color: var(--color-paper);
        }
        .auth-agree input:checked::after {
          content: "";
          width: 9px;
          height: 5px;
          border-left: 2px solid var(--color-ink);
          border-bottom: 2px solid var(--color-ink);
          transform: rotate(-45deg) translateY(-1px);
        }
        .auth-agree a,
        .auth-helpers a,
        .auth-msg a {
          color: var(--color-paper);
          font-weight: 500;
          text-decoration: underline;
          text-decoration-color: rgba(255, 255, 255, 0.35);
          text-underline-offset: 3px;
        }
        .auth-agree a:hover,
        .auth-helpers a:hover,
        .auth-msg a:hover {
          text-decoration-color: currentColor;
        }
        .auth-helpers {
          display: flex;
          justify-content: flex-end;
          margin: 0;
          font-size: 13.5px;
        }
        .auth-helpers .quiet {
          color: rgba(255, 255, 255, 0.7);
        }
      `}</style>
  );
}

/** Logo, "Back to website" and an optional right-hand slot (account switch). */
function AuthTopBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 py-5">
      <div className="flex items-center gap-4">
        <Link href="/" aria-label="SkalX home" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/SkalX_Logo.png" alt="SkalX" className="h-6 w-auto" />
        </Link>
        <Link
          href="/"
          className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-paper/65 transition-colors hover:bg-paper/[0.06] hover:text-paper sm:inline-flex"
        >
          <ArrowLeft size={14} aria-hidden /> Back to website
        </Link>
      </div>
      {right ? <div className="text-right">{right}</div> : null}
    </header>
  );
}

/** Message box under a form: error (red) or status (accent). */
export function AuthMessage({ kind, children }: { kind: "error" | "info"; children: React.ReactNode }) {
  return kind === "error" ? (
    <div
      className="auth-msg ob-enter rounded-2xl border border-[hsl(0_84%_60%/0.3)] bg-[hsl(0_84%_55%/0.08)] px-4 py-3 text-[13.5px] leading-relaxed text-[hsl(0_90%_78%)]"
      role="alert"
    >
      {children}
    </div>
  ) : (
    <div
      className="auth-msg ob-enter rounded-2xl border border-accent-on-ink/30 bg-accent-on-ink/[0.08] px-4 py-3 text-[13.5px] leading-relaxed text-paper"
      role="status"
    >
      {children}
    </div>
  );
}

/**
 * Single centred card for the smaller auth steps (forgot / reset password), in the same
 * design as the sign-in and sign-up screens.
 */
export function AuthCard({
  title,
  titleId,
  lead,
  children,
  footer,
}: {
  title: string;
  titleId: string;
  lead: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="ob-root relative min-h-screen">
      <AuthStyles />
      <OnboardingStage step={0} />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6">
        <AuthTopBar />
        <main className="flex flex-1 items-start justify-center pb-16 pt-6 sm:items-center sm:pt-0">
          <section aria-labelledby={titleId} className="ob-enter ob-glass w-full max-w-[440px] rounded-[24px] p-6 sm:p-8">
            <h1
              id={titleId}
              className="font-display text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[2.1rem]"
            >
              {title}
            </h1>
            <p className="mt-2 text-[15px] text-paper/65">{lead}</p>
            <div className="mt-7">{children}</div>
            {footer ? <div className="mt-6 border-t border-paper/10 pt-5 text-sm text-paper/60">{footer}</div> : null}
          </section>
        </main>
      </div>
    </div>
  );
}

/**
 * Split auth frame used by sign-in and sign-up, in the website's design system (dark, neutral
 * charcoal — the same tokens as /try and the free audit).
 * Desktop: brand panel left, form right. Mobile: form first, brand panel below it.
 */
export default function AuthShell({
  variant = "signin",
  accountSwitch,
  title,
  titleId,
  lead,
  onGoogle,
  onSubmit,
  submitLabel,
  loadingLabel,
  loading,
  error,
  info,
  secondary,
  children,
}: AuthShellProps): React.ReactElement {
  return (
    <div className="ob-root relative min-h-screen">
      <AuthStyles />

      <OnboardingStage step={0} />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6">
        <AuthTopBar right={accountSwitch} />

        <div className="grid flex-1 items-start gap-8 pb-10 pt-4 lg:grid-cols-[1fr_minmax(0,440px)] lg:gap-16 lg:pt-12">
          {/* Form (first on mobile). */}
          <section aria-labelledby={titleId} className="lg:order-2">
            <div className="ob-enter ob-glass rounded-[24px] p-6 sm:p-8">
              <h1
                id={titleId}
                className="font-display text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[2.1rem]"
              >
                {title}
              </h1>
              <p className="mt-2 text-[15px] text-paper/65">{lead}</p>

              <button
                type="button"
                onClick={onGoogle}
                className="mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-paper/20 bg-transparent text-[15px] font-medium text-paper transition-colors hover:border-paper/40 hover:bg-paper/[0.05]"
              >
                <span className="flex h-5 w-5 items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]">
                  <GoogleIcon />
                </span>
                Continue with Google
              </button>

              <div aria-hidden className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-paper/45">
                <span className="h-px flex-1 bg-paper/10" />
                or with email
                <span className="h-px flex-1 bg-paper/10" />
              </div>

              <form aria-labelledby={titleId} onSubmit={onSubmit} noValidate>
                <div className="flex flex-col gap-4">{children}</div>
                {secondary ? <div className="mt-4">{secondary}</div> : null}
                {error ? (
                  <div className="mt-4">
                    <AuthMessage kind="error">{error}</AuthMessage>
                  </div>
                ) : null}
                {info ? (
                  <div className="mt-4">
                    <AuthMessage kind="info">{info}</AuthMessage>
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={loading}
                  className="ob-btn group mt-6 h-12 w-full rounded-full text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? loadingLabel : submitLabel}
                  {loading ? null : (
                    <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                  )}
                </button>
              </form>
            </div>
          </section>

          {/* Brand panel (below the form on mobile). */}
          <aside aria-label="About SkalX" className="ob-enter lg:order-1 lg:pr-4" style={{ "--d": "120ms" } as React.CSSProperties}>
            <BrandPanel variant={variant} />
          </aside>
        </div>
      </div>
    </div>
  );
}
