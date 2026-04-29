"use client";

import { cn } from "@/lib/utils";
import { formatChannelLabel, formatConversationListTime } from "@/lib/inbox-format";

import { useInbox } from "@/components/inbox-provider";

/**
 * WebSocket + API ile güncellenen konuşma listesi (InboxProvider gerekli).
 * @param {"default" | "rail"} variant rail = ikinci sütun sidebar görünümü
 */
export function InboxMessageList({ variant = "default" }) {
  const {
    conversations,
    selectedId,
    setSelectedId,
    loadingConversations: loading,
  } = useInbox();

  const isRail = variant === "rail";

  const itemClass = cn(
    "flex w-full flex-col items-start gap-2 p-4 text-left text-sm leading-tight transition-colors last:border-b-0",
    isRail
      ? "border-b border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      : "border-b border-border hover:bg-accent hover:text-accent-foreground",
    !isRail && "whitespace-nowrap",
  );

  const outerClass = cn(
    "no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto",
    !isRail && "rounded-xl border border-border bg-card/40",
    isRail && "bg-transparent",
  );

  if (loading) {
    return (
      <div className={outerClass}>
        <p className="p-4 text-sm text-muted-foreground">Yükleniyor…</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className={outerClass}>
        <p className="p-4 text-sm text-muted-foreground">Konuşma yok.</p>
      </div>
    );
  }

  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={outerClass}
    >
      <div
        data-slot="sidebar-group"
        data-sidebar="group"
        className="relative flex min-h-0 w-full min-w-0 flex-col"
      >
        <div
          data-slot="sidebar-group-content"
          data-sidebar="group-content"
          className="w-full text-sm"
        >
          {conversations.map((row) => {
            const active = row.id === selectedId;
            const timeLabel = formatConversationListTime(row.lastMessageAt);
            const channelLabel = formatChannelLabel(row.channel);
            const preview = row.lastMessagePreview || "—";

            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={cn(
                  itemClass,
                  active &&
                    (isRail
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "bg-accent text-accent-foreground"),
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <span className="min-w-0 truncate font-medium">
                    {row.participantId || row.id}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {timeLabel}
                  </span>
                </div>
                <span className="font-medium">
                  {channelLabel}
                  {(row.unreadCount || 0) > 0 ? (
                    <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                      {row.unreadCount}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "line-clamp-2 w-full text-xs whitespace-break-spaces text-muted-foreground",
                    isRail ? "max-w-[240px]" : "max-w-[min(100%,260px)]",
                  )}
                >
                  {preview}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
