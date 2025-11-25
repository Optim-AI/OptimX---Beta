"use client";

import React, { useRef, useState, useEffect } from "react";
import { Button } from "./ui/button";
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Zap,
  User,
} from "lucide-react";
import colors from "../../../../lib/colors";

/** Convert "hsl(H S% L%)" -> "hsla(H, S%, L%, a)" for inline usage */
function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(
    /hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i
  );
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  if (/rgba?\(|hsla?\(/i.test(token)) return token;
  return token;
}

const Hero: React.FC = () => {
  const heroRef = useRef<HTMLElement | null>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLAnchorElement | null>(null);
  const illustrationRef = useRef<HTMLDivElement | null>(null);

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Track mouse position relative to hero section
  useEffect(() => {
    const heroElement = heroRef.current;
    if (!heroElement) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = heroElement.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    heroElement.addEventListener("mousemove", handleMouseMove);
    return () => heroElement.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Magnetic movement effect: returns style to apply
  const getMagneticStyle = (
    element: HTMLElement | null,
    strength: number = 0.15
  ): React.CSSProperties => {
    if (!element || !heroRef.current) return {};

    const rect = element.getBoundingClientRect();
    const heroRect = heroRef.current.getBoundingClientRect();
    const elementCenterX = rect.left + rect.width / 2 - heroRect.left;
    const elementCenterY = rect.top + rect.height / 2 - heroRect.top;

    const distanceX = mousePosition.x - elementCenterX;
    const distanceY = mousePosition.y - elementCenterY;
    const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);
    const maxDistance = 200;

    if (distance < maxDistance) {
      const factor = (1 - distance / maxDistance) * strength;
      return {
        transform: `translate(${distanceX * factor}px, ${
          distanceY * factor
        }px)`,
        transition: "transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
        willChange: "transform",
      };
    }

    return {
      transform: "translate(0px, 0px)",
      transition: "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
      willChange: "transform",
    };
  };

  return (
    <section
      ref={heroRef}
      id="home"
      className="pt-32 pb-24 min-h-screen flex items-center relative overflow-hidden"
      style={{
        backgroundColor: colors.background,
        color: colors.foreground,
      }}
    >
      {/* Scoped styles to power the left→right reveal + floats */}
      <style jsx>{`
        /* container fade-in */
        .animation-fade-in {
          opacity: 0;
          transform: translateX(-10px);
          animation: fadeIn 0.65s ease forwards;
        }
        @keyframes fadeIn {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* left-to-right reveal using scaleX (transform-origin: left) */
        .reveal-left {
          display: inline-block;
          transform-origin: left;
          transform: scaleX(0);
          opacity: 0;
          animation: revealLeft 0.8s cubic-bezier(0.2, 0.9, 0.2, 1) forwards;
        }
        @keyframes revealLeft {
          from {
            transform: scaleX(0);
            opacity: 0;
          }
          to {
            transform: scaleX(1);
            opacity: 1;
          }
        }

        /* subtle float for orbs */
        .animation-float {
          animation: floatY 6s ease-in-out infinite alternate;
        }
        @keyframes floatY {
          from {
            transform: translateY(-8px);
          }
          to {
            transform: translateY(8px);
          }
        }

        /* icon pulse */
        .icon-pulse {
          animation: iconPulse 1.8s ease-in-out infinite;
        }
        @keyframes iconPulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.06);
            opacity: 0.86;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* CTA arrow hover */
        .cta-arrow {
          transition: transform 0.22s ease;
        }
        a.group:hover .cta-arrow {
          transform: translateX(6px);
        }

        /* gradient text helper */
        .gradient-text {
          display: inline-block;
        }

        /* radiant animated glow behind headline */
        .hero-radiance {
          pointer-events: none;
          animation: heroGlow 6s ease-in-out infinite alternate;
        }
        @keyframes heroGlow {
          0% {
            transform: translateY(-6px) scale(0.98);
            opacity: 0.55;
          }
          100% {
            transform: translateY(6px) scale(1.04);
            opacity: 0.95;
          }
        }
      `}</style>

      {/* Background Layers */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(135deg, ${
            colors.background
          } 0%, ${withAlpha("hsl(213 90% 96%)", 0.3)} 50%, ${
            colors.background
          } 100%)`,
        }}
      />
      <div
        className="absolute inset-0 mesh-gradient"
        style={{
          background: colors.gradientMesh,
          opacity: 0.4,
        }}
      />

      {/* Animated Orbs */}
      <div
        className="absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl animation-float"
        style={{ backgroundColor: withAlpha(colors.primary, 0.3) }}
      />
      <div
        className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl animation-float"
        style={{
          backgroundColor: withAlpha(colors.primary, 0.2),
          animationDelay: "2s",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl animation-float"
        style={{
          backgroundImage: `linear-gradient(90deg, ${withAlpha(
            colors.primary,
            0.1
          )} 0%, ${withAlpha(
            colors.primaryGlow ?? colors.primary,
            0.08
          )} 100%)`,
          animationDelay: "4s",
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
          {/* LEFT COLUMN */}
          <div className="text-center lg:text-left animation-fade-in">
            {/* Premium Badge */}
            <div
              ref={badgeRef}
              className="inline-flex items-center space-x-2 mb-6 px-5 py-2.5 rounded-full shadow-glow"
              style={{
                ...(getMagneticStyle(badgeRef.current, 0.2) as any),
                background: colors.glassBg,
                border: `1px solid ${withAlpha(colors.primary, 0.3)}`,
                boxShadow: colors.shadowGlow,
                color: colors.primary,
              }}
            >
              <Sparkles
                className="h-4 w-4 icon-pulse"
                style={{ color: colors.primary }}
              />
              <span
                style={{ color: colors.primary, fontWeight: 600, fontSize: 14 }}
              >
                AI-Powered Marketing Platform
              </span>
            </div>

            {/* Headline + radiant animated graphics */}
            <div className="relative inline-block text-center lg:text-left mb-6">
              {/* Radiant glow behind the text */}
              <div
                className="absolute -inset-x-10 -inset-y-6 blur-3xl hero-radiance"
                style={{
                  backgroundImage: `radial-gradient(circle at 20% 0%, ${withAlpha(
                    colors.primaryGlow ?? colors.primary,
                    0.55
                  )} 0, transparent 55%), radial-gradient(circle at 80% 100%, ${withAlpha(
                    colors.primary,
                    0.45
                  )} 0, transparent 60%)`,
                  zIndex: 0,
                }}
              />

              <h1 className="relative z-10 text-4xl md:text-6xl lg:text-4xl font-bold leading-[1.02] text-center lg:text-left">
                <span
                  className="reveal-left"
                  style={{
                    animationDelay: "0.18s",
                    color: colors.foreground,
                  }}
                >
                  Do marketing like the big brands{" "}
                </span>

                <span
                  className="reveal-left text-left"
                  style={{
                    animationDelay: "0.38s",
                    backgroundImage: colors.gradientHero,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    color: "transparent",
                    display: "block",
                  }}
                >
                  without the big budget or team.
                </span>
              </h1>
            </div>

            {/* Subheadline */}
            <p
              className="text-lg md:text-xl mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
              style={{ color: colors.mutedForeground }}
            >
              Launch campaigns across Google, Meta(Facebook), Instagram & WhatsApp in
              minutes.{" "}
              <span style={{ fontWeight: 600, color: colors.foreground }}>
                No agencies. No complexity.
              </span>{" "}
              Just results.
            </p>

            {/* Quick Benefits */}
            <div className="flex flex-wrap gap-4 mb-8 justify-center lg:justify-start">
              {[
                "Setup in 5 minutes",
                "Cancel it anytime",
                "7 days free trial",
              ].map((text, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: colors.foreground }}
                >
                  <CheckCircle2
                    className="h-5 w-5"
                    style={{ color: colors.primary }}
                  />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
              <Button
                variant="hero"
                size="lg"
                className="px-8 py-6 text-lg shadow-glow group w-full sm:w-auto"
                asChild
                style={{
                  background: colors.gradientPrimary,
                  color: colors.primaryForeground,
                  boxShadow: colors.shadowGlow,
                }}
              >
                <a
                  ref={buttonRef}
                  className="group"
                  style={getMagneticStyle(buttonRef.current, 0.25)}
                  href="/auth/signin"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5 cta-arrow" />
                </a>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="px-8 py-6 text-lg glass border-primary/30 hover:bg-primary/5 w-full sm:w-auto"
                asChild
              >
                <a href="/#features">See How It Works</a>
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[0, 1, 2].map((_, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: withAlpha(colors.primary, 0.2),
                        borderColor: colors.background,
                      }}
                    >
                      <User
                        className="h-4 w-4"
                        style={{ color: colors.primary }}
                      />
                    </div>
                  ))}
                </div>
                <span style={{ color: colors.foreground, fontWeight: 600 }}>
                  Many businesses growing
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Sparkles
                      key={i}
                      className="h-4 w-4"
                      style={{ color: colors.primary }}
                    />
                  ))}
                </div>
                <span style={{ color: colors.foreground, fontWeight: 600 }}>
                  4.9/5 rating
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div
            ref={illustrationRef}
            className="hidden lg:block relative animation-fade-in"
            style={getMagneticStyle(illustrationRef.current, 0.1)}
          >
            <div className="relative h-[600px]">
              {/* Card 1 */}
              <div
                className="absolute top-0 right-0 w-80 p-6 rounded-2xl transform rotate-3 hover:rotate-0 transition-all duration-500"
                style={{
                  background: colors.gradientCard,
                  color: colors.cardForeground,
                  border: `1px solid ${colors.border}`,
                  boxShadow: colors.shadowStrong,
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: withAlpha(colors.primary, 0.2) }}
                  >
                    <TrendingUp
                      className="h-6 w-6"
                      style={{ color: colors.primary }}
                    />
                  </div>
                  <div>
                    <div
                      style={{ color: colors.mutedForeground, fontSize: 12 }}
                    >
                      Campaign Performance
                    </div>
                    <div
                      style={{
                        color: colors.foreground,
                        fontSize: 20,
                        fontWeight: 700,
                      }}
                    >
                      +245%
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: withAlpha(colors.primary, 0.2) }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ backgroundColor: colors.primary, width: "80%" }}
                    />
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: withAlpha(colors.primary, 0.2) }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: colors.primaryGlow,
                        width: "60%",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div
                className="absolute top-32 left-0 w-80 p-6 rounded-2xl transform -rotate-2 hover:rotate-0 transition-all duration-500"
                style={{
                  background: colors.card,
                  color: colors.cardForeground,
                  border: `1px solid ${colors.border}`,
                  boxShadow: colors.shadowStrong,
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: withAlpha(colors.primary, 0.2) }}
                  >
                    <Zap
                      className="h-6 w-6"
                      style={{ color: colors.primary }}
                    />
                  </div>
                  <div>
                    <div
                      style={{ color: colors.mutedForeground, fontSize: 12 }}
                    >
                      Active Campaigns
                    </div>
                    <div
                      style={{
                        color: colors.foreground,
                        fontSize: 20,
                        fontWeight: 700,
                      }}
                    >
                      12
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div
                    className="flex-1 h-20 rounded-lg p-3"
                    style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}
                  >
                    <div
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 12,
                        marginBottom: 6,
                      }}
                    >
                      Google
                    </div>
                    <div
                      style={{
                        color: colors.foreground,
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      3.2K
                    </div>
                  </div>
                  <div
                    className="flex-1 h-20 rounded-lg p-3"
                    style={{ backgroundColor: withAlpha(colors.primary, 0.08) }}
                  >
                    <div
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 12,
                        marginBottom: 6,
                      }}
                    >
                      Meta
                    </div>
                    <div
                      style={{
                        color: colors.foreground,
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      5.8K
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div
                className="absolute bottom-0 right-12 w-80 p-6 rounded-2xl transform rotate-1 hover:rotate-0 transition-all duration-500"
                style={{
                  background: colors.card,
                  color: colors.cardForeground,
                  border: `1px solid ${colors.border}`,
                  boxShadow: colors.shadowStrong,
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: withAlpha(colors.primary, 0.2) }}
                  >
                    <Sparkles
                      className="h-6 w-6"
                      style={{ color: colors.primary }}
                    />
                  </div>
                  <div>
                    <div
                      style={{ color: colors.mutedForeground, fontSize: 12 }}
                    >
                      AI Suggestions
                    </div>
                    <div
                      style={{
                        color: colors.foreground,
                        fontSize: 16,
                        fontWeight: 700,
                      }}
                    >
                      New campaign ready
                    </div>
                  </div>
                </div>
                <div style={{ color: colors.mutedForeground, fontSize: 13 }}>
                  "Holiday sale campaign optimized for your audience"
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full glass hover:bg-primary/5 border-primary/30"
                  asChild
                >
                  <a href="/#features">Review Now</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
