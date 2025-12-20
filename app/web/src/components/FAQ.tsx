'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from "../../../../lib/colors";

type FAQItem = {
  question: string;
  answer: string;
};

const FAQ: React.FC = () => {
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: accordionRef, isVisible: accordionVisible } = useScrollAnimation({ threshold: 0.1 });

  const faqs: FAQItem[] = [
  {
    question: 'Do I need a marketing background?',
    answer:
      "No. OptimX handles copy, design, targeting, SEO, and insights for you. You get expert-level marketing without needing experience."
  },
  {
    question: 'Which platforms are supported?',
    answer:
      'Google, Meta (Facebook), Instagram, WhatsApp Business, LinkedIn. We integrate with all major advertising and social platforms.'
  },
  {
    question: 'Can I track organic results too?',
    answer:
      'Yes. You can track website rankings, organic traffic, engagement, and see how your paid and organic results work together.'
  },
  {
    question: 'Can I hire freelancers or influencers?',
    answer:
      'Yes. OptimX has a built-in marketplace to hire vetted designers, writers, videographers, and local influencers.'
  },
  {
    question: 'How does AI targeting work?',
    answer:
      'OptimX analyzes your business, competitors, and past winning campaigns in your industry to target the right audience — and improves automatically.'
  },
  {
    question: 'What if I want to cancel?',
    answer:
      "Cancel anytime. Your data stays safe, and you can restart whenever you want."
  },
  {
    question: 'How much should I budget for ads?',
    answer:
      'Start with whatever you’re comfortable with. OptimX works even with budgets as low as ₹100/day.'
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. All data is encrypted and never shared with third parties.'
  },
  {
    question: 'Do I need marketing experience to use OptimX?',
    answer:
      'No. OptimX writes ads, builds audiences, launches campaigns, and generates reports for you.'
  },
  {
    question: 'What makes OptimX different from Meta Ads / Google Ads / Canva / Buffer?',
    answer:
      'Those are single tools. OptimX is the full growth system — ads, content, posting, SEO, analytics, brand voice, and influencers in one place.'
  },
  {
    question: 'I’ve tried ads before and lost money. What makes this different?',
    answer:
      'OptimX helps you avoid waste. It alerts you when a campaign underperforms and suggests fixes so your money goes where it works.'
  }
];

  return (
    <section
      className="py-20"
      style={{
        // replace bg-muted/30
        backgroundColor: "hsl(220 13% 95% / 0.3)",
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={titleRef}
          className={`text-center max-w-4xl mx-auto mb-16 transition-all duration-1000 ${
            titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <h2
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{ color: colors.foreground }}
          >
            Frequently Asked{' '}
            <span
              className="gradient-text"
              style={{
                backgroundImage: colors.gradientHero,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Questions
            </span>
          </h2>
          <p
            className="text-xl"
            style={{ color: colors.mutedForeground }}
          >
            Got questions? We've got answers. If you can't find what you're looking for, reach out to our team at info@optimx.appp.
          </p>
        </div>

        <div
          ref={accordionRef}
          className="max-w-4xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className={`rounded-xl px-6 transition-all duration-700 ${accordionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{
                  // replace card-gradient, shadow-elegant, border-border/50
                  background: colors.gradientCard,
                  borderColor: "hsl(220 13% 91% / 0.5)",
                  boxShadow: colors.shadowMedium,
                }}
                // keep the staggered animation delay (not a color change)
                data-delay={`${index * 80}`}
              >
                <AccordionTrigger
                  className="text-left py-6 text-lg font-semibold transition-colors"
                  // set default text color and implement a simple hover color change without touching animation classes
                  style={{ color: colors.foreground }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = colors.foreground;
                  }}
                >
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent
                  className="pb-6 leading-relaxed"
                  style={{ color: colors.mutedForeground }}
                >
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
