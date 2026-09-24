"use client";

import Link from "next/link";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { useScrollAnimation } from "../hooks/use-scroll-animation";
import { Check, ArrowRight } from "lucide-react";
import colors from "@/lib/ui/colors";
import {
  MARKETING_SUBSCRIPTION_PLANS,
  formatPricePlusGst,
  subscriptionTotalsInr,
  formatInr,
} from "@/lib/billing/marketing-plans";

export default function ContactForPricing() {
  const { elementRef: sectionRef, isVisible: sectionVisible } =
    useScrollAnimation();

  return (
    <section id="pricing" className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={sectionRef}
          className="max-w-6xl mx-auto transition-all duration-700"
          style={{
            opacity: sectionVisible ? 1 : 0,
            transform: sectionVisible ? "translateY(0)" : "translateY(20px)",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div className="text-center mb-14">
            <h2
              className="text-4xl md:text-5xl font-bold mb-6"
              style={{ color: colors.foreground }}
            >
              Pricing that fits{" "}
              <span
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
              className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
              style={{ color: colors.mutedForeground }}
            >
              Monthly plans with Image Credits and Video Credits. Top up anytime
              with pay-as-you-go when you need more.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 items-stretch">
            {MARKETING_SUBSCRIPTION_PLANS.map((plan) => {
              return (
                <Card
                  key={plan.id}
                  className="rounded-[20px] overflow-hidden transition-all duration-500 hover:scale-[1.02] h-full"
                  style={{
                    background: "hsl(0 0% 15% / 0.6)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                  }}
                >
                  <CardContent
                    className="p-8 flex flex-col h-full"
                    style={{ color: colors.cardForeground }}
                  >
                    <h3
                      className="text-2xl font-bold mb-2"
                      style={{ color: colors.foreground }}
                    >
                      {plan.name}
                    </h3>

                    <div className="mb-6">
                      <div>
                        <span
                          className="text-4xl font-bold tracking-tight"
                          style={{ color: colors.foreground }}
                        >
                          {formatPricePlusGst(plan.priceInr)}
                        </span>
                        <span
                          className="text-base ml-1"
                          style={{ color: colors.mutedForeground }}
                        >
                          / month
                        </span>
                      </div>
                      <p
                        className="text-sm mt-1.5"
                        style={{ color: colors.mutedForeground }}
                      >
                        {formatInr(subscriptionTotalsInr(plan.priceInr).totalInr)}{" "}
                        incl. 18% GST
                      </p>
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-3">
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: "hsl(213 100% 55% / 0.12)" }}
                        >
                          <Check
                            className="h-4 w-4"
                            style={{ color: colors.primary }}
                          />
                        </span>
                        <span style={{ color: colors.foreground }}>
                          <strong>
                            {plan.imageCredits.toLocaleString("en-IN")}
                          </strong>{" "}
                          Image Credits
                        </span>
                      </li>
                      <li className="flex items-center gap-3">
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: "hsl(213 100% 55% / 0.12)" }}
                        >
                          <Check
                            className="h-4 w-4"
                            style={{ color: colors.primary }}
                          />
                        </span>
                        <span style={{ color: colors.foreground }}>
                          <strong>
                            {plan.videoCredits.toLocaleString("en-IN")}
                          </strong>{" "}
                          Video Credits
                        </span>
                      </li>
                    </ul>

                    <Button
                      asChild
                      variant="hero"
                      className="w-full shadow-glow btn-premium"
                      size="lg"
                      style={{
                        background: colors.gradientPrimary,
                        color: colors.primaryForeground,
                        boxShadow: colors.shadowGlow,
                        border: "none",
                      }}
                    >
                      <Link
                        href={`/subscribe?plan=${plan.id}`}
                        className="flex items-center justify-center w-full"
                      >
                        Get Started
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p
            className="text-center text-sm mt-10"
            style={{ color: colors.mutedForeground }}
          >
            Prices exclude GST (18% applied at checkout). Billed monthly via
            Razorpay. Cancel anytime before your next renewal. Need more
            capacity? Add credits with pay-as-you-go.
          </p>
        </div>
      </div>
    </section>
  );
}
