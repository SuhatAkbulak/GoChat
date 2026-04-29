"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { TopNavbar } from "@/components/top-navbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function AppShell({ children, title }) {
  return (
    <SidebarProvider
      className="h-dvh max-h-dvh min-h-0 overflow-hidden"
      style={{
        /* Varsayılan 16rem yerine ince ikon şeridi (~48px) */
        "--sidebar-width": "3rem",
        "--sidebar-width-icon": "2.75rem",
      }}
    >
      <AppSidebar />
      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
        <TopNavbar title={title} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden [&>*]:min-h-0 [&>*]:min-w-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
