import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CircleDashed } from 'lucide-react';
import { api } from '../lib/api';
import { SOCKET_URL } from '../lib/config';
import { clearAuthTokens, getAuthRole, getRefreshToken } from '../lib/auth';

function getMessageKey(message) {
  return message.id || message.messageId;
}

function mergeMessages(prev, incoming) {
  const map = new Map(prev.map((item) => [getMessageKey(item), item]));

  for (const raw of incoming) {
    const key = getMessageKey(raw);
    if (!key) continue;

    const existing = map.get(key);
    const normalized = {
      ...existing,
      ...raw,
      id: raw.id || raw.messageId || existing?.id,
      messageId: raw.messageId || raw.id || existing?.messageId,
      text: raw.text ?? existing?.text ?? '',
      direction: raw.direction ?? existing?.direction,
      createdAt: raw.createdAt ?? existing?.createdAt,
      status: raw.status ?? existing?.status,
    };
    map.set(key, normalized);
  }

  return Array.from(map.values());
}

function withTestTimestamp(baseText) {
  const stamp = new Date().toLocaleString('tr-TR', {
    hour12: false,
  });
  return `${baseText} [test-zaman:${stamp}]`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mockConfig, setMockConfig] = useState({
    failureRate: 0.3,
    duplicateRate: 0.2,
    outOfOrderRate: 0.15,
    delayMaxMs: 2000,
    autoReplyEnabled: true,
    autoReplyMaxDelayMs: 1500,
  });
  const [mockConfigLoading, setMockConfigLoading] = useState(false);
  const [mockConfigSaving, setMockConfigSaving] = useState(false);
  const [scenarioRunning, setScenarioRunning] = useState('');
  const [scenarioLog, setScenarioLog] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleSavingUserId, setRoleSavingUserId] = useState('');
  const [usersFeatureAvailable, setUsersFeatureAvailable] = useState(true);
  const [outboundDraft, setOutboundDraft] = useState({
    channel: 'whatsapp',
    to: 'user-123',
    text: withTestTimestamp('Test message from dashboard'),
  });
  const [duplicateDraft, setDuplicateDraft] = useState({
    channel: 'whatsapp',
    from: 'user-123',
    text: withTestTimestamp('Hi from duplicate scenario'),
  });
  const [outOfOrderDraft, setOutOfOrderDraft] = useState({
    channel: 'whatsapp',
    from: 'user-123',
    text: withTestTimestamp('Hi from out-of-order scenario'),
  });
  const [failureRateDraft, setFailureRateDraft] = useState(1);
  const [scenarioPanels, setScenarioPanels] = useState({
    normalSend: true,
    failureRate: false,
    duplicateWebhook: false,
    outOfOrderWebhook: false,
  });
  const messagesContainerRef = useRef(null);
  const [activeMenu, setActiveMenu] = useState('operations');
  const [activeSection, setActiveSection] = useState('inbox');

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

  const userRole = useMemo(() => (getAuthRole() || '').toUpperCase(), []);
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
  const unreadTotal = useMemo(
    () => conversations.reduce((total, item) => total + (item.unreadCount || 0), 0),
    [conversations],
  );
  const activeConversationCount = useMemo(
    () => conversations.filter((item) => (item.unreadCount || 0) > 0).length,
    [conversations],
  );

  const mockUserOptions = useMemo(() => {
    const seededUsers = ['user-123', 'user-456', 'user-789', 'test-user-1', 'test-user-2'];
    const fromConversations = conversations
      .map((item) => item.participantId)
      .filter((item) => typeof item === 'string' && item.trim().length > 0);

    return Array.from(new Set([...seededUsers, ...fromConversations]));
  }, [conversations]);

  async function loadConversations() {
    setLoading(true);
    setError('');
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
  }

  useEffect(() => {
    let mounted = true;
    loadConversations().catch(() => null);
    return () => {
      mounted = false;
    };
  }, [channelFilter, statusFilter]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingMessages(true);
    api
      .getConversation(selectedId, { page: 1, limit: 50 })
      .then((res) => {
        setMessages(res.messages || []);
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

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [orderedMessages, selectedId]);

  useEffect(() => {
    if (!isAdmin || activeMenu !== 'admin' || activeSection !== 'dashboard') return;
    setUsersLoading(true);
    api
      .listUsers()
      .then((res) => {
        setUsers(res.data || []);
        setUsersFeatureAvailable(true);
      })
      .catch((e) => {
        const raw = String(e?.message || '');
        if (raw.includes('HTTP 404') && raw.includes('/users')) {
          setUsersFeatureAvailable(false);
          return;
        }
        setError(`Kullanicilar yuklenemedi: ${e.message}`);
      })
      .finally(() => setUsersLoading(false));
  }, [activeMenu, isAdmin, activeSection]);

  useEffect(() => {
    setMockConfigLoading(true);
    api
      .getMockMetaConfig()
      .then((res) => {
        if (!res?.config) return;
        setMockConfig((prev) => ({ ...prev, ...res.config }));
      })
      .catch((e) => setError(`Mock config alinamadi: ${e.message}`))
      .finally(() => setMockConfigLoading(false));
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socket.on('conversation.message.received', (payload) => {
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
            channel: c.channel || normalizedPayload.channel || 'whatsapp',
            lastMessagePreview: normalizedPayload.text,
            lastMessageAt: normalizedPayload.createdAt,
            unreadCount:
              normalizedPayload.conversationId === selectedId
                ? c.unreadCount || 0
                : normalizedPayload.direction === 'INBOUND'
                  ? (c.unreadCount || 0) + 1
                  : c.unreadCount || 0,
          };
        });

        if (found) {
          return updated;
        }

        // Socket payloadi her zaman participant bilgisini tasimiyor.
        // Sahte "unknown" kaydi eklemek yerine API listesini yenileyip dogru kaydi cekiyoruz.
        loadConversations().catch(() => null);
        return updated;
      });

      if (normalizedPayload.conversationId === selectedId) {
        setMessages((prev) => mergeMessages(prev, [normalizedPayload]));
      }
    });
    return () => socket.disconnect();
  }, [selectedId]);

  async function onSend(e) {
    e.preventDefault();
    if (!selectedConversation || !text.trim()) return;
    const sentText = text.trim();
    const response = await api.sendMessage({
      channel: selectedConversation.channel,
      to: selectedConversation.participantId,
      text: sentText,
      clientMessageId: crypto.randomUUID(),
    });
    setText('');
    setMessages((prev) =>
      mergeMessages(prev, [
        {
          ...response,
          text: response.text || sentText,
          direction: 'OUTBOUND',
        },
      ]),
    );
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversation.id
          ? {
              ...c,
              lastMessagePreview: response.text || sentText,
              lastMessageAt: response.createdAt || new Date().toISOString(),
            }
          : c,
      ),
    );
  }

  async function onLogout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await api.authLogout({ refreshToken });
    } catch {
      // ignore
    } finally {
      clearAuthTokens();
      navigate('/login', { replace: true });
    }
  }

  async function onHardReset() {
    if (!isAdmin) {
      setError('Bu aksiyon sadece admin rolunde acik.');
      return;
    }
    if (conversations.length === 0) {
      setError('Silinecek konusma yok.');
      return;
    }

    const approved = window.confirm(
      'Hard Reset yapilsin mi? Tum conversation, mesaj ve webhook event kayitlari silinecek.',
    );
    if (!approved) return;

    try {
      await api.hardResetConversations();
      setSelectedId(null);
      setMessages([]);
      setConversations([]);
    } catch (e) {
      setError(`Hard reset basarisiz: ${e.message}`);
    }
  }

  function onMockConfigChange(key, value) {
    setMockConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function onSaveMockConfig() {
    setMockConfigSaving(true);
    setError('');
    try {
      await api.updateMockMetaConfig(mockConfig);
    } catch (e) {
      setError(`Mock config kaydedilemedi: ${e.message}`);
    } finally {
      setMockConfigSaving(false);
    }
  }

  function pushScenarioLog(title, payload) {
    const line = `[${new Date().toLocaleTimeString('tr-TR')}] ${title}\n${JSON.stringify(payload, null, 2)}`;
    setScenarioLog((prev) => [line, ...prev].slice(0, 8));
  }

  function setRandomOutboundText() {
    const candidates = [
      'Merhaba, bu normal outbound test mesaji.',
      'Sistem test: siparis durumunuzu kontrol eder misiniz?',
      'Yeni kampanya aktif, detay ister misiniz?',
      'Dashboard test mesaji: zaman damgasi kontrolu.',
      'Merhaba, bu mesaj random generator ile gonderildi.',
    ];
    const randomText = candidates[Math.floor(Math.random() * candidates.length)];
    setOutboundDraft((prev) => ({ ...prev, text: withTestTimestamp(randomText) }));
  }

  function setRandomOutboundUser() {
    if (mockUserOptions.length === 0) return;
    const randomUser = mockUserOptions[Math.floor(Math.random() * mockUserOptions.length)];
    setOutboundDraft((prev) => ({ ...prev, to: randomUser }));
  }

  function setRandomInboundUser(kind) {
    if (mockUserOptions.length === 0) return;
    const randomUser = mockUserOptions[Math.floor(Math.random() * mockUserOptions.length)];
    if (kind === 'duplicate') {
      setDuplicateDraft((prev) => ({ ...prev, from: randomUser }));
      return;
    }
    setOutOfOrderDraft((prev) => ({ ...prev, from: randomUser }));
  }

  function toggleScenarioPanel(key) {
    setScenarioPanels((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  async function onUpdateUserRole(userId, role) {
    setRoleSavingUserId(userId);
    try {
      const updated = await api.updateUserRole(userId, { role });
      setUsers((prev) => prev.map((item) => (item.id === userId ? { ...item, ...updated } : item)));
    } catch (e) {
      setError(`Rol guncellenemedi: ${e.message}`);
    } finally {
      setRoleSavingUserId('');
    }
  }

  async function sendNormalOutbound(payload) {
    const cleaned = {
      channel: payload.channel || 'whatsapp',
      to: payload.to?.trim(),
      text: payload.text?.trim(),
    };

    if (!cleaned.to || !cleaned.text) {
      setError('Outbound test icin "to" ve "text" zorunlu.');
      return;
    }

    const res = await api.sendMessage({
      channel: cleaned.channel,
      to: cleaned.to,
      text: cleaned.text,
      clientMessageId: crypto.randomUUID(),
    });

    pushScenarioLog('Normal Mesaj Gonderimi (Backend Send)', res);
    await loadConversations();

    if (res?.conversationId) {
      setSelectedId(res.conversationId);
    }
  }

  async function runNormalSendScenario() {
    setScenarioRunning('normal-send');
    setError('');
    try {
      await sendNormalOutbound(outboundDraft);
    } catch (e) {
      setError(`Senaryo calismadi (normal-send): ${e.message}`);
    } finally {
      setScenarioRunning('');
    }
  }

  async function runDuplicateScenario() {
    setScenarioRunning('duplicate-webhook');
    setError('');
    try {
      const res = await api.mockSimulateInbound({
        channel: duplicateDraft.channel,
        from: duplicateDraft.from.trim(),
        text: duplicateDraft.text.trim(),
        duplicate: true,
        outOfOrder: false,
      });
      pushScenarioLog('Duplicate Webhook', res);
    } catch (e) {
      setError(`Senaryo calismadi (duplicate-webhook): ${e.message}`);
    } finally {
      setScenarioRunning('');
    }
  }

  async function runOutOfOrderScenario() {
    setScenarioRunning('out-of-order');
    setError('');
    try {
      const res = await api.mockSimulateInbound({
        channel: outOfOrderDraft.channel,
        from: outOfOrderDraft.from.trim(),
        text: outOfOrderDraft.text.trim(),
        duplicate: false,
        outOfOrder: true,
      });
      pushScenarioLog('Out-of-Order Webhook', res);
    } catch (e) {
      setError(`Senaryo calismadi (out-of-order): ${e.message}`);
    } finally {
      setScenarioRunning('');
    }
  }

  async function runFailureRateScenario() {
    setScenarioRunning('fail-100');
    setError('');
    try {
      const normalizedFailureRate = Math.max(0, Math.min(1, Number(failureRateDraft) || 0));
      const res = await api.updateMockMetaConfig({ failureRate: normalizedFailureRate });
      pushScenarioLog(`Failure Rate %${Math.round(normalizedFailureRate * 100)}`, res);
      setMockConfig((prev) => ({ ...prev, failureRate: normalizedFailureRate }));
    } catch (e) {
      setError(`Senaryo calismadi (fail-rate): ${e.message}`);
    } finally {
      setScenarioRunning('');
    }
  }

  function formatTime(value) {
    if (!value) return '--:--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';
    return new Intl.DateTimeFormat('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function resolveStatus(message) {
    if (message.status) return message.status;
    return message.direction === 'OUTBOUND' ? 'PENDING' : 'RECEIVED';
  }

  function statusClass(status) {
    if (status === 'SENT') return 'bg-emerald-600/20 text-emerald-300';
    if (status === 'PENDING') return 'bg-amber-600/20 text-amber-300';
    return 'bg-rose-600/20 text-rose-300';
  }

  function getChannelMeta(channel) {
    if ((channel || '').toLowerCase() === 'whatsapp') {
      return { label: 'WhatsApp', type: 'whatsapp' };
    }
    if ((channel || '').toLowerCase() === 'instagram') {
      return { label: 'Instagram', type: 'instagram' };
    }
    return { label: 'Unknown', type: 'unknown' };
  }

  function ChannelIcon({ type }) {
    if (type === 'whatsapp') {
      return (
        <svg viewBox="0 0 24 24" className="h-3 w-3 text-emerald-400" fill="currentColor" aria-hidden>
          <path d="M20.5 3.5A11 11 0 0 0 3.4 17.2L2 22l5-1.3A11 11 0 1 0 20.5 3.5Zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-3 .8.8-2.9-.2-.3a9 9 0 1 1 7.3 3.9Zm4.9-6.7c-.3-.2-1.7-.9-2-1s-.5-.2-.7.2-.8 1-1 1.1-.4.2-.7 0a7.2 7.2 0 0 1-2.1-1.3 8 8 0 0 1-1.5-1.9c-.1-.3 0-.4.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5l-.7-1.8c-.2-.5-.4-.4-.6-.4h-.6a1.2 1.2 0 0 0-.9.4c-.3.3-1.1 1-1.1 2.5s1.1 2.9 1.3 3.1 2.2 3.4 5.4 4.8c.7.3 1.3.5 1.8.6.8.2 1.5.2 2.1.1.7-.1 1.7-.7 2-1.3.2-.6.2-1.2.1-1.3-.1-.2-.3-.2-.6-.4Z" />
        </svg>
      );
    }
    if (type === 'instagram') {
      return (
        <svg viewBox="0 0 24 24" className="h-3 w-3 text-pink-400" fill="currentColor" aria-hidden>
          <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm9.8 2H7.2A3.2 3.2 0 0 0 4 7.2v9.6A3.2 3.2 0 0 0 7.2 20h9.6a3.2 3.2 0 0 0 3.2-3.2V7.2A3.2 3.2 0 0 0 16.8 4ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.3-2.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
        </svg>
      );
    }
    return <CircleDashed size={12} className="text-slate-500" />;
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-950 text-slate-100 md:grid-cols-[280px_1fr_340px]">
      <aside className="border-r border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 p-4">
          <h1 className="text-lg font-semibold text-slate-100">GoChat Panel</h1>
          <p className="mt-1 text-xs text-slate-400">Dashboard + Inbox</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('dashboard')}
              className={`rounded border px-2 py-1 text-xs font-medium ${
                activeSection === 'dashboard'
                  ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
                  : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('inbox')}
              className={`rounded border px-2 py-1 text-xs font-medium ${
                activeSection === 'inbox'
                  ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
                  : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Inbox
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            >
              <option value="">Tum kanal</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            >
              <option value="">Tum durumlar</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveMenu('operations')}
              className={`rounded border px-2 py-1 text-xs font-medium ${
                activeMenu === 'operations'
                  ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
                  : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Operasyon
            </button>
            <button
              type="button"
              onClick={() => setActiveMenu('admin')}
              disabled={!isAdmin}
              className={`rounded border px-2 py-1 text-xs font-medium ${
                activeMenu === 'admin'
                  ? 'border-rose-500 bg-rose-600/20 text-rose-200'
                  : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Admin
            </button>
          </div>
          {activeMenu === 'admin' && isAdmin ? (
            <button
              type="button"
              onClick={onHardReset}
              disabled={conversations.length === 0}
              className="mt-2 w-full rounded border border-rose-700 bg-rose-900/20 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-900/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Hard Reset (Mesaj + Conv + WebhookEvent)
            </button>
          ) : null}
        </div>
        <div className="max-h-[calc(100vh-200px)] overflow-auto">
          {activeSection === 'dashboard' ? (
            <div className="space-y-2 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-200">Menu</p>
              <div className="rounded border border-slate-700 bg-slate-950 p-2">Genel Bakis</div>
              <div className="rounded border border-slate-700 bg-slate-950 p-2">KPI Kartlari</div>
              <div className="rounded border border-slate-700 bg-slate-950 p-2">Raporlar</div>
              {isAdmin ? <div className="rounded border border-slate-700 bg-slate-950 p-2">Kullanicilar ve Roller</div> : null}
            </div>
          ) : null}
          {activeSection === 'inbox' ? (
            <>
          {loading ? (
            <p className="p-4 text-sm text-slate-400">Yukleniyor...</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Konusma bulunamadi.</p>
          ) : (
            conversations.map((c) => (
              (() => {
                const channelMeta = getChannelMeta(c.channel);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full border-b border-slate-200 p-4 text-left transition ${
                      selectedId === c.id ? 'bg-slate-800' : 'bg-slate-900 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-100">{c.participantId}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <ChannelIcon type={channelMeta.type} />
                            {channelMeta.label}
                          </span>
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-400">{formatTime(c.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-slate-400">{c.lastMessagePreview}</p>
                      {c.unreadCount > 0 ? (
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {c.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })()
            ))
          )}
            </>
          ) : null}
        </div>
      </aside>

      <main className="flex h-screen min-h-0 flex-col bg-slate-950">
        <header className="border-b border-slate-800 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-100">
              {activeSection === 'dashboard'
                ? 'Dashboard Ozeti'
                : selectedConversation
                  ? selectedConversation.participantId
                  : 'Konusma secin'}
            </h2>
            <button
              onClick={onLogout}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              Cikis
            </button>
          </div>
        </header>
        {activeSection === 'dashboard' ? (
          <section className="grid flex-1 grid-cols-1 gap-4 overflow-auto bg-slate-950 p-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs text-slate-400">Toplam Konusma</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{conversations.length}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs text-slate-400">Toplam Unread</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{unreadTotal}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs text-slate-400">Aktif Konusma</p>
              <p className="mt-1 text-2xl font-semibold text-indigo-600">{activeConversationCount}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 md:col-span-2">
              <p className="text-sm font-semibold text-slate-100">Durum Ozeti</p>
              <p className="mt-2 text-sm text-slate-400">
                Dashboard sekmesi KPI odakli, Inbox sekmesi ise canli konusma operasyonu icin tasarlandi.
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-sm font-semibold text-slate-100">Rol</p>
              <p className="mt-2 text-sm text-slate-400">{isAdmin ? 'Admin' : 'Operasyon'}</p>
            </div>
          </section>
        ) : (
          <>
        <section
          ref={messagesContainerRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-950 p-4"
        >
          {error ? (
            <div className="mb-3 rounded border border-rose-700 bg-rose-900/30 p-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          {loadingMessages ? <p className="text-sm text-slate-400">Mesajlar yukleniyor...</p> : null}
          {!loadingMessages && messages.length === 0 ? (
            <p className="text-sm text-slate-400">Henuz mesaj yok.</p>
          ) : null}
          {orderedMessages.map((m) => {
            const isOutbound = m.direction === 'OUTBOUND';
            const status = resolveStatus(m);
            return (
              <div
                key={m.id || m.messageId}
                className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
              >
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className={`max-w-[80%] rounded-2xl px-3 py-2 shadow ${
                    isOutbound
                      ? 'rounded-br-md bg-indigo-600 text-white'
                      : 'rounded-bl-md border border-slate-700 bg-slate-800 text-slate-100'
                  }`}
                >
                  <p className="break-words text-sm leading-relaxed">{m.text}</p>
                  <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-slate-200/80">
                    <span>{formatTime(m.createdAt)}</span>
                    {isOutbound ? (
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${statusClass(status)}`}>
                        {status}
                      </span>
                    ) : null}
                  </div>
                </motion.div>
              </div>
            );
          })}
        </section>

        <form onSubmit={onSend} className="border-t border-slate-800 p-4">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Mesaj yaz..."
              className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 outline-none"
            />
            <button className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500">
              Gonder
            </button>
          </div>
        </form>
          </>
        )}
      </main>

      <aside className="border-l border-slate-800 bg-slate-900 p-4">
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Mock Provider Config</h3>
            {mockConfigLoading ? <span className="text-[11px] text-slate-400">Yukleniyor...</span> : null}
          </div>
          {activeMenu === 'admin' && isAdmin ? (
            <div className="mb-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-300">Admin KPI</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border border-slate-700 bg-slate-900 px-2 py-2">
                  <p className="text-[10px] text-slate-500">Konusma</p>
                  <p className="text-sm font-semibold text-slate-100">{conversations.length}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900 px-2 py-2">
                  <p className="text-[10px] text-slate-500">Unread</p>
                  <p className="text-sm font-semibold text-amber-300">{unreadTotal}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-900 px-2 py-2">
                  <p className="text-[10px] text-slate-500">Kullanici</p>
                  <p className="text-sm font-semibold text-indigo-300">{users.length}</p>
                </div>
              </div>
              <div className="rounded border border-slate-700 bg-slate-900 p-2">
                <p className="mb-2 text-[11px] font-semibold text-slate-200">Kullanicilar ve Rol Atama</p>
                {!usersFeatureAvailable ? (
                  <div className="rounded border border-amber-700/40 bg-amber-900/10 p-2 text-[11px] text-amber-200">
                    Bu backend surumunde `/users` modulu acik degil. Admin UI fallback modunda.
                  </div>
                ) : (
                  <div className="max-h-40 space-y-2 overflow-auto pr-1">
                    {usersLoading ? (
                      <p className="text-[11px] text-slate-400">Kullanicilar yukleniyor...</p>
                    ) : users.length === 0 ? (
                      <p className="text-[11px] text-slate-500">Kullanici bulunamadi.</p>
                    ) : (
                      users.map((user) => (
                        <div key={user.id} className="rounded border border-slate-800 bg-slate-950 p-2">
                          <p className="truncate text-[11px] text-slate-200">{user.email}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <select
                              value={String(user.role || '').toLowerCase()}
                              onChange={(e) => onUpdateUserRole(user.id, e.target.value)}
                              disabled={roleSavingUserId === user.id}
                              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
                            >
                              <option value="admin">admin</option>
                              <option value="super_admin">super_admin</option>
                              <option value="support">support</option>
                            </select>
                            <span className="text-[10px] text-slate-500">
                              {roleSavingUserId === user.id ? '...' : user.isActive ? 'Aktif' : 'Pasif'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="block text-[11px] text-slate-400">
              failureRate
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={mockConfig.failureRate}
                onChange={(e) => onMockConfigChange('failureRate', Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              />
            </label>
            <label className="block text-[11px] text-slate-400">
              duplicateRate
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={mockConfig.duplicateRate}
                onChange={(e) => onMockConfigChange('duplicateRate', Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              />
            </label>
            <label className="block text-[11px] text-slate-400">
              outOfOrderRate
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={mockConfig.outOfOrderRate}
                onChange={(e) => onMockConfigChange('outOfOrderRate', Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              />
            </label>
            <label className="block text-[11px] text-slate-400">
              delayMaxMs
              <input
                type="number"
                min="0"
                step="100"
                value={mockConfig.delayMaxMs}
                onChange={(e) => onMockConfigChange('delayMaxMs', Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              />
            </label>
            <label className="block text-[11px] text-slate-400">
              autoReplyEnabled
              <select
                value={mockConfig.autoReplyEnabled ? 'true' : 'false'}
                onChange={(e) => onMockConfigChange('autoReplyEnabled', e.target.value === 'true')}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <label className="block text-[11px] text-slate-400">
              autoReplyMaxDelayMs
              <input
                type="number"
                min="0"
                step="100"
                value={mockConfig.autoReplyMaxDelayMs}
                onChange={(e) => onMockConfigChange('autoReplyMaxDelayMs', Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setMockConfig({
                    failureRate: 0.1,
                    duplicateRate: 0.05,
                    outOfOrderRate: 0.05,
                    delayMaxMs: 500,
                    autoReplyEnabled: true,
                    autoReplyMaxDelayMs: 800,
                  })
                }
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] hover:bg-slate-800"
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() =>
                  setMockConfig({
                    failureRate: 0.8,
                    duplicateRate: 0.7,
                    outOfOrderRate: 0.5,
                    delayMaxMs: 5000,
                    autoReplyEnabled: true,
                    autoReplyMaxDelayMs: 2000,
                  })
                }
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] hover:bg-slate-800"
              >
                Chaos
              </button>
            </div>
            <button
              type="button"
              onClick={onSaveMockConfig}
              disabled={mockConfigSaving}
              className="w-full rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium hover:bg-indigo-500 disabled:opacity-60"
            >
              {mockConfigSaving ? 'Kaydediliyor...' : 'Config Kaydet'}
            </button>

            <div className="my-3 border-t border-slate-800" />
            <p className="text-[11px] font-semibold text-slate-300">
              {activeMenu === 'admin' ? 'Admin Test Menusu' : 'Operasyon Test Menusu'}
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Dis (Outbound / Provider)
            </p>
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-2 rounded border border-slate-700 bg-slate-900/60 p-2">
                <button
                  type="button"
                  onClick={() => toggleScenarioPanel('normalSend')}
                  className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-slate-200"
                >
                  <span>1) Normal Mesaj Gonderimi</span>
                  <span>{scenarioPanels.normalSend ? '−' : '+'}</span>
                </button>
                {scenarioPanels.normalSend ? (
                  <>
                    <label className="block text-[11px] text-slate-400">
                  channel
                  <select
                    value={outboundDraft.channel}
                    onChange={(e) => setOutboundDraft((prev) => ({ ...prev, channel: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  >
                    <option value="whatsapp">whatsapp</option>
                    <option value="instagram">instagram</option>
                  </select>
                    </label>
                    <label className="block text-[11px] text-slate-400">
                  mock user (to)
                  <div className="mt-1 flex gap-1">
                    <select
                      value={outboundDraft.to}
                      onChange={(e) => setOutboundDraft((prev) => ({ ...prev, to: e.target.value }))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    >
                      {mockUserOptions.map((userId) => (
                        <option key={userId} value={userId}>
                          {userId}
                        </option>
                      ))}
                    </select>
                      <button
                        type="button"
                        onClick={setRandomOutboundUser}
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] hover:bg-slate-800"
                      >
                        Random
                      </button>
                    </div>
                    </label>
                    <label className="block text-[11px] text-slate-400">
                  text
                  <textarea
                    value={outboundDraft.text}
                    onChange={(e) => setOutboundDraft((prev) => ({ ...prev, text: e.target.value }))}
                    rows={3}
                    className="mt-1 w-full resize-none rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={setRandomOutboundText}
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] hover:bg-slate-800"
                      >
                        Random Mesaj
                      </button>
                      <button
                        type="button"
                        onClick={runNormalSendScenario}
                        disabled={!!scenarioRunning}
                        className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {scenarioRunning === 'normal-send' ? 'Gonderiliyor...' : 'Bu Ayarla Gonder'}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
              {activeMenu === 'admin' ? (
                <div className="space-y-2 rounded border border-rose-700 bg-rose-900/10 p-2">
                <button
                  type="button"
                  onClick={() => toggleScenarioPanel('failureRate')}
                  className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-rose-200"
                >
                  <span>4) Failure Rate Ayarlama</span>
                  <span>{scenarioPanels.failureRate ? '−' : '+'}</span>
                </button>
                {scenarioPanels.failureRate ? (
                  <>
                    <label className="block text-[11px] text-slate-400">
                  failureRate (0-1)
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={failureRateDraft}
                    onChange={(e) => setFailureRateDraft(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                    </label>
                    <button
                      type="button"
                      onClick={runFailureRateScenario}
                      disabled={!!scenarioRunning}
                      className="w-full rounded border border-rose-700 bg-rose-900/20 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-900/30 disabled:opacity-60"
                    >
                      {scenarioRunning === 'fail-100' ? 'Calisiyor...' : 'Failure Rate Uygula'}
                    </button>
                  </>
                ) : null}
                </div>
              ) : null}
            </div>

            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Ic (Inbound / Webhook)
            </p>
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-2 rounded border border-slate-700 bg-slate-900/60 p-2">
                <button
                  type="button"
                  onClick={() => toggleScenarioPanel('duplicateWebhook')}
                  className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-slate-200"
                >
                  <span>2) Duplicate Webhook</span>
                  <span>{scenarioPanels.duplicateWebhook ? '−' : '+'}</span>
                </button>
                {scenarioPanels.duplicateWebhook ? (
                  <>
                    <label className="block text-[11px] text-slate-400">
                  channel
                  <select
                    value={duplicateDraft.channel}
                    onChange={(e) => setDuplicateDraft((prev) => ({ ...prev, channel: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  >
                    <option value="whatsapp">whatsapp</option>
                    <option value="instagram">instagram</option>
                  </select>
                    </label>
                    <label className="block text-[11px] text-slate-400">
                  from
                  <div className="mt-1 flex gap-1">
                    <select
                      value={duplicateDraft.from}
                      onChange={(e) => setDuplicateDraft((prev) => ({ ...prev, from: e.target.value }))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    >
                      {mockUserOptions.map((userId) => (
                        <option key={`dup-${userId}`} value={userId}>
                          {userId}
                        </option>
                      ))}
                    </select>
                      <button
                        type="button"
                        onClick={() => setRandomInboundUser('duplicate')}
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] hover:bg-slate-800"
                      >
                        Random
                      </button>
                    </div>
                    </label>
                    <label className="block text-[11px] text-slate-400">
                  text
                  <textarea
                    rows={2}
                    value={duplicateDraft.text}
                    onChange={(e) => setDuplicateDraft((prev) => ({ ...prev, text: e.target.value }))}
                    className="mt-1 w-full resize-none rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                    </label>
                    <button
                      type="button"
                      onClick={runDuplicateScenario}
                      disabled={!!scenarioRunning}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] hover:bg-slate-800 disabled:opacity-60"
                    >
                      {scenarioRunning === 'duplicate-webhook' ? 'Calisiyor...' : 'Duplicate Testi Calistir'}
                    </button>
                  </>
                ) : null}
              </div>

              <div className="space-y-2 rounded border border-slate-700 bg-slate-900/60 p-2">
                <button
                  type="button"
                  onClick={() => toggleScenarioPanel('outOfOrderWebhook')}
                  className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-slate-200"
                >
                  <span>3) Out-of-Order Webhook</span>
                  <span>{scenarioPanels.outOfOrderWebhook ? '−' : '+'}</span>
                </button>
                {scenarioPanels.outOfOrderWebhook ? (
                  <>
                    <label className="block text-[11px] text-slate-400">
                  channel
                  <select
                    value={outOfOrderDraft.channel}
                    onChange={(e) => setOutOfOrderDraft((prev) => ({ ...prev, channel: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  >
                    <option value="whatsapp">whatsapp</option>
                    <option value="instagram">instagram</option>
                  </select>
                    </label>
                    <label className="block text-[11px] text-slate-400">
                  from
                  <div className="mt-1 flex gap-1">
                    <select
                      value={outOfOrderDraft.from}
                      onChange={(e) => setOutOfOrderDraft((prev) => ({ ...prev, from: e.target.value }))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                    >
                      {mockUserOptions.map((userId) => (
                        <option key={`ooo-${userId}`} value={userId}>
                          {userId}
                        </option>
                      ))}
                    </select>
                      <button
                        type="button"
                        onClick={() => setRandomInboundUser('out-of-order')}
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] hover:bg-slate-800"
                      >
                        Random
                      </button>
                    </div>
                    </label>
                    <label className="block text-[11px] text-slate-400">
                  text
                  <textarea
                    rows={2}
                    value={outOfOrderDraft.text}
                    onChange={(e) => setOutOfOrderDraft((prev) => ({ ...prev, text: e.target.value }))}
                    className="mt-1 w-full resize-none rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  />
                    </label>
                    <button
                      type="button"
                      onClick={runOutOfOrderScenario}
                      disabled={!!scenarioRunning}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] hover:bg-slate-800 disabled:opacity-60"
                    >
                      {scenarioRunning === 'out-of-order' ? 'Calisiyor...' : 'Out-of-Order Testi Calistir'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
