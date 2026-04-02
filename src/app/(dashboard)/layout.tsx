"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SSEProvider } from "@/providers/sse-provider";
import { MessagingProvider } from "@/providers/messaging-provider";
import { ChatPanel } from "@/components/messaging/chat-panel";
import { AuthGuard } from "@/components/shared/auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SSEProvider>
        <MessagingProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <Topbar />
              <main className="flex-1 p-6">{children}</main>
            </SidebarInset>
          </SidebarProvider>
          <ChatPanel />
        </MessagingProvider>
      </SSEProvider>
    </AuthGuard>
  );
}
