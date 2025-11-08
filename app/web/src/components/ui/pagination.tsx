"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "../../../../../lib/utils"
import { ButtonProps, buttonVariants } from "./button"
import colors from "../../../../../lib/colors" // <-- color tokens

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
)
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  style,
  ...props
}: PaginationLinkProps & { style?: React.CSSProperties }) => {
  const variant = isActive ? "outline" : "ghost"

  // base inline styles drawn from your tokens
  const baseStyle: React.CSSProperties = isActive
    ? {
        // "outline" appearance: keep background but show border color
        background: colors.background,
        color: colors.foreground,
        borderColor: colors.border,
      }
    : {
        // "ghost" appearance: transparent bg, muted foreground
        background: "transparent",
        color: colors.foreground,
      }

  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({
          variant: variant,
          size,
        }),
        className
      )}
      style={{
        ...baseStyle,
        ...(style || {}),
      }}
      {...props}
    />
  )
}
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = ({
  className,
  style,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { style?: React.CSSProperties }) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn("gap-1 pl-2.5", className)}
    style={{
      // merge any provided style with sensible defaults for the previous button
      background: "transparent",
      color: colors.foreground,
      ...(style || {}),
    }}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
)
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({
  className,
  style,
  ...props
}: React.ComponentProps<typeof PaginationLink> & { style?: React.CSSProperties }) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn("gap-1 pr-2.5", className)}
    style={{
      background: "transparent",
      color: colors.foreground,
      ...(style || {}),
    }}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
)
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & { style?: React.CSSProperties }) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    style={{
      color: colors.mutedForeground,
      ...(style || {}),
    }}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
)
PaginationEllipsis.displayName = "PaginationEllipsis"

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
}
