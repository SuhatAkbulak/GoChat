"use client";

import { useState } from "react";
import { DashboardPage } from "@/components/dashboard-page";
import { InboxMessageList } from "@/components/inbox-message-list";
import { InboxProvider, useInbox } from "@/components/inbox-provider";
import { api } from "@/lib/api";

function InboxHeader() {
  const { loadConversations, setSelectedId, setMessages } = useInbox();
  const [loading, setLoading] = useState(false);

  const handleClearAll = async () => {
    if (!window.confirm("Tüm mesajları silmek istediğinize emin misiniz?")) return;
    
    try {
      setLoading(true);
      await api.clearAllConversations();
      setSelectedId(null);
      setMessages([]);
      await loadConversations();
    } catch (e) {
      console.error("Silme hatası:", e);
      alert("Silinirken bir hata oluştu: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shrink-0 flex items-center justify-between border-b border-sidebar-border px-3 py-2.5">
      <p className="text-xs font-semibold tracking-wide text-sidebar-foreground/80">
        Inbox
      </p>
      <button 
        onClick={handleClearAll}
        disabled={loading}
        className="text-[10px] uppercase font-bold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
      >
        {loading ? "SİLİNİYOR..." : "TÜMÜNÜ SİL"}
      </button>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <InboxProvider>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside className="flex max-h-[min(45vh,320px)] shrink-0 flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:max-h-none md:h-full md:w-[min(100%,280px)] md:min-h-0 md:border-r md:border-b-0">
          <InboxHeader />
          <div className="min-h-0 flex-1 overflow-hidden md:flex md:flex-col">
            <InboxMessageList variant="rail" />
          </div>
        </aside>

        <div className="relative isolate z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:min-h-0">
          <DashboardPage />
        </div>
      </div>
    </InboxProvider>
  );
}
