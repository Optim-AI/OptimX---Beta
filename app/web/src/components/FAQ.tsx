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
        "Nope. OptimX handles copy, design, targeting, SEO, and insights for you. Our AI is trained on best practices from thousands of successful campaigns, so you get expert-level marketing without the expertise."
    },
    {
      question: 'Which platforms are supported?',
      answer:
        'Google, Meta (Facebook), Instagram, WhatsApp, LinkedIn, and more coming soon. We integrate with all major advertising platforms and social media channels to give you maximum reach.'
    },
    {
      question: 'Can I track organic results too?',
      answer:
        'Yes, SEO and content performance are fully integrated. Track your website rankings, organic traffic, content engagement, and see how your paid and organic efforts work together.'
    },
    {
      question: 'Can I hire freelancers or influencers?',
      answer:
        "Yes, directly through OptimX's marketplace. Find vetted designers, copywriters, videographers, and local influencers who understand your industry and can help scale your campaigns."
    },
    {
      question: 'How does AI targeting work?',
      answer:
        'Our AI analyzes your business, competitors, and successful campaigns in your industry to identify the most promising audiences. It continuously optimizes based on performance data to improve results over time.'
    },
    {
      question: 'What if I want to cancel?',
      answer:
        "You can cancel anytime with no penalties. We believe in earning your business every month. If you cancel, you'll keep access to your account data and can restart whenever you want."
    },
    {
      question: 'How much should I budget for ads?',
      answer:
        "Start with whatever you're comfortable with. OptimX works with budgets as low as $10/day. Our AI helps optimize your spend to get the best results, regardless of budget size."
    },
    {
      question: 'Is my data secure?',
      answer:
        "Absolutely. We use enterprise-grade security, encrypt all data in transit and at rest, and never share your information with third parties. We're SOC 2 compliant and follow industry best practices."
    }
  ];

  return (
    <section
      className="py-20"
      style={{
        // replace bg-muted/30
        backgroundColor: `${colors.muted} / 0.3`,
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
            Got questions? We've got answers. If you can't find what you're looking for, reach out to our team.
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
                  borderColor: `${colors.border} / 0.5`,
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
