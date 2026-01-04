// app/web/src/components/ui/table.tsx
"use client"

import * as React from "react"
import { cn } from "../../../../../lib/utils"
import colors from '@/lib/ui/colors'

export const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      style={{
        color: colors.foreground,
        backgroundColor: colors.background,
      }}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b", className)}
    style={{
      borderColor: colors.border,
      backgroundColor: colors.card,
      color: colors.foreground,
    }}
    {...props}
  />
))
TableHeader.displayName = "TableHeader"

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    style={{
      color: colors.foreground,
      backgroundColor: colors.background,
    }}
    {...props}
  />
))
TableBody.displayName = "TableBody"

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t font-medium [&>tr]:last:border-b-0",
      className
    )}
    style={{
      borderColor: colors.border,
      backgroundColor: `${colors.muted}80`, // muted with 50% opacity equivalent
      color: colors.foreground,
    }}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn("border-b transition-colors", className)}
    style={{
      borderColor: colors.border,
      transition: "background-color 0.2s ease",
    }}
    onMouseEnter={(e) =>
      ((e.currentTarget.style.backgroundColor = `${colors.muted}80`))
    }
    onMouseLeave={(e) =>
      ((e.currentTarget.style.backgroundColor = colors.background))
    }
    {...props}
  />
))
TableRow.displayName = "TableRow"

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0",
      className
    )}
    style={{
      color: colors.mutedForeground,
      backgroundColor: colors.card,
    }}
    {...props}
  />
))
TableHead.displayName = "TableHead"

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    style={{
      color: colors.foreground,
      borderColor: colors.border,
    }}
    {...props}
  />
))
TableCell.displayName = "TableCell"

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm", className)}
    style={{
      color: colors.mutedForeground,
    }}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"
