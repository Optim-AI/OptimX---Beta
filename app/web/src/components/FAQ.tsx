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
  const { elementRef: accordionRef, isVisible: accordionVisible } = useScrollAnimation({
    threshold: 0.1,
  });

  const faqs: FAQItem[] = [
    {
      question: 'Do I need a marketing background?',
      answer:
        'No. SkalX helps you create on-brand posters, ad creatives, and videos from your brand context — without needing a design or media team.',
    },
    {
      question: 'What can SkalX create?',
      answer:
        'SkalX can generate AI posters, ad creatives, and short marketing videos, and help you plan campaign concepts and creative direction inside Brand Studio and Ad Studio.',
    },
    {
      question: 'Which platforms can I use my creatives on?',
      answer:
        'Export campaign-ready assets and use them across the channels you already advertise on. Meta and other integrations continue to expand inside the product.',
    },
    {
      question: 'How does SkalX understand my brand?',
      answer:
        'You share your website or a product image. SkalX analyzes brand signals like offering, audience cues, colors, and visual style to personalize creatives.',
    },
    {
      question: 'Is there a free trial?',
      answer:
        'You can try SkalX through the Try Now experience. Plans and pay-as-you-go credits are available inside the product when you are ready to keep creating.',
    },
    {
      question: 'What if I want to cancel?',
      answer:
        'You can cancel anytime from billing settings. Your account data stays available if you return later.',
    },
    {
      question: 'Is my data secure?',
      answer:
        'Yes. Account and brand data are protected with encrypted connections and access controls. We do not sell your data.',
    },
    {
      question: 'How is SkalX different from Canva or ad managers alone?',
      answer:
        'Canva and ad platforms are single tools. SkalX connects brand understanding with creative generation and campaign planning so you can move from brand to creative faster.',
    },
    {
      question: 'Where do I see pricing?',
      answer:
        'Pricing is shown inside the Try Now journey after SkalX understands your brand — so you choose a plan after seeing personalized value, not before.',
    },
  ];

  return (
    <section id="faq" className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={titleRef}
          className="text-center max-w-4xl mx-auto mb-16 transition-all duration-700"
          style={{
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(20px)',
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <h2 className="text-4xl md:text-[46px] font-normal mb-6" style={{ color: colors.foreground }}>
            Frequently Asked Questions
          </h2>
          <p className="text-xl font-extralight" style={{ color: colors.mutedForeground }}>
            Got questions? If you need more help, reach out at info@skalxai.app.
          </p>
        </div>

        <div
          ref={accordionRef}
          className="max-w-4xl mx-auto"
          style={{
            opacity: accordionVisible ? 1 : 0,
            transform: accordionVisible ? 'translateY(0)' : 'translateY(20px)',
            transition:
              'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
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
                  className="text-left py-6 text-lg font-normal hover:no-underline [&[data-state=open]>svg]:rotate-180"
                  style={{ color: colors.foreground }}
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
