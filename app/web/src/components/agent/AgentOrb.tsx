// The Marketing Agent's mark: a living colour orb. The colours turn and drift through
// the spectrum under a fixed light, and the glow breathes and changes colour with them.
// While the agent is working it turns faster and glows brighter. Respects "reduce motion".
import React from "react";

export default function AgentOrb({ size = 96, active = false, className = "" }: { size?: number; active?: boolean; className?: string }) {
  const glow = Math.max(6, Math.round(size * 0.5));
  return (
    <span
      className={`agent-orb ${active ? "is-active" : ""} ${className}`}
      style={{ width: size, height: size, ["--glow" as string]: `${glow}px` }}
      aria-hidden="true"
    >
      <span className="agent-orb__halo" />
      <span className="agent-orb__body">
        <span className="agent-orb__spin" />
        <span className="agent-orb__light" />
        <span className="agent-orb__shade" />
      </span>
      <style jsx>{`
        .agent-orb {
          position: relative;
          display: inline-block;
          flex-shrink: 0;
          border-radius: 9999px;
        }
        .agent-orb__halo {
          position: absolute;
          inset: 4%;
          border-radius: 9999px;
          background: conic-gradient(from 0deg, #7f9ff5, #c4a6f2, #f7a6c8, #ffc98f, #8fd0f6, #7f9ff5);
          filter: blur(calc(var(--glow) * 0.45));
          opacity: 0.55;
          animation: agentOrbHalo 6s ease-in-out infinite, agentOrbHaloHue 12s linear infinite;
        }
        .agent-orb__body {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 9999px;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
          animation: agentOrbFloat 6s ease-in-out infinite;
        }
        .agent-orb__spin {
          position: absolute;
          inset: -4%;
          border-radius: 9999px;
          background: conic-gradient(
            from 200deg at 52% 50%,
            #ffd8a8,
            #f7a6c8 70deg,
            #c4a6f2 140deg,
            #7f9ff5 200deg,
            #8fd0f6 250deg,
            #e6f1fb 300deg,
            #ffd8a8
          );
          animation: agentOrbSpin 14s linear infinite, agentOrbHue 18s ease-in-out infinite;
        }
        .agent-orb__light {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.5) 12%, rgba(255, 255, 255, 0) 40%);
          mix-blend-mode: screen;
        }
        .agent-orb__shade {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: radial-gradient(circle at 70% 80%, rgba(30, 20, 80, 0.25) 0%, rgba(30, 20, 80, 0) 55%);
        }
        .is-active .agent-orb__spin {
          animation-duration: 3s, 6s;
        }
        .is-active .agent-orb__halo {
          opacity: 0.9;
          animation-duration: 1.6s, 4s;
        }
        @keyframes agentOrbSpin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes agentOrbHue {
          0%,
          100% {
            filter: hue-rotate(0deg) saturate(1.05);
          }
          50% {
            filter: hue-rotate(-28deg) saturate(1.15);
          }
        }
        @keyframes agentOrbHaloHue {
          from {
            filter: blur(calc(var(--glow) * 0.45)) hue-rotate(0deg);
          }
          to {
            filter: blur(calc(var(--glow) * 0.45)) hue-rotate(360deg);
          }
        }
        @keyframes agentOrbHalo {
          0%,
          100% {
            transform: scale(0.95);
            opacity: 0.45;
          }
          50% {
            transform: scale(1.12);
            opacity: 0.8;
          }
        }
        @keyframes agentOrbFloat {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .agent-orb__spin,
          .agent-orb__halo,
          .agent-orb__body {
            animation: none;
          }
        }
      `}</style>
    </span>
  );
}
