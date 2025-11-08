'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '../../../../../lib/utils';
import { buttonVariants } from './button';
import colors from '../../../../../lib/colors';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  // base text & border colors for the calendar
  const baseText = { color: colors.foreground };
  const mutedText = { color: colors.mutedForeground };
  const accentBg = { background: colors.accent, color: colors.accentForeground };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      styles={{
        // Entire calendar
        root: { background: colors.background, color: colors.foreground },
        caption_label: { color: colors.foreground },
        head_cell: { color: colors.mutedForeground },
        cell: { borderRadius: '6px' },
        day: {
          borderRadius: '6px',
          color: colors.foreground,
          transition: 'all 0.2s ease',
        },
        day_selected: {
          background: colors.primary,
          color: colors.primaryForeground,
          boxShadow: colors.shadowSoft,
        },
        day_today: {
          background: colors.accent,
          color: colors.accentForeground,
          fontWeight: 600,
        },
        day_outside: {
          color: colors.mutedForeground,
          opacity: 0.5,
        },
        day_disabled: {
          color: colors.mutedForeground,
          opacity: 0.4,
          cursor: 'not-allowed',
        },
        day_range_middle: {
          background: colors.accent,
          color: colors.accentForeground,
        },
        nav_button: {
          background: 'transparent',
          border: `1px solid ${colors.border}`,
          color: colors.foreground,
          borderRadius: '6px',
          opacity: 0.7,
          transition: 'opacity 0.2s ease',
        },
        month: {
          background: colors.background,
          borderRadius: '8px',
          boxShadow: colors.shadowSoft,
          padding: '0.5rem',
        },
        months: { gap: '1rem' },
      }}
      classNames={{
        months:
          'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center',
        nav_button: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0'
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell:
          'rounded-md w-9 font-normal text-[0.8rem] text-center select-none',
        row: 'flex w-full mt-2',
        cell:
          'h-9 w-9 text-center text-sm p-0 relative cursor-pointer focus-within:z-20 focus:outline-none',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100'
        ),
        day_range_end: 'day-range-end',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: () => (
          <ChevronLeft
            className="h-4 w-4"
            style={{ color: colors.foreground }}
          />
        ),
        IconRight: () => (
          <ChevronRight
            className="h-4 w-4"
            style={{ color: colors.foreground }}
          />
        ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = 'Calendar';
