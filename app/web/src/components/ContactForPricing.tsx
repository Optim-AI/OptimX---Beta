"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { useScrollAnimation } from "../hooks/use-scroll-animation";
import { Mail, Phone, MessageSquare, ArrowRight } from "lucide-react";
import colors from '@/lib/ui/colors';

export default function ContactForPricing() {
  const { elementRef: sectionRef, isVisible: sectionVisible } =
    useScrollAnimation();

  return (
    <section id="pricing" className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={sectionRef}
          className={`max-w-4xl mx-auto transition-all duration-1000 ${
            sectionVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-10"
          }`}
        >
          <div className="text-center mb-12">
            <h2
              className="text-4xl md:text-5xl font-bold mb-6"
              // heading text color uses foreground token; gradient applied to inner span
              style={{ color: colors.foreground }}
            >
              Pricing that fits{" "}
              <span
                // keep layout classes but replace gradient-text behavior with token gradient
                className="gradient-text"
                style={{
                  backgroundImage: colors.gradientHero,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                your business
              </span>
            </h2>
            <p
              className="text-xl max-w-2xl mx-auto"
              style={{ color: colors.mutedForeground }}
            >
              Every business is unique. Let's create a custom plan that
              perfectly matches your marketing goals and budget.
            </p>
          </div>

          <Card
            className="glass-card border-primary/20 shadow-strong"
            // card-level colors: glass background, subtle primary border, strong shadow (from tokens)
            style={{
              background: colors.glassBg,
              borderColor: "hsl(213 100% 50% / 0.2)",
              boxShadow: colors.shadowStrong,
              color: colors.cardForeground,
            }}
          >
            <CardContent
              className="p-8 md:p-12"
              style={{ color: colors.cardForeground }}
            >
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3
                    className="text-2xl font-bold mb-4"
                    style={{ color: colors.foreground }}
                  >
                    Invest in growth, not subscriptions
                  </h3>
                  <p className="mb-6" style={{ color: colors.mutedForeground }}>
                    Get in touch with us to learn about our pricing plans and
                    find the perfect fit for your business needs.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: "hsl(213 100% 50% / 0.1)",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <MessageSquare
                          className="h-5 w-5"
                          style={{ color: colors.primary }}
                        />
                      </div>
                      <div>
                        <h4
                          className="font-semibold mb-1"
                          style={{ color: colors.foreground }}
                        >
                          Flexible Plans
                        </h4>
                        <p
                          className="text-sm"
                          style={{ color: colors.mutedForeground }}
                        >
                          From starter packages to enterprise solutions
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: "hsl(213 100% 50% / 0.1)",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <Mail
                          className="h-5 w-5"
                          style={{ color: colors.primary }}
                        />
                      </div>
                      <div>
                        <h4
                          className="font-semibold mb-1"
                          style={{ color: colors.foreground }}
                        >
                          7-Day Free Trial
                        </h4>
                        <p
                          className="text-sm"
                          style={{ color: colors.mutedForeground }}
                        >
                          Try any plan risk-free, no credit card required
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: "hsl(213 100% 50% / 0.1)",
                          borderRadius: "0.5rem",
                        }}
                      >
                        <Phone
                          className="h-5 w-5"
                          style={{ color: colors.primary }}
                        />
                      </div>
                      <div>
                        <h4
                          className="font-semibold mb-1"
                          style={{ color: colors.foreground }}
                        >
                          Dedicated Support
                        </h4>
                        <p
                          className="text-sm"
                          style={{ color: colors.mutedForeground }}
                        >
                          Get personalized onboarding and guidance
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  <div
                    className="rounded-2xl p-8 border"
                    style={{
                      background: `linear-gradient(180deg, "hsl(213 100% 50% / 0.05)" 0%, "hsl(213 100% 50% / 0.02)" 100%)`,
                      borderColor: "hsl(213 100% 50% / 0.2)",
                      borderRadius: "1rem",
                    }}
                  >
                    <h4
                      className="text-lg font-semibold mb-4"
                      style={{ color: colors.foreground }}
                    >
                      Ready to get started?
                    </h4>
                    <p
                      style={{ color: colors.mutedForeground }}
                      className="mb-6"
                    >
                      Contact us to learn about our pricing and get started with
                      Oli AI.
                    </p>

                    <div className="space-y-3">
                      {/* Make Button render the Link via asChild (type-safe) */}
                      <Button
                        asChild
                        variant="hero"
                        className="w-full shadow-glow"
                        size="lg"
                        style={{
                          // hero button background / text from tokens; preserve any internal button behavior
                          background: colors.gradientPrimary,
                          color: colors.primaryForeground,
                          boxShadow: colors.shadowGlow,
                        }}
                      >
                        <Link href="/contact" className="flex items-center justify-center w-full">
                          Contact Us for Pricing{" "}
                          <ArrowRight className="ml-2 h-4 w-4 inline-block" />
                        </Link>
                      </Button>

                      {/* already using asChild — remove href prop from the Button itself */}
                      <Button
                        asChild
                        variant="outline"
                        className="w-full"
                        size="lg"
                      >
                        <Link href="/#features" className="w-full text-center">
                          Review Now
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
