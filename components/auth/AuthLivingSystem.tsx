"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const CREATIVES = [
  {
    kind: "image" as const,
    src: "/images/auth/bombay-legend-365.jpg",
    title: "Legend 365",
    meta: "Product campaign",
    width: 796,
    height: 1024,
  },
  {
    kind: "image" as const,
    src: "/images/auth/plum-night-serum.jpg",
    title: "Night Serum",
    meta: "Beauty campaign",
    width: 1024,
    height: 584,
  },
  {
    kind: "video" as const,
    src: "/images/auth/creative-portrait.mp4",
    title: "Campaign film",
    meta: "Vertical video",
    width: 480,
    height: 848,
  },
  {
    kind: "video" as const,
    src: "/images/auth/creative-wide-1.mp4",
    title: "Campaign film",
    meta: "Video",
    width: 848,
    height: 480,
  },
  {
    kind: "video" as const,
    src: "/images/auth/creative-wide-2.mp4",
    title: "Campaign film",
    meta: "Video",
    width: 848,
    height: 480,
  },
  {
    kind: "video" as const,
    src: "/images/auth/creative-wide-3.mp4",
    title: "Campaign film",
    meta: "Video",
    width: 848,
    height: 480,
  },
];

const LIFTS = [24.8, 25.1, 24.6];

/**
 * Lower-left product visualization for the auth showcase.
 * Decorative only — no auth behavior.
 */
export default function AuthLivingSystem(): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [creativeIndex, setCreativeIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setPhase((current) => (current + 1) % 3);
    }, 6500);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || phase !== 1) return;
    setCreativeIndex((current) => (current + 1) % CREATIVES.length);
  }, [phase, reduceMotion]);

  const creative = CREATIVES[creativeIndex];
  const lift = LIFTS[phase] ?? LIFTS[0];

  return (
    <div className={`auth-living${reduceMotion ? " is-still" : ""}`} aria-hidden>
      <style jsx global>{`
        .auth-living {
          position: relative;
          z-index: 2;
          flex: 1 1 auto;
          min-height: 230px;
          margin-top: 18px;
          overflow: hidden;
        }
        .auth-living-glow {
          position: absolute;
          left: 28%;
          bottom: -20%;
          width: 58%;
          height: 70%;
          background: radial-gradient(circle, hsl(213 100% 55% / 0.22), transparent 68%);
          pointer-events: none;
        }
        .auth-living-links {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .auth-living-links path {
          fill: none;
          stroke: hsl(213 100% 65% / 0.45);
          stroke-width: 1.25;
          stroke-linecap: round;
          stroke-dasharray: 5 7;
          animation: living-dash 7s linear infinite;
        }
        @keyframes living-dash {
          to {
            stroke-dashoffset: -80;
          }
        }
        .living-card {
          position: absolute;
          border: 1px solid hsl(0 0% 100% / 0.08);
          background: linear-gradient(145deg, hsl(0 0% 16%) 0%, hsl(0 0% 11%) 100%);
          box-shadow: 0 8px 32px hsl(0 0% 0% / 0.5);
          color: hsl(0 0% 95%);
        }
        .living-card.is-active {
          border-color: hsl(213 100% 65% / 0.5);
          box-shadow: 0 0 24px hsl(213 100% 55% / 0.22), 0 12px 32px hsl(0 0% 0% / 0.45);
        }
        .living-kicker {
          margin: 0;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: hsl(213 100% 70%);
        }
        .living-intel {
          left: 0;
          top: 0;
          width: min(198px, 38%);
          z-index: 3;
          border-radius: 16px;
          padding: 12px 12px 10px;
        }
        .living-intel p {
          margin: 6px 0 0;
          font-size: 12.5px;
          line-height: 1.35;
          letter-spacing: -0.02em;
          font-weight: 500;
        }
        .living-segments {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 8px;
        }
        .living-segments span {
          height: 18px;
          padding: 0 7px;
          border-radius: 999px;
          background: hsl(213 80% 18%);
          color: hsl(213 100% 75%);
          font-size: 10px;
          line-height: 18px;
          font-weight: 500;
        }
        .living-spark {
          display: block;
          width: 100%;
          height: 28px;
          margin-top: 6px;
        }
        .living-spark path {
          fill: none;
          stroke: hsl(213 100% 65%);
          stroke-width: 1.6;
          stroke-linecap: round;
          stroke-dasharray: 120;
          stroke-dashoffset: 0;
          animation: living-draw 2.8s ease forwards;
        }
        .auth-living.is-still .living-spark path,
        .auth-living.is-still .auth-living-links path {
          animation: none;
        }
        @keyframes living-draw {
          from {
            stroke-dashoffset: 120;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        .living-creative {
          z-index: 4;
          border-radius: 18px;
          overflow: hidden;
          background: #101114;
        }
        .living-creative.is-portrait {
          left: 30%;
          bottom: 0;
          height: 96%;
          width: auto;
          max-width: 70%;
        }
        .living-creative.is-wide {
          left: 24%;
          top: 16%;
          width: min(72%, 380px);
          height: auto;
          max-height: 72%;
        }
        .living-creative-media {
          position: absolute;
          inset: 0;
        }
        .living-creative-media img,
        .living-creative-media video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          display: block;
          background: #101114;
        }
        .living-creative-shade {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 34%;
          background: linear-gradient(to top, hsl(0 0% 4% / 0.88), transparent);
        }
        .living-creative-meta {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .living-creative-meta strong {
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.03em;
        }
        .living-creative-meta span {
          font-size: 11px;
          color: hsl(0 0% 72%);
        }
        .living-tools {
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          gap: 4px;
        }
        .living-tools i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: hsl(0 0% 100% / 0.35);
          display: block;
        }
        .living-tools i.on {
          background: hsl(213 100% 65%);
          box-shadow: 0 0 8px hsl(213 100% 55% / 0.7);
        }
        .living-analytics {
          right: 0;
          top: 2%;
          width: min(164px, 32%);
          z-index: 5;
          border-radius: 16px;
          padding: 12px;
        }
        .living-lift {
          margin: 4px 0 0;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.04em;
          color: #22c55e;
          line-height: 1.1;
        }
        .living-metric-label {
          margin: 0;
          font-size: 11px;
          color: hsl(0 0% 60%);
        }
        .living-line {
          display: block;
          width: 100%;
          height: 36px;
          margin-top: 4px;
        }
        .living-line path {
          fill: none;
          stroke: hsl(213 100% 65%);
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .living-analytics.is-active .living-line path {
          stroke-dasharray: 140;
          animation: living-draw 2.4s ease forwards;
        }
        .auth-living.is-still .living-line path {
          stroke-dashoffset: 0;
          animation: none;
        }
        .living-stats {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 4px;
          font-size: 10px;
          color: hsl(0 0% 60%);
        }
        .living-stats b {
          display: block;
          color: hsl(0 0% 92%);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.02em;
        }
        @media (max-width: 960px) {
          .auth-living {
            min-height: 148px;
            height: 148px;
            flex: none;
            margin: 4px 0 8px;
          }
          .living-intel,
          .auth-living-links,
          .auth-living-glow {
            display: none;
          }
          .living-creative.is-portrait {
            left: 2%;
            height: 100%;
          }
          .living-creative.is-wide {
            left: 2%;
            top: 8%;
            width: 78%;
          }
          .living-analytics {
            display: block;
            width: 46%;
            right: 2%;
            top: 14%;
          }
        }
        @media (max-width: 1100px) and (min-width: 961px) {
          .living-analytics,
          .auth-living-links .path-performance,
          .auth-living-links .particle-b {
            display: none;
          }
          .living-creative.is-portrait {
            left: 26%;
          }
          .living-creative.is-wide {
            left: 18%;
            width: min(64%, 320px);
          }
        }
        @media (max-height: 740px) and (min-width: 961px) {
          .auth-living {
            min-height: 180px;
          }
          .living-intel {
            width: min(176px, 36%);
            padding: 10px;
          }
          .living-creative.is-portrait {
            left: 28%;
            height: 100%;
          }
          .living-creative.is-wide {
            width: min(60%, 300px);
            top: 12%;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-living-links path,
          .living-spark path,
          .living-line path {
            animation: none !important;
          }
          .living-line path {
            stroke-dashoffset: 0;
          }
        }
      `}</style>

      <div className="auth-living-glow" />

      <svg className="auth-living-links" viewBox="0 0 560 280" preserveAspectRatio="none">
        <path d="M78 58 C 140 78, 180 108, 230 132" />
        <path className="path-performance" d="M300 150 C 360 132, 410 108, 470 88" />
        {reduceMotion ? null : (
          <>
            <circle r="2.4" fill="hsl(213 100% 70%)">
              <animateMotion
                dur="6.5s"
                repeatCount="indefinite"
                path="M78 58 C 140 78, 180 108, 230 132"
              />
            </circle>
            <circle className="particle-b" r="2.4" fill="hsl(213 100% 70%)">
              <animateMotion
                dur="6.5s"
                begin="-3.2s"
                repeatCount="indefinite"
                path="M300 150 C 360 132, 410 108, 470 88"
              />
            </circle>
          </>
        )}
      </svg>

      <motion.article
        className={`living-card living-intel${phase === 0 ? " is-active" : ""}`}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="living-kicker">Audience insight</p>
        <p>Weekend buyers respond 28% more to evening creatives.</p>
        <div className="living-segments">
          <span>Evening</span>
          <span>Offer-led</span>
          <span>Mobile</span>
        </div>
        <svg className="living-spark" viewBox="0 0 180 28" preserveAspectRatio="none">
          <path d="M1 20 C 18 18, 24 8, 40 12 S 62 22, 78 14 S 104 4, 124 10 S 156 20, 179 8" />
        </svg>
      </motion.article>

      <motion.article
        className={`living-card living-creative ${creative.height > creative.width ? "is-portrait" : "is-wide"}${phase === 1 ? " is-active" : ""}`}
        style={{ aspectRatio: `${creative.width} / ${creative.height}` }}
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={
          reduceMotion
            ? undefined
            : { duration: 8, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <div className="living-creative-media">
          {creative.kind === "image" ? (
            <img src={creative.src} alt="" />
          ) : (
            <video
              key={creative.src}
              src={creative.src}
              muted
              loop
              playsInline
              autoPlay={!reduceMotion}
              preload="metadata"
            />
          )}
        </div>
        <div className="living-tools">
          <i />
          <i className="on" />
          <i />
        </div>
        <div className="living-creative-shade" />
        <div className="living-creative-meta">
          <strong>{creative.title}</strong>
          <span>{creative.meta}</span>
        </div>
      </motion.article>

      <motion.article
        className={`living-card living-analytics${phase === 2 ? " is-active" : ""}`}
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: reduceMotion ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="living-kicker">Performance</p>
        <p className="living-lift">+{lift.toFixed(1)}%</p>
        <p className="living-metric-label">CTR</p>
        <svg className="living-line" viewBox="0 0 140 36" preserveAspectRatio="none">
          <path d="M2 28 C 16 26, 22 18, 34 20 S 52 8, 66 14 S 88 30, 104 16 S 126 6, 138 10" />
        </svg>
        <div className="living-stats">
          <span>
            <b>12.4k</b>
            Impressions
          </span>
          <span>
            <b>386</b>
            Conversions
          </span>
        </div>
      </motion.article>
    </div>
  );
}
