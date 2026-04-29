"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command, Inbox, Users } from "lucide-react";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  sidebarMenuButtonVariants,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { getAuthUser } from "@/lib/auth";

const NAV_MAIN = [
  { title: "Inbox", url: "/messages", icon: Inbox },
  { title: "Users", url: "/users", icon: Users },
];

export function AppSidebar(props) {
  const pathname = usePathname();

  const [user, setUser] = React.useState({
    name: "Operator",
    email: "operator@local.test",
    avatar: "",
  });

  React.useEffect(() => {
    const u = getAuthUser();
    if (u?.email) {
      setUser({
        name: u.name || "User",
        email: u.email,
        avatar: "",
      });
    }
  }, []);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-1.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              href="/messages"
              prefetch
              data-slot="sidebar-menu-button"
              data-sidebar="menu-button"
              data-size="lg"
              aria-label="Dashboard"
              title="Dashboard"
              className={cn(
                sidebarMenuButtonVariants({ variant: "default", size: "lg" }),
                "justify-center !p-0 md:h-8"
              )}
            >
              <div className="flex aspect-square size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Command className="size-3.5" />
              </div>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-0">
        <SidebarGroup className="px-0">
          <SidebarGroupContent className="px-1 md:px-0">
            <SidebarMenu>
              {NAV_MAIN.map((item) => {
                const isActive = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <Link
                      href={item.url}
                      prefetch
                      data-slot="sidebar-menu-button"
                      data-sidebar="menu-button"
                      data-size="default"
                      aria-label={item.title}
                      title={item.title}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        sidebarMenuButtonVariants({
                          variant: "default",
                          size: "default",
                        }),
                        "justify-center px-1 md:px-1"
                      )}
                      {...(isActive ? { "data-active": "" } : {})}
                    >
                      <item.icon />
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-1">
        <NavUser user={user} compact />
      </SidebarFooter>
    </Sidebar>
  );
}
