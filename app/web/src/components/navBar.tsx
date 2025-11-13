"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { Coins } from "lucide-react";
import { toast } from "sonner";

export default function NavBar() {
  const [username, setUsername] = useState("Loading...");
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: any;

    const fetchData = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        setUsername("Guest");
        setCredits(0);
        setLoading(false);
        return;
      }

      setUsername(user.user_metadata?.full_name || user.email || "User");

      const { data } = await supabase
        .from("user_credits")
        .select("credits")
        .eq("id", user.id)
        .single();

      if (data?.credits !== undefined) setCredits(data.credits);

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
            if (typeof newCredits === "number") setCredits(newCredits);
          }
        )
        .subscribe();

      setLoading(false);
    };

    fetchData();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <nav className="w-full flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
      <h1 className="text-lg font-semibold text-gray-800">
        Hi!{" "}
        <span className="text-blue-600 font-bold">
          {loading ? "Loading..." : username}
        </span>
      </h1>

      <div className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full">
        <Coins className="h-4 w-4" />
        <span className="font-semibold">
          {loading ? "Loading..." : `${credits} Credits`}
        </span>
      </div>
    </nav>
  );
}
