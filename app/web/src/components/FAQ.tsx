'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';

type FAQItem = { question: string; answer: string };

const FAQ: React.FC = () => {
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: accordionRef, isVisible: accordionVisible } = useScrollAnimation({ threshold: 0.1 });

  const faqs: FAQItem[] = [
    { question: 'Do I need a marketing background?', answer: "No. Oli AI handles copy, design, targeting, SEO, and insights for you. You get expert-level marketing without needing experience." },
    { question: 'Which platforms are supported?', answer: 'Google, Meta (Facebook), Instagram, WhatsApp Business, LinkedIn. We integrate with all major advertising and social platforms.' },
    { question: 'Can I track organic results too?', answer: 'Yes. You can track website rankings, organic traffic, engagement, and see how your paid and organic results work together.' },
    { question: 'Can I hire freelancers or influencers?', answer: 'Yes. Oli AI has a built-in marketplace to hire vetted designers, writers, videographers, and local influencers.' },
    { question: 'How does AI targeting work?', answer: 'Oli AI analyzes your business, competitors, and past winning campaigns in your industry to target the right audience — and improves automatically.' },
    { question: 'What if I want to cancel?', answer: "Cancel anytime. Your data stays safe, and you can restart whenever you want." },
    { question: 'How much should I budget for ads?', answer: 'Start with whatever you\'re comfortable with. Oli AI works even with budgets as low as ₹100/day.' },
    { question: 'Is my data secure?', answer: 'Yes. All data is encrypted and never shared with third parties.' },
    { question: 'Do I need marketing experience to use Oli AI?', answer: 'No. Oli AI writes ads, builds audiences, launches campaigns, and generates reports for you.' },
    { question: 'What makes Oli AI different from Meta Ads / Google Ads / Canva / Buffer?', answer: 'Those are single tools. Oli AI is the full growth system — ads, content, posting, SEO, analytics, brand voice, and influencers in one place.' },
    { question: "I've tried ads before and lost money. What makes this different?", answer: 'Oli AI helps you avoid waste. It alerts you when a campaign underperforms and suggests fixes so your money goes where it works.' },
  ];

  return (
    <section id="faq" className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={titleRef}
          className={`text-center max-w-4xl mx-auto mb-16 transition-all duration-700`}
          style={{
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(20px)',
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: colors.foreground }}>
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
          <p className="text-xl" style={{ color: colors.mutedForeground }}>
            Got questions? We&apos;ve got answers. If you can&apos;t find what you&apos;re looking for, reach out at info@optimx.app.
          </p>
        </div>

        <div
          ref={accordionRef}
          className="max-w-4xl mx-auto"
          style={{
            opacity: accordionVisible ? 1 : 0,
            transform: accordionVisible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            transitionDelay: '0.1s',
          }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-[18px] px-6 overflow-hidden border-none transition-all duration-500 data-[state=open]:bg-[hsl(0_0%_18%_/_0.6)] data-[state=open]:border-[rgba(255,255,255,0.1)] data-[state=open]:shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
                style={{
                  background: 'hsl(0 0% 15% / 0.4)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderBottom: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                <AccordionTrigger
                  className="text-left py-6 text-lg font-semibold hover:no-underline [&[data-state=open]>svg]:rotate-180"
                  style={{ color: colors.foreground }}
                >
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6 leading-relaxed" style={{ color: colors.mutedForeground }}>
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
