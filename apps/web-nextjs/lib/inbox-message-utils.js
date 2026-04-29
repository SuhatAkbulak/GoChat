export function getMessageKey(message) {
  return message.id || message.messageId;
}

export function mergeMessages(prev, incoming) {
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
      text: raw.text ?? existing?.text ?? "",
      direction: raw.direction ?? existing?.direction,
      createdAt: raw.createdAt ?? existing?.createdAt,
      status: raw.status ?? existing?.status,
    };
    map.set(key, normalized);
  }

  return Array.from(map.values());
}
