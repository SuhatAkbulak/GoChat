"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";

import { api } from "@/lib/api";
import { SOCKET_URL } from "@/lib/config";
import { mergeMessages } from "@/lib/inbox-message-utils";

const InboxContext = createContext(null);

/** Backend GET /conversations/:id ile aynı varsayılan sayfa boyutu */
export const INBOX_MESSAGES_PAGE_SIZE = 50;

export function InboxProvider({ children }) {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  const [error, setError] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const selectedIdRef = useRef(selectedId);
  const nextOlderPageRef = useRef(2);
  const hasMoreOlderRef = useRef(false);
  const olderFetchLockRef = useRef(false);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    hasMoreOlderRef.current = hasMoreOlderMessages;
  }, [hasMoreOlderMessages]);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.listConversations({
        page: 1,
        limit: 20,
        ...(channelFilter ? { channel: channelFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setConversations(res.data || []);
      setSelectedId((prev) => prev || res.data?.[0]?.id || null);
    } catch (e) {
      setError(`Konusmalar yuklenemedi: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [channelFilter, statusFilter]);

  const loadConversationsRef = useRef(loadConversations);
  useEffect(() => {
    loadConversationsRef.current = loadConversations;
  }, [loadConversations]);

  useEffect(() => {
    loadConversations().catch(() => null);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    olderFetchLockRef.current = false;
    nextOlderPageRef.current = 2;
    setHasMoreOlderMessages(false);
    setLoadingMessages(true);
    api
      .getConversation(selectedId, {
        page: 1,
        limit: INBOX_MESSAGES_PAGE_SIZE,
      })
      .then((res) => {
        const batch = res.messages || [];
        setMessages(batch);
        setHasMoreOlderMessages(batch.length === INBOX_MESSAGES_PAGE_SIZE);
        return api.markConversationRead(selectedId);
      })
      .then(() => {
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c)),
        );
      })
      .catch((e) => setError(`Konusma detayi yuklenemedi: ${e.message}`))
      .finally(() => setLoadingMessages(false));
  }, [selectedId]);

  const loadOlderMessages = useCallback(async () => {
    const id = selectedIdRef.current;
    if (!id || olderFetchLockRef.current || !hasMoreOlderRef.current) {
      return false;
    }

    const page = nextOlderPageRef.current;
    olderFetchLockRef.current = true;
    setLoadingOlderMessages(true);
    setError("");
    try {
      const res = await api.getConversation(id, {
        page,
        limit: INBOX_MESSAGES_PAGE_SIZE,
      });
      const batch = res.messages || [];
      if (selectedIdRef.current !== id) {
        return false;
      }
      setMessages((prev) => mergeMessages(prev, batch));
      if (batch.length === 0 || batch.length < INBOX_MESSAGES_PAGE_SIZE) {
        setHasMoreOlderMessages(false);
      } else {
        nextOlderPageRef.current = page + 1;
      }
      return batch.length > 0;
    } catch (e) {
      setError(`Eski mesajlar yuklenemedi: ${e.message}`);
      return false;
    } finally {
      olderFetchLockRef.current = false;
      setLoadingOlderMessages(false);
    }
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socket.on("conversation.message.received", (payload) => {
      const normalizedPayload = {
        ...payload,
        id: payload.messageId,
      };

      setConversations((prev) => {
        let found = false;
        const updated = prev.map((c) => {
          if (c.id !== normalizedPayload.conversationId) return c;
          found = true;
          return {
            ...c,
            participantId:
              c.participantId ||
              normalizedPayload.participantId ||
              normalizedPayload.from ||
              normalizedPayload.to,
            channel: c.channel || normalizedPayload.channel || "whatsapp",
            lastMessagePreview: normalizedPayload.text,
            lastMessageAt: normalizedPayload.createdAt,
            unreadCount:
              normalizedPayload.conversationId === selectedIdRef.current
                ? c.unreadCount || 0
                : normalizedPayload.direction === "INBOUND"
                  ? (c.unreadCount || 0) + 1
                  : c.unreadCount || 0,
          };
        });

        if (!found) {
          loadConversationsRef.current()?.catch(() => null);
        }

        return updated;
      });

      if (normalizedPayload.conversationId === selectedIdRef.current) {
        setMessages((prev) => mergeMessages(prev, [normalizedPayload]));
      }
    });
    return () => socket.disconnect();
  }, []);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );

  const orderedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return aTime - bTime;
    });
  }, [messages]);

  const resetAfterHardReset = useCallback(() => {
    setSelectedId(null);
    setMessages([]);
    setConversations([]);
  }, []);

  const value = useMemo(
    () => ({
      conversations,
      setConversations,
      selectedId,
      setSelectedId,
      loadingConversations: loading,
      messages,
      setMessages,
      loadingMessages,
      loadingOlderMessages,
      hasMoreOlderMessages,
      loadOlderMessages,
      channelFilter,
      setChannelFilter,
      statusFilter,
      setStatusFilter,
      loadConversations,
      selectedConversation,
      orderedMessages,
      error,
      setError,
      resetAfterHardReset,
    }),
    [
      conversations,
      selectedId,
      loading,
      messages,
      loadingMessages,
      loadingOlderMessages,
      hasMoreOlderMessages,
      loadOlderMessages,
      channelFilter,
      statusFilter,
      loadConversations,
      selectedConversation,
      orderedMessages,
      error,
      resetAfterHardReset,
    ],
  );

  return (
    <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
  );
}

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) {
    throw new Error("useInbox yalnizca InboxProvider icinde kullanilmalidir.");
  }
  return ctx;
}
