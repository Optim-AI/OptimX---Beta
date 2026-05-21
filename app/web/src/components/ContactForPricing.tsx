"use client";

import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { useScrollAnimation } from "../hooks/use-scroll-animation";
import { Mail, Phone, MessageSquare, ArrowRight } from "lucide-react";
import colors from '@/lib/ui/colors';

const CALENDLY_URL = 'https://calendly.com/reachout-optim/new-meeting';

export default function ContactForPricing() {
  const { elementRef: sectionRef, isVisible: sectionVisible } =
    useScrollAnimation();

  return (
    <section id="pricing" className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={sectionRef}
          className={`max-w-4xl mx-auto transition-all duration-700`}
          style={{
            opacity: sectionVisible ? 1 : 0,
            transform: sectionVisible ? 'translateY(0)' : 'translateY(20px)',
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="text-center mb-12">
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
              className="text-xl max-w-5xl mx-auto leading-relaxed"
              style={{ color: colors.mutedForeground }}
            >
              Every business is different. Our pricing is tailored based on your goals, scope, and scale, so you only pay for what actually drives results.
            </p>
          </div>

          <Card
            className="rounded-[20px] overflow-hidden transition-all duration-500 hover:scale-[1.01] hover:shadow-[0_24px_64px_rgba(0,0,0,0.35),0_0_0_1px_hsl(213_100%_55%_/_0.15)]"
            style={{
              background: 'hsl(0 0% 15% / 0.6)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2), 0 0 40px hsl(213 100% 55% / 0.08)',
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
                    {[
                      { Icon: MessageSquare, title: 'Flexible Plans', desc: 'From starter packages to enterprise solutions' },
                      { Icon: Mail, title: '7-Day Free Trial', desc: 'Try any plan risk-free, no credit card required' },
                      { Icon: Phone, title: 'Dedicated Support', desc: 'Get personalized onboarding and guidance' },
                    ].map(({ Icon, title, desc }) => (
                      <div key={title} className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'hsl(213 100% 55% / 0.12)' }}
                        >
                          <Icon className="h-5 w-5" style={{ color: colors.primary }} />
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1" style={{ color: colors.foreground }}>{title}</h4>
                          <p className="text-sm" style={{ color: colors.mutedForeground }}>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  <div
                    className="rounded-[18px] p-8 border transition-all duration-500 hover:border-[hsl(213_100%_55%_/_0.25)]"
                    style={{
                      background: 'linear-gradient(180deg, hsl(213 100% 55% / 0.06) 0%, hsl(213 100% 55% / 0.02) 100%)',
                      borderColor: 'hsl(213 100% 55% / 0.2)',
                    }}
                  >
                    <h4 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>
                      Ready to get started?
                    </h4>
                    <p className="mb-6" style={{ color: colors.mutedForeground }}>
                      Contact us to learn about our pricing and get started with SkalX AI.
                    </p>

                    <Button
                      asChild
                      variant="hero"
                      className="w-full shadow-glow btn-premium"
                      size="lg"
                      style={{
                        background: colors.gradientPrimary,
                        color: colors.primaryForeground,
                        boxShadow: colors.shadowGlow,
                      }}
                    >
                      <a
                        href={CALENDLY_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-full"
                      >
                        Schedule Meeting <ArrowRight className="ml-2 h-4 w-4 inline-block" />
                      </a>
                    </Button>
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
