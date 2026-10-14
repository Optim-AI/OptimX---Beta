"use client";

import { useEffect, useState } from "react";
import { supabase } from '@/auth/supabase/client';
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { SkeletonInline } from "./ui/skeletons";
import { authFetch } from "@/lib/utils";
import { parseCreditsBalancePayload } from "@/lib/billing/credit-balance-client";

export default function NavBar() {
  const [username, setUsername] = useState("Loading...");
  const [imageCredits, setImageCredits] = useState(0);
  const [videoCredits, setVideoCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const fetchCredits = async () => {
      try {
        const res = await authFetch("/api/credits/balance");
        const data = await res.json();
        const parsed = parseCreditsBalancePayload(data);
        if (!cancelled && parsed) {
          setImageCredits(parsed.imageTotal);
          setVideoCredits(parsed.videoTotal);
        }
      } catch (e) {
        console.warn("fetchCredits failed", e);
      }
    };

    const init = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.warn("auth.getUser error", userError);
        }

        const user = userData?.user;

        if (!user) {
          if (!cancelled) {
            setUsername("Guest");
            setImageCredits(0);
            setVideoCredits(0);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setUsername(user.user_metadata?.full_name || user.email || "User");
        }

        await fetchCredits();

        intervalId = setInterval(() => {
          void fetchCredits();
        }, 5000);

        const handleFocus = () => {
          void fetchCredits();
        };
        window.addEventListener("focus", handleFocus);

        if (!cancelled) {
          setLoading(false);
        }

        return () => {
          cancelled = true;
          if (intervalId) clearInterval(intervalId);
          window.removeEventListener("focus", handleFocus);
        };
      } catch (e: any) {
        console.error("NavBar init error", e);
        if (!cancelled) {
          toast.error("Failed to load user info");
          setLoading(false);
        }
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <nav className="w-full flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
      <h1 className="text-lg font-semibold text-gray-800">
        Hi!{" "}
        <span className="text-blue-600 font-bold">
          {loading ? <SkeletonInline width="100px" /> : username}
        </span>
      </h1>

      <div className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full">
        <Coins className="h-4 w-4" />
        <span className="font-semibold">
          {loading ? (
            <SkeletonInline width="80px" />
          ) : (
            `${imageCredits} images · ${videoCredits} video`
          )}
        </span>
      </div>
    </nav>
  );
}
