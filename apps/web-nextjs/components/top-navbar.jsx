"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";

function prettifySegment(segment) {
  if (!segment) return "Dashboard";
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function TopNavbar({ title }) {
  const pathname = usePathname();

  const breadcrumb = useMemo(() => {
    if (title) return title;
    const parts = pathname.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1];
    return prettifySegment(lastPart);
  }, [pathname, title]);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="border border-border bg-muted text-foreground hover:bg-accent hover:text-accent-foreground" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{breadcrumb}</p>
      </div>
      <div className="ml-auto text-xs text-muted-foreground">v1</div>
    </header>
  );
}
