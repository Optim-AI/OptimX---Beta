"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, ImageIcon, Sparkles } from "lucide-react";
import colors from "@/lib/ui/colors";
import AuthLivingSystem from "@/components/auth/AuthLivingSystem";
import { GoogleIcon } from "@/components/auth/oauth-icons";

const FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

type AuthShellProps = {
  accountSwitch: React.ReactNode;
  title: string;
  titleId: string;
  lead: string;
  onGoogle: () => void;
  onSubmit: (event: React.FormEvent) => void;
  submitLabel: string;
  loadingLabel: string;
  loading: boolean;
  error: string | null;
  info: string | null;
  secondary?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Split auth frame used by sign-in and sign-up.
 * Colors and type follow lib/ui/colors and the app font stack.
 */
export default function AuthShell({
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
  const theme = {
    "--auth-bg": colors.background,
    "--auth-fg": colors.foreground,
    "--auth-muted": colors.mutedForeground,
    "--auth-card": colors.card,
    "--auth-border": colors.border,
    "--auth-primary": colors.primary,
    "--auth-primary-fg": colors.primaryForeground,
    "--auth-gradient": colors.gradientPrimary,
    "--auth-hero": colors.gradientHero,
    "--auth-glow": colors.shadowGlow,
  } as React.CSSProperties;

  return (
    <>
      <style jsx global>{`
        .auth-stage,
        .auth-stage * {
          box-sizing: border-box;
        }
        .auth-stage {
          min-height: 100vh;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow: hidden;
          background:
            radial-gradient(900px 480px at 18% 80%, hsl(213 100% 55% / 0.16), transparent 60%),
            radial-gradient(700px 420px at 82% 12%, hsl(240 100% 62% / 0.12), transparent 55%),
            var(--auth-bg);
          color: var(--auth-fg);
          font-family: ${FONT};
          -webkit-font-smoothing: antialiased;
        }
        .auth-shell {
          width: min(1140px, 100%);
          height: min(760px, 100%);
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
          --auth-head-gap: 36px;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid hsl(0 0% 100% / 0.08);
          background: #101114;
          box-shadow: 0 24px 80px hsl(0 0% 0% / 0.45);
        }
        .auth-showcase {
          position: relative;
          overflow: hidden;
          min-height: 0;
          padding: 24px 28px 0;
          display: flex;
          flex-direction: column;
          background: #101820;
        }
        .auth-showcase-top {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .auth-logo {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: var(--auth-fg);
          font-weight: 600;
          font-size: 22px;
          letter-spacing: -0.04em;
        }
        .auth-logo img {
          height: 30px;
          width: auto;
          display: block;
        }
        .auth-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid hsl(0 0% 100% / 0.14);
          background: hsl(0 0% 100% / 0.04);
          color: var(--auth-fg);
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
        }
        .auth-back:hover {
          background: hsl(0 0% 100% / 0.08);
        }
        .auth-copy {
          position: relative;
          z-index: 2;
          margin-top: var(--auth-head-gap);
          max-width: 460px;
        }
        .auth-copy h2 {
          margin: 0;
          font-size: clamp(30px, 3.2vw, 40px);
          font-weight: 500;
          letter-spacing: -0.035em;
          line-height: 1.12;
          color: var(--auth-fg);
        }
        .auth-accent {
          background: var(--auth-hero);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .auth-copy p {
          margin: 16px 0 0;
          max-width: 420px;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.55;
          color: var(--auth-muted);
        }
        .auth-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 22px 0 0;
          padding: 0;
          list-style: none;
        }
        .auth-pills li {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid hsl(0 0% 100% / 0.1);
          background: hsl(0 0% 100% / 0.04);
          color: var(--auth-fg);
          font-size: 12.5px;
          font-weight: 500;
        }
        .auth-pills svg {
          color: var(--auth-primary);
          flex: none;
        }
        .auth-pane {
          background: #141416;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          min-height: 0;
          overflow: auto;
          padding: 24px 68px 32px;
        }
        .auth-frame {
          width: min(376px, 100%);
          margin-inline: auto;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          min-height: 0;
        }
        .auth-mobile-brand {
          display: none;
        }
        .auth-utility {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          flex: none;
          height: 34px;
        }
        .auth-switch {
          margin: 0;
          text-align: right;
          font-size: 13px;
          line-height: 20px;
          color: var(--auth-muted);
        }
        .auth-content {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          padding-top: var(--auth-head-gap);
        }
        .auth-switch a {
          color: var(--auth-fg);
          font-weight: 600;
          text-decoration: none;
        }
        .auth-switch a:hover {
          color: var(--auth-primary);
        }
        .auth-header {
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }
        .auth-pane h1 {
          margin: 0;
          min-height: 1.15em;
          font-size: 30px;
          font-weight: 600;
          letter-spacing: -0.035em;
          line-height: 1.15;
          color: var(--auth-fg);
        }
        .auth-lead {
          margin: 9px 0 0;
          max-width: 350px;
          min-height: 3em;
          font-size: 14px;
          line-height: 1.5;
          color: var(--auth-muted);
        }
        .auth-actions {
          display: flex;
          flex-direction: column;
          margin-top: 20px;
        }
        .auth-oauth {
          height: 44px;
          width: 100%;
          border-radius: 12px;
          border: 1px solid hsl(0 0% 28%);
          background: hsl(0 0% 10%);
          color: var(--auth-fg);
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          position: relative;
        }
        .auth-oauth:hover {
          border-color: hsl(0 0% 38%);
          background: hsl(0 0% 13%);
        }
        .auth-oauth svg {
          width: 18px;
          height: 18px;
          flex: none;
        }
        .auth-or {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          margin: 20px 0;
          color: var(--auth-muted);
          font-size: 13px;
          line-height: 1;
        }
        .auth-or::before,
        .auth-or::after {
          content: "";
          height: 1px;
          flex: 1;
          background: var(--auth-border);
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          width: 100%;
        }
        .auth-fields {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .auth-secondary {
          margin-top: 12px;
        }
        .auth-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .auth-field {
          position: relative;
        }
        .auth-input {
          width: 100%;
          height: 44px;
          border-radius: 12px;
          border: 1px solid var(--auth-border);
          background: hsl(0 0% 10%);
          color: var(--auth-fg);
          font-family: inherit;
          font-size: 14px;
          padding: 0 14px;
          outline: none;
        }
        .auth-input::placeholder {
          color: hsl(0 0% 48%);
        }
        .auth-input:focus {
          border-color: var(--auth-primary);
          box-shadow: 0 0 0 3px hsl(213 100% 55% / 0.18);
        }
        .auth-eye {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 34px;
          height: 34px;
          border: none;
          background: transparent;
          color: var(--auth-muted);
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .auth-eye:hover {
          color: var(--auth-fg);
        }
        .auth-agree {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--auth-muted);
        }
        .auth-agree input {
          appearance: none;
          width: 16px;
          height: 16px;
          margin-top: 1px;
          border-radius: 4px;
          border: 1px solid hsl(0 0% 36%);
          background: transparent;
          display: grid;
          place-items: center;
          flex: none;
          cursor: pointer;
        }
        .auth-agree input:checked {
          background: var(--auth-primary);
          border-color: var(--auth-primary);
        }
        .auth-agree input:checked::after {
          content: "";
          width: 8px;
          height: 5px;
          border-left: 2px solid white;
          border-bottom: 2px solid white;
          transform: rotate(-45deg) translateY(-1px);
        }
        .auth-agree a {
          color: var(--auth-primary);
          font-weight: 600;
          text-decoration: none;
        }
        .auth-agree a:hover {
          text-decoration: underline;
        }
        .auth-helpers {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
          margin: 0;
        }
        .auth-helpers button,
        .auth-helpers a {
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: var(--auth-primary);
          cursor: pointer;
          text-decoration: none;
        }
        .auth-helpers .quiet {
          color: var(--auth-muted);
        }
        .auth-msg {
          margin-top: 10px;
          font-size: 13px;
          line-height: 1.4;
        }
        .auth-submit {
          margin-top: 16px;
          height: 48px;
          width: 100%;
          border: none;
          border-radius: 12px;
          background: var(--auth-gradient);
          color: var(--auth-primary-fg);
          font-family: inherit;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          cursor: pointer;
          box-shadow: var(--auth-glow);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .auth-submit:hover:not(:disabled) {
          filter: brightness(1.06);
        }
        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        @media (max-width: 960px) {
          .auth-stage {
            height: auto;
            min-height: 100vh;
            overflow: auto;
            padding: 16px;
            align-items: stretch;
          }
          .auth-shell {
            grid-template-columns: 1fr;
            height: auto;
            min-height: calc(100vh - 32px);
          }
          .auth-showcase {
            display: flex;
            min-height: 0;
            padding: 0 12px;
          }
          .auth-showcase-top,
          .auth-copy {
            display: none;
          }
          .auth-pane {
            padding: 22px 24px 28px;
          }
          .auth-frame {
            width: 100%;
            max-width: none;
          }
          .auth-content {
            padding-top: 20px;
          }
          .auth-mobile-brand {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .auth-copy h2 {
            font-size: 32px;
          }
        }
        @media (max-width: 1100px) and (min-width: 961px) {
          .auth-pane {
            padding-left: 40px;
            padding-right: 40px;
          }
        }
        @media (max-height: 740px) and (min-width: 961px) {
          .auth-shell {
            --auth-head-gap: 22px;
          }
          .auth-copy h2 {
            font-size: 32px;
          }
        }
      `}</style>

      <div className="auth-stage" style={theme}>
        <div className="auth-shell">
          <section className="auth-showcase" aria-label="SkalX AI">
            <div className="auth-showcase-top">
              <Link href="/" className="auth-logo" aria-label="SkalX home">
                <img src="/images/SkalX_Mark.png" alt="SkalX" />
              </Link>
              <Link href="/" className="auth-back">
                <ArrowLeft size={14} strokeWidth={2} aria-hidden />
                Back to website
              </Link>
            </div>

            <div className="auth-copy">
              <h2>
                Your AI Marketing team,
                <br />
                from <span className="auth-accent">research to results.</span>
              </h2>
              <p>
                Turn your brand into high-performing campaigns with strategy, creatives, and
                publishing — all in one place.
              </p>
              <ul className="auth-pills">
                <li>
                  <Sparkles size={14} strokeWidth={2} aria-hidden />
                  AI Strategy &amp; Insights
                </li>
                <li>
                  <ImageIcon size={14} strokeWidth={2} aria-hidden />
                  Stunning Creatives
                </li>
                <li>
                  <BarChart3 size={14} strokeWidth={2} aria-hidden />
                  Publish &amp; Track Performance
                </li>
              </ul>
            </div>

            <AuthLivingSystem />
          </section>

          <section className="auth-pane">
            <div className="auth-frame">
              <div className="auth-mobile-brand">
                <Link href="/" className="auth-logo" aria-label="SkalX home">
                  <img src="/images/SkalX_Mark.png" alt="SkalX" />
                </Link>
                <Link href="/" className="auth-back">
                  <ArrowLeft size={14} strokeWidth={2} aria-hidden />
                  Back
                </Link>
              </div>
              <div className="auth-utility">{accountSwitch}</div>
              <div className="auth-content">
                <header className="auth-header">
                  <h1 id={titleId}>{title}</h1>
                  <p className="auth-lead">{lead}</p>
                </header>
                <div className="auth-actions" role="group" aria-label="Third party sign in">
                  <button className="auth-oauth" type="button" onClick={onGoogle}>
                    <GoogleIcon />
                    Continue with Google
                  </button>
                </div>
                <div className="auth-or" aria-hidden>
                  <span>or</span>
                </div>
                <form className="auth-form" aria-labelledby={titleId} onSubmit={onSubmit}>
                  <div className="auth-fields">{children}</div>
                  {secondary ? <div className="auth-secondary">{secondary}</div> : null}
                  {error ? (
                    <div className="auth-msg" style={{ color: colors.destructive }} role="alert">
                      {error}
                    </div>
                  ) : null}
                  {info ? (
                    <div className="auth-msg" style={{ color: colors.green600 }} role="status">
                      {info}
                    </div>
                  ) : null}
                  <button className="auth-submit" type="submit" disabled={loading}>
                    {loading ? loadingLabel : submitLabel}
                    {loading ? null : <ArrowRight size={16} aria-hidden />}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
