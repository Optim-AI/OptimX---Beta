// components/OAuthResultPage.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type OAuthStatus = "success" | "error" | "cancelled" | "no_pages";

interface OAuthResultPageProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  autoCloseSeconds?: number;
  redirectUrl?: string;
  showTimer?: boolean;
  status?: OAuthStatus; // Type of OAuth result (success, error, cancelled, no_pages)
}

/**
 * Shared component for OAuth result pages (success, error, cancelled)
 * Features:
 * - Auto-close popup window after countdown
 * - Fallback redirect for non-popup contexts
 * - PostMessage to parent window
 */
export default function OAuthResultPage({
  title,
  icon,
  children,
  autoCloseSeconds = 15,
  redirectUrl = "/integrations",
  showTimer = true,
  status = "error", // Default to error for safety
}: OAuthResultPageProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(autoCloseSeconds);
  const [isPopup, setIsPopup] = useState(false);

  useEffect(() => {
    // Check if this window was opened as a popup
    const isWindowPopup = window.opener && !window.opener.closed;
    setIsPopup(!!isWindowPopup);

    // Start countdown timer
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleAutoClose = () => {
    // Try to send message to parent window
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: "oauth_completed",
            platform: "meta",
            status: status, // Include status (success, error, cancelled, no_pages)
            redirect: redirectUrl,
          },
          "*"
        );
      }
    } catch (e) {
      console.warn("Failed to postMessage to opener:", e);
    }

    // Try to close the popup
    try {
      window.close();
    } catch (e) {
      // If close fails, redirect instead
      console.warn("Failed to close window, redirecting instead:", e);
    }

    // Fallback redirect (in case window.close() fails)
    setTimeout(() => {
      router.push(redirectUrl);
    }, 500);
  };

  const handleManualClose = () => {
    handleAutoClose();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* Icon */}
        {icon && (
          <div className="flex justify-center mb-6">
            {icon}
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-900">
          {title}
        </h1>

        {/* Content */}
        <div className="text-gray-700 mb-6">{children}</div>

        {/* Timer */}
        {showTimer && countdown > 0 && (
          <div className="text-center text-sm text-gray-500 mb-4">
            {isPopup ? "This window will close" : "Redirecting"} in{" "}
            <span className="font-semibold text-blue-600">{countdown}</span>{" "}
            second{countdown !== 1 ? "s" : ""}...
          </div>
        )}

        {/* Manual close button */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleManualClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isPopup ? "Close Window" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
