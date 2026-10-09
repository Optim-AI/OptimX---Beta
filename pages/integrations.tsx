// pages/integrations.tsx
"use client";

import React from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { IntegrationsConnectPanel } from "@/app/web/src/components/integrations/IntegrationsConnectPanel";

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen flex app-page">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="p-6">
          <IntegrationsConnectPanel
            showHeader
            showFooter
            requireAuth
            oauthRedirectPath="/integrations"
          />
        </div>
      </main>
    </div>
  );
}
