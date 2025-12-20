'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

import { cn } from '../../../../../lib/utils';
import colors from '../../../../../lib/colors';

const Breadcrumb = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<'nav'> & {
    separator?: React.ReactNode;
    style?: React.CSSProperties;
  }
>(({ style, ...props }, ref) => (
  <nav
    ref={ref}
    aria-label="breadcrumb"
    {...props}
    style={{ ...(style ?? {}) }}
  />
));
Breadcrumb.displayName = 'Breadcrumb';

const BreadcrumbList = React.forwardRef<
  HTMLOListElement,
  React.ComponentPropsWithoutRef<'ol'>
>(({ className, style, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn('flex flex-wrap items-center gap-1.5 break-words text-sm sm:gap-2.5', className)}
    style={{ color: colors.mutedForeground, ...(style as React.CSSProperties) }}
    {...props}
  />
));
BreadcrumbList.displayName = 'BreadcrumbList';

const BreadcrumbItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<'li'>
>(({ className, style, ...props }, ref) => (
  <li
    ref={ref}
    className={cn('inline-flex items-center gap-1.5', className)}
    style={{ ...(style as React.CSSProperties) }}
    {...props}
  />
));
BreadcrumbItem.displayName = 'BreadcrumbItem';

const BreadcrumbLink = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'> & {
    asChild?: boolean;
    style?: React.CSSProperties;
  }
>(({ asChild, className, style, ...props }, ref) => {
  const Comp: any = asChild ? Slot : 'a';
  const [hover, setHover] = React.useState(false);

  const mergedStyle: React.CSSProperties = {
    color: hover ? colors.foreground : colors.mutedForeground,
    transition: 'color 150ms ease',
    ...(style as React.CSSProperties),
  };

  return (
    <Comp
      ref={ref}
      className={cn('transition-colors', className)}
      style={mergedStyle}
      onMouseEnter={(e) => {
        setHover(true);
        if (props.onMouseEnter) props.onMouseEnter(e);
      }}
      onMouseLeave={(e) => {
        setHover(false);
        if (props.onMouseLeave) props.onMouseLeave(e);
      }}
      {...props}
    />
  );
});
BreadcrumbLink.displayName = 'BreadcrumbLink';

const BreadcrumbPage = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'> & { style?: React.CSSProperties }
>(({ className, style, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn('font-normal', className)}
    style={{ color: colors.foreground, ...(style as React.CSSProperties) }}
    {...props}
  />
));
BreadcrumbPage.displayName = 'BreadcrumbPage';

const BreadcrumbSeparator = ({
  children,
  className,
  style,
  ...props
}: React.ComponentProps<'li'> & { style?: React.CSSProperties }) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn('[&>svg]:size-3.5', className)}
    style={{ color: colors.mutedForeground, ...(style as React.CSSProperties) }}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
);
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

const BreadcrumbEllipsis = ({ className, style, ...props }: React.ComponentProps<'span'> & { style?: React.CSSProperties }) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    style={{ color: colors.mutedForeground, ...(style as React.CSSProperties) }}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
);
BreadcrumbEllipsis.displayName = 'BreadcrumbEllipsis';

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
