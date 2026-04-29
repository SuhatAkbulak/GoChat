"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import { useInbox } from "@/components/inbox-provider";
import { api } from "@/lib/api";
import { mergeMessages } from "@/lib/inbox-message-utils";
import { randomClientMessageId } from "@/lib/random-id";

/** Liste tepesine yaklasinca onceki sayfa mesajlari yuklenir */
const SCROLL_LOAD_OLDER_PX = 120;

function withTestTimestamp(baseText) {
  const stamp = new Date().toLocaleString('tr-TR', {
    hour12: false,
  });
  return `${baseText} [test-zaman:${stamp}]`;
}

export function DashboardPage() {
  const {
    conversations,
    setConversations,
    selectedId,
    setSelectedId,
    messages,
    setMessages,
    loadingMessages,
    loadingOlderMessages,
    hasMoreOlderMessages,
    loadOlderMessages,
    loadConversations,
    selectedConversation,
    orderedMessages,
    error,
    setError,
  } = useInbox();

  const [text, setText] = useState('');
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
  const [scenarioPanels, setScenarioPanels] = useState({
    normalSend: true,
    duplicateWebhook: false,
    outOfOrderWebhook: false,
  });
  const messagesContainerRef = useRef(null);
  /** Eski mesaj prepend sonrasi otomatik alta kaydirmayi tek seferlik iptal eder */
  const suppressNextScrollToBottomRef = useRef(false);

  const mockUserOptions = useMemo(() => {
    const seededUsers = ['user-123', 'user-456', 'user-789', 'test-user-1', 'test-user-2'];
    const fromConversations = conversations
      .map((item) => item.participantId)
      .filter((item) => typeof item === 'string' && item.trim().length > 0);

    return Array.from(new Set([...seededUsers, ...fromConversations]));
  }, [conversations]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (suppressNextScrollToBottomRef.current) {
      suppressNextScrollToBottomRef.current = false;
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [orderedMessages, selectedId]);

  const handleMessagesScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      if (el.scrollTop > SCROLL_LOAD_OLDER_PX) return;
      if (loadingMessages || loadingOlderMessages || !hasMoreOlderMessages) return;

      const prevScrollHeight = el.scrollHeight;
      const prevScrollTop = el.scrollTop;

      suppressNextScrollToBottomRef.current = true;
      void loadOlderMessages().then((didLoadOlder) => {
        if (!didLoadOlder) {
          suppressNextScrollToBottomRef.current = false;
          return;
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const node = messagesContainerRef.current;
            if (!node) return;
            node.scrollTop = prevScrollTop + (node.scrollHeight - prevScrollHeight);
          });
        });
      });
    },
    [
      loadingMessages,
      loadingOlderMessages,
      hasMoreOlderMessages,
      loadOlderMessages,
    ],
  );

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

  async function onSend(e) {
    e.preventDefault();
    if (!selectedConversation || !text.trim()) return;
    const sentText = text.trim();
    const response = await api.sendMessage({
      channel: selectedConversation.channel,
      to: selectedConversation.participantId,
      text: sentText,
      clientMessageId: randomClientMessageId(),
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
      clientMessageId: randomClientMessageId(),
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 text-slate-100 md:flex-row md:items-stretch">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-950">
        <header className="shrink-0 border-b border-slate-800 p-4">
          <h2 className="min-w-0 font-semibold text-slate-100">
            {selectedConversation ? selectedConversation.participantId : 'Konusma secin'}
          </h2>
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <section
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-950 p-4"
        >
          {loadingOlderMessages ? (
            <div className="py-2 text-center text-xs text-slate-400">
              Eski mesajlar yukleniyor...
            </div>
          ) : null}
          {!loadingOlderMessages &&
          !hasMoreOlderMessages &&
          orderedMessages.length > 0 &&
          !loadingMessages ? (
            <div className="py-1 text-center text-[11px] text-slate-500">
              Konuşmanın Başına Ulaşıldı
            </div>
          ) : null}
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

        <form onSubmit={onSend} className="shrink-0 border-t border-slate-800 bg-slate-950 p-4">
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
        </div>
      </main>

      <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-slate-800 bg-slate-900 p-4 md:max-h-none md:w-[340px] md:min-w-[280px] md:border-l">
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Mock Provider Config</h3>
            {mockConfigLoading ? <span className="text-[11px] text-slate-400">Yukleniyor...</span> : null}
          </div>
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
            <p className="text-[11px] font-semibold text-slate-300">Test menusu</p>
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
