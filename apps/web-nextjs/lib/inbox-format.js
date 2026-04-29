/** Konuşma satırında saat gösterimi (Dashboard ile uyumlu). */
export function formatConversationListTime(value) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Kanal etiketi (Inbox satırı için). */
export function formatChannelLabel(channel) {
  const c = (channel || "").toLowerCase();
  if (c === "whatsapp") return "WhatsApp";
  if (c === "instagram") return "Instagram";
  return channel || "Kanal";
}
