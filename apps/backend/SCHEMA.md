# Database Schema

Bu doküman, backend tarafındaki tablo ilişkilerini, unique constraint kurallarını, idempotency yaklaşımını ve concurrency (eşzamanlılık) kararlarını açıklar.

---

# 1) Core Tables

## `User`

Kimlik doğrulama (authentication) için kullanılan ana kullanıcı tablosudur.

### Alanlar:

* `id`
* `email`
* `passwordHash`
* `createdAt`
* `updatedAt`

### Kurallar:

* `email` alanı unique olmalıdır.

### Unique:

```sql
UNIQUE(email)
```

---

## `RefreshToken`

Kullanıcı oturum yenileme (refresh token) kayıtlarını tutar.

### Alanlar:

* `id`
* `userId`
* `tokenHash`
* `expiresAt`
* `createdAt`

### İlişki:

```txt
RefreshToken.userId -> User.id
```

### Kurallar:

* Her token hash tekil olmalıdır.
* Token plaintext yerine hash saklanmalıdır.

### Unique:

```sql
UNIQUE(tokenHash)
```

---

## `Conversation`

Müşteriyle yapılan kanal bazlı konuşmayı temsil eder.

### Alanlar:

* `id`
* `channel` (WhatsApp, Instagram, Messenger vb.)
* `participantId`
* `status`
* `unreadCount`
* `lastMessageAt`
* `lastReadAt`
* `createdAt`
* `updatedAt`

### Kurallar:

* Aynı `channel + participantId` kombinasyonu yalnızca tek bir conversation oluşturabilir.

### Unique:

```sql
UNIQUE(channel, participantId)
```

---

## `Message`

Konuşma içerisindeki tüm inbound/outbound mesajları saklar.

### Alanlar:

* `id`
* `conversationId`
* `channel`
* `clientMessageId`
* `providerMessageId`
* `direction` (`INBOUND` / `OUTBOUND`)
* `status` (`PENDING` / `SENT` / `FAILED` / `PERM_FAILED`)
* `retryCount`
* `lastError`
* `nextRetryAt`
* `createdAt`
* `updatedAt`

### İlişki:

```txt
Message.conversationId -> Conversation.id
```

### Kurallar:

* Outbound idempotency için aynı `clientMessageId` tekrar kullanıldığında duplicate kayıt oluşmaz.

### Unique:

```sql
UNIQUE(channel, clientMessageId)
```

---

## `WebhookEvent`

Webhook event’lerinin idempotent şekilde işlenmesi için kullanılır.

### Alanlar:

* `id`
* `provider`
* `eventId`
* `payload`
* `receivedAt`
* `processedAt`

### Kurallar:

* Aynı provider’dan gelen aynı event yalnızca bir kez işlenebilir.

### Unique:

```sql
UNIQUE(provider, eventId)
```

---

# 2) Relationship Summary

```txt
User (1) -------- (N) RefreshToken

Conversation (1) -------- (N) Message
```

---

# 3) Idempotency Rules

## Inbound Webhook

Webhook duplicate event’lerini önlemek için:

```sql
UNIQUE(provider, eventId)
```

### Davranış:

* Event daha önce işlendi ise:

  * tekrar işlenmez
  * güvenli success response döndürülür
* Böylece provider retry durumlarında duplicate message oluşmaz.

---

## Outbound Send

Mesaj gönderiminde client taraflı idempotency key kullanılır:

```sql
UNIQUE(channel, clientMessageId)
```

### Davranış:

* Aynı istek tekrar gönderilirse:

  * yeni kayıt açılmaz
  * mevcut kayıt döndürülür
* Network timeout durumlarında güvenli retry sağlanır.

---

# 4) Concurrency Decisions

## Webhook Transaction Boundary

Inbound webhook işleme süreci tek transaction içinde çalıştırılır:

### Adımlar:

1. `WebhookEvent` insert
2. `Conversation` upsert
3. INBOUND `Message` insert
4. `Conversation.unreadCount` increment
5. `WebhookEvent.processedAt` update

### Avantajlar:

* Duplicate webhook race condition engellenir
* Veri tutarlılığı korunur
* Mesaj ve conversation state senkron kalır
* Partial failure riski azaltılır

---

## Retry Worker Claiming

Retry worker başarısız mesajları paralel worker çakışması olmadan claim eder.

### Mekanizma:

```sql
FOR UPDATE SKIP LOCKED
UPDATE ... RETURNING
```

### Davranış:

* Claim edilen kayıt geçici olarak lock edilir
* `nextRetryAt` ileri alınır
* Başka worker aynı mesajı alamaz

### Avantajlar:

* Horizontal scaling uyumluluğu
* Duplicate retry engeli
* Güvenli paralel işlem

---

## Retry Policy

### Retryable Hatalar:

* `429` (rate limit)
* `5xx`
* timeout
* network failure

### Non-Retryable:

* Diğer `4xx`
* `PERM_FAILED`

### Kurallar:

* `retryCount` her başarısız denemede artar
* `nextRetryAt` exponential backoff ile güncellenir

### Örnek Backoff:

```txt
1. retry: +1 dk
2. retry: +5 dk
3. retry: +15 dk
4. retry: +1 saat
```

---

# 5) Architectural Notes

## Öneriler:

* `WebhookEvent.payload` için JSONB tercih edilebilir
* `Message.status` için enum kullanılmalı
* `Conversation.lastMessageAt` indexlenmeli
* `nextRetryAt` üzerinde worker performansı için index olmalı
* Soft delete yerine immutable event yaklaşımı tercih edilebilir

---

# 6) Summary

Bu yapı:

* Idempotent
* Race-condition dayanıklı
* Retry-safe
* Horizontal scaling uyumlu
* Production-grade messaging backend mimarisi sağlar.

Özellikle WhatsApp / Instagram / Messenger benzeri çoklu kanal sistemlerinde güvenli, ölçeklenebilir ve tutarlı bir altyapı sunar.
