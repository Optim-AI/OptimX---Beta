"use client";

import React from "react";
import { Button } from "./ui/button";
import { Check, Sparkles, Crown, Rocket } from "lucide-react";
import { useScrollAnimation } from "../hooks/use-scroll-animation";
import colors from "../../../../lib/colors";

const Pricing: React.FC = () => {
  const { elementRef: titleRef, isVisible: titleVisible } =
    useScrollAnimation();
  const { elementRef: cardsRef, isVisible: cardsVisible } = useScrollAnimation({
    threshold: 0.1,
  });

  const plans = [
    {
      name: "Starter",
      description: "For SMBs just starting with digital campaigns",
      price: "₹3,000",
      period: "month",
      icon: Sparkles,
      popular: false,
      features: [
        "Unlimited campaigns (social + ads)",
        "All platform posting integrations",
        "Standard analytics dashboard",
        "Content calendar (basic scheduling)",
        "Email/chat support",
      ],
      recommended:
        "Solopreneurs, small shops, 1-location businesses who just want to 'get online fast.'",
    },
    {
      name: "Growth",
      description: "For growing SMBs who want visibility + brand consistency",
      price: "₹6,000",
      period: "month",
      icon: Rocket,
      popular: true,
      features: [
        "Everything in Starter",
        "SEO suite (on-page + keyword tracking)",
        "Brand guide creation (AI-powered templates + assets)",
        "Social listening (mentions, reviews, trends)",
        "Priority support (faster response time)",
      ],
      recommended:
        "2–3 location businesses, retail owners, small chains, service providers.",
    },
    {
      name: "Pro",
      description: "For ambitious SMBs ready to scale with AI",
      price: "₹12,000",
      period: "month",
      icon: Crown,
      popular: false,
      features: [
        "Everything in Growth",
        "Custom AI training (brand-trained AI for campaigns & content)",
        "Multi-location support (branch-wise marketing)",
        "Advanced analytics (revenue attribution, ROI insights)",
        "Concierge-level support (dedicated account manager)",
      ],
      recommended:
        "Franchises, high-spend SMBs, agencies using OptimX for clients.",
    },
  ];

  return (
    <section
      id="pricing"
      className="py-20"
      style={{
        // top-level section styling (keeps animations untouched)
        backgroundColor: colors.background,
        color: colors.foreground,
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div
          ref={titleRef}
          className={`text-center max-w-4xl mx-auto mb-16 transition-all duration-1000 ${
            titleVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-10"
          }`}
        >
          <h2
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{ color: colors.foreground }}
          >
            Simple pricing that{" "}
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
              scales with you
            </span>
          </h2>
          <p className="text-xl" style={{ color: colors.mutedForeground }}>
            Choose the plan that fits your business size and marketing goals.
            Upgrade or downgrade anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div
          ref={cardsRef}
          className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            const isPopular = plan.popular;

            const cardCommonStyle: React.CSSProperties = {
              transitionDelay: cardsVisible ? `${index * 150}ms` : "0ms",
              background: isPopular ? colors.gradientCard : colors.card,
              color: colors.cardForeground,
              borderColor: isPopular ? colors.primary : colors.border,
              boxShadow: isPopular ? colors.shadowStrong : colors.shadowSoft,
            };

            return (
              <div
                key={index}
                className={`relative p-8 rounded-2xl border transition-all duration-700 ${
                  isPopular ? "scale-105" : "hover:shadow-hover"
                } ${
                  cardsVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-10"
                }`}
                style={cardCommonStyle}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span
                      style={{
                        backgroundColor: colors.primary,
                        color: colors.primaryForeground,
                        padding: "0.5rem 1rem",
                        borderRadius: 9999,
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-8">
                  <div
                    className="flex items-center justify-center w-12 h-12 rounded-lg mx-auto mb-4"
                    style={{
                      backgroundColor: "hsl(213 100% 50% / 0.1)",
                    }}
                  >
                    <Icon
                      className="h-6 w-6"
                      style={{ color: colors.primary }}
                    />
                  </div>

                  <h3
                    className="text-2xl font-bold mb-2"
                    style={{ color: colors.foreground }}
                  >
                    {plan.name}
                  </h3>
                  <p className="mb-6" style={{ color: colors.mutedForeground }}>
                    {plan.description}
                  </p>

                  <div className="mb-6">
                    <span
                      className="text-4xl font-bold"
                      style={{ color: colors.foreground }}
                    >
                      {plan.price}
                    </span>
                    {plan.period !== "limited time trial" ? (
                      <span style={{ color: colors.mutedForeground }}>
                        /{plan.period}
                      </span>
                    ) : (
                      <div
                        style={{ color: colors.mutedForeground }}
                        className="text-sm mt-1"
                      >
                        {plan.period}
                      </div>
                    )}
                  </div>

                  <div className="mb-6 space-y-3">
                    {/* Gradient / Hero button */}
                    <Button
                      variant="hero"
                      size="lg"
                      className="w-full px-8 py-6 text-lg shadow-glow"
                      style={{
                        background: colors.gradientPrimary,
                        color: colors.primaryForeground,
                        boxShadow: colors.shadowGlow,
                      }}
                    >
                      Start Free Trial
                    </Button>

                    {/* Outline button */}
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full px-8 py-6 text-lg glass border-primary/30 hover:bg-primary/5"
                      style={{
                        background: "transparent",
                        color: colors.primary,
                        border: `1px solid ${withAlpha(colors.primary, 0.2)}`,
                      }}
                    >
                      Get Started nowwww its noww
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <div
                      key={featureIndex}
                      className="flex items-center space-x-3"
                    >
                      <Check
                        className="h-5 w-5 flex-shrink-0"
                        style={{ color: colors.primary }}
                      />
                      <span style={{ color: colors.foreground }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  className="pt-4"
                  style={{ borderTop: `1px solid ${colors.border}` }}
                >
                  <p
                    className="text-sm font-medium"
                    style={{ color: colors.mutedForeground }}
                  >
                    Recommended for:
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: colors.foreground, marginTop: 6 }}
                  >
                    {plan.recommended}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer section */}
        <div className="text-center mt-12">
          <p className="mb-4" style={{ color: colors.mutedForeground }}>
            All plans include a 14-day free trial. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="link" className="text-primary" asChild>
              <a href="/contact" style={{ color: colors.primary }}>
                Need a custom plan? Contact us →
              </a>
            </Button>
            <Button variant="link" className="text-primary" asChild>
              <a href="/contact" style={{ color: colors.primary }}>
                Looking for custom pricing? Get in touch →
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
