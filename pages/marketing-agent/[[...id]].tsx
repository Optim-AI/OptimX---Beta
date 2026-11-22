// /marketing-agent and /marketing-agent/<chatId>
import React from "react";
import type { JSX } from "react";
import Head from "next/head";
import Sidebar from "../../app/web/src/components/Sidebar";
import colors from "@/lib/ui/colors";
import MarketingAgent from "@/app/web/src/components/agent/MarketingAgent";

export default function MarketingAgentPage(): JSX.Element {
  return (
    <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
      <Head>
        <title>Marketing Agent | SkalX AI</title>
      </Head>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-hidden">
        <MarketingAgent />
      </main>
    </div>
  );
}
