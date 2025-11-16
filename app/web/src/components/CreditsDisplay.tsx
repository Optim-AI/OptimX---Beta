import { Zap } from "lucide-react";
import { useCredits } from "../hooks/use-credits";
import { cn } from "../../../../lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface CreditsDisplayProps {
  variant?: "badge" | "sidebar";
  className?: string;
}

export function CreditsDisplay({ variant = "badge", className }: CreditsDisplayProps) {
  const { credits, maxCredits } = useCredits();
  const isLow = credits <= 2;
  const isEmpty = credits === 0;

  if (variant === "sidebar") {
    return (
      <div className={cn("px-4 py-3 border-t border-border", className)}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-between gap-2 cursor-pointer hover:bg-sidebar-accent rounded-lg p-2 transition-colors">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    isEmpty ? "bg-destructive/20" : isLow ? "bg-amber-500/20" : "bg-primary/20"
                  )}>
                    <Zap className={cn(
                      "w-4 h-4",
                      isEmpty ? "text-destructive" : isLow ? "text-amber-500" : "text-primary"
                    )} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Credits</span>
                    <span className={cn(
                      "text-sm font-semibold",
                      isEmpty ? "text-destructive" : isLow ? "text-amber-500" : "text-foreground"
                    )}>
                      {credits} / {maxCredits}
                    </span>
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="text-sm">
                {isEmpty
                  ? "No credits remaining. Upgrade to continue."
                  : isLow
                  ? `Only ${credits} credits left — upgrade for unlimited campaigns.`
                  : "Each campaign creation uses 1 credit."}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full glass-effect border transition-all duration-300",
              isEmpty
                ? "border-destructive/50 bg-destructive/10"
                : isLow
                ? "border-amber-500/50 bg-amber-500/10"
                : "border-primary/30 bg-primary/5",
              className
            )}
          >
            <Zap
              className={cn(
                "w-4 h-4 transition-colors",
                isEmpty ? "text-destructive" : isLow ? "text-amber-500" : "text-primary"
              )}
            />
            <span
              className={cn(
                "text-sm font-medium transition-colors",
                isEmpty ? "text-destructive" : isLow ? "text-amber-500" : "text-foreground"
              )}
            >
              Credits: {credits} / {maxCredits}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm max-w-xs">
            {isEmpty
              ? "You've run out of campaign credits. Please upgrade your plan to continue."
              : isLow
              ? `You have ${credits} credits remaining — upgrade for unlimited campaigns.`
              : "Each campaign creation uses 1 credit. Upgrade to get more."}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
