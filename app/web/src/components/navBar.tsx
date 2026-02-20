"use client";

import { useEffect, useState } from "react";
import { supabase } from '@/auth/supabase/client';
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { SkeletonInline } from "./ui/skeletons";

export default function NavBar() {
  const [username, setUsername] = useState("Loading...");
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: any;
    let intervalId: any;
    let currentUserId: string | null = null;
    let cancelled = false;

    const fetchCredits = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("user_credits")
          .select("credits")
          .eq("id", userId)
          .single();

        if (error) {
          console.warn("fetchCredits error", error);
          return;
        }

        if (!cancelled && typeof data?.credits === "number") {
          setCredits(data.credits);
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
            setCredits(0);
            setLoading(false);
          }
          return;
        }

        currentUserId = user.id;

        if (!cancelled) {
          setUsername(user.user_metadata?.full_name || user.email || "User");
        }

        // Initial credits fetch
        await fetchCredits(user.id);

        // Realtime credit update listener
        channel = supabase
          .channel("credits_updates")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "user_credits",
              filter: `id=eq.${user.id}`,
            },
            (payload: any) => {
              const newCredits = payload.new?.credits;
              if (!cancelled && typeof newCredits === "number") {
                setCredits(newCredits);
              }
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              // Realtime is ready
            }
          });

        // Polling fallback: in case realtime is not firing for any reason
        intervalId = setInterval(() => {
          if (currentUserId) {
            fetchCredits(currentUserId);
          }
        }, 5000); // every 5 seconds

        // Refetch when window gets focus (tab switch back)
        const handleFocus = () => {
          if (currentUserId) {
            fetchCredits(currentUserId);
          }
        };
        window.addEventListener("focus", handleFocus);

        if (!cancelled) {
          setLoading(false);
        }

        // Cleanup
        return () => {
          cancelled = true;
          if (channel) supabase.removeChannel(channel);
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

    // run
    const cleanupPromise = init();

    // outer cleanup
    return () => {
      (async () => {
        cancelled = true;
        if (channel) supabase.removeChannel(channel);
        if (intervalId) clearInterval(intervalId);
      })();
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
          {loading ? <SkeletonInline width="80px" /> : `${credits} Credits`}
        </span>
      </div>
    </nav>
  );
}
