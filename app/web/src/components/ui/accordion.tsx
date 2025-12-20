'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import colors from '../../../../../lib/colors';

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => {
  // apply inline border color instead of relying on global CSS var
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(className ?? '')}
      style={{ borderBottom: `1px solid ${colors.border}` }}
      {...props}
    />
  );
});
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const [hover, setHover] = React.useState(false);
  const [focus, setFocus] = React.useState(false);

  // base inline styles for trigger (text color + removal of any bg)
  const baseStyle: React.CSSProperties = {
    color: colors.foreground,
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  };

  // hover: underline effect (we keep underline on hover)
  const hoverStyle: React.CSSProperties = hover
    ? { textDecoration: 'underline' }
    : {};

  // focus: simple ring outline (inline)
  const focusStyle: React.CSSProperties = focus
    ? {
        outline: `2px solid ${colors.ring}`,
        outlineOffset: '2px',
        borderRadius: '6px',
      }
    : {};

  const merged = { ...baseStyle, ...hoverStyle, ...focusStyle };

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'flex flex-1 items-center justify-between py-4 font-medium transition-all [&[data-state=open]>svg]:rotate-180',
          className
        )}
        style={merged}
        onMouseEnter={(e) => {
          setHover(true);
          if (props.onMouseEnter) props.onMouseEnter(e);
        }}
        onMouseLeave={(e) => {
          setHover(false);
          if (props.onMouseLeave) props.onMouseLeave(e);
        }}
        onFocus={(e) => {
          setFocus(true);
          if (props.onFocus) props.onFocus(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          if (props.onBlur) props.onBlur(e);
        }}
        {...props}
      >
        {children}
        {/* lucide icons inherit currentColor, so they match text color */}
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform duration-200"
          aria-hidden
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
});
AccordionTrigger.displayName = 'AccordionTrigger';

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
      className
    )}
    // apply inline text color and (optionally) a slightly muted color for content
    style={{ color: colors.mutedForeground }}
    {...props}
  >
    <div className={cn('pb-4 pt-0')} style={{ color: colors.mutedForeground }}>
      {children}
    </div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
