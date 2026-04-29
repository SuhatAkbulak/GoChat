# Omnichannel Messaging Monorepo

<div align="right">
  <a href="README.md">🇬🇧 English</a>
</div>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-flat&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-flat&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-flat&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-flat&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/RabbitMQ-FF6600?style=for-flat&logo=rabbitmq&logoColor=white" alt="RabbitMQ" />
  <img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-flat&logo=docker&logoColor=white" alt="Docker" />
</p>

Bu depo, çok kanallı (omnichannel) mesajlaşma ve webhook yönetim süreçleri için tasarlanmış, `npm workspaces` altyapısı kullanılarak yapılandırılmış kapsamlı bir monorepo mimarisini içermektedir. Monorepo içermesinin sebebi ise projeleri tek bir depo üzerinden yönetebilmek ve geliştirme süreçlerini kolaylaştırmaktır. 

<p align="center">
  <img src="./docs/Topografi.webp" alt="Omnichannel Topolojisi" width="100%" />
</p>

## Proje Mimarisi ve Bileşenler

Proje, `apps/` dizini altında yer alan temel mikro-uygulamalardan oluşmaktadır:

- **`apps/backend`**: Sistemin ana API servisidir. NestJS framework'ü ile geliştirilmiş olup, veri yönetimi için PostgreSQL ve asenkron işlem kuyruğu için RabbitMQ entegrasyonlarına sahiptir.
- **`apps/web-nextjs`**: Modern web mimarisi standartlarına uygun olarak Next.js ile geliştirilmiş birincil kullanıcı arayüzüdür.
- **`apps/mock-meta-provider`**: Vaka gereksinimleri doğrultusunda, üçüncü parti servis (örn. Meta) isteklerini simüle etmek amacıyla geliştirilmiş test veri sağlayıcısıdır.

---

## Kurulum ve Başlatma Süreçleri

Projeyi lokal ortamda çalıştırmak için aşağıdaki adımları izleyebilirsiniz. 

Öncelikle tüm proje bağımlılıklarının kurulması gerekmektedir:
```bash
npm run bootstrap
```
Bu komut tüm workspace'lerdeki bağımlılıklarını ortak alana kurar; bu sayede tekrar eden node modülleri sürekli indirilmez ve gereksiz disk alanı kullanımı engellenir.

### Geliştirme (Development) Ortamı
Geliştirme süreçlerinde kolaylık sağlamak amacıyla, tüm temel servisleri (backend, web-nextjs ve mock provider) eş zamanlı ve hot-reload destekli başlatmak için tek bir komut yeterlidir:

```bash
npm run dev
```

*(Belirli bir servisi izole olarak çalıştırmak isterseniz sırasıyla `npm run dev:backend`, `npm run dev:web-next` komutlarını tercih edebilirsiniz.) Mock akışı `npm run dev:mock` servisinden gelecektir. İlk bu servisi çalıştırmanız tavsiye edilir.*

### Docker Üzerinden Tam Otomatik Kurulum
Projenin PostgreSQL, RabbitMQ ve diğer tüm bileşenleriyle birlikte izole bir Docker ağında ayağa kaldırılması için:

```bash
npm run up
```
Mevcut konteynerleri durdurmak ve kaynakları serbest bırakmak için `npm run down` komutunu kullanabilirsiniz.

### İmaj Derleme ve Docker Hub Dağıtımı (Build & Push)
CI/CD süreçlerini veya manuel imaj dağıtımlarını hızlandırmak adına `package.json` içerisine entegre edilmiş betikler bulunmaktadır:

- **Tüm imajları derlemek için:** `npm run docker:build:all`
- **Derlenen imajları Docker Hub'a yüklemek için:** `npm run docker:push:all`

---

## Servis Erişim Noktaları

Uygulamalar başlatıldıktan sonra ilgili servislere aşağıdaki adresler üzerinden erişim sağlanabilir:

- **Backend API:** `http://localhost:3000`
- **Swagger API Dokümantasyonu:** `http://localhost:3000/api`
- **Next.js Arayüzü (Ana Frontend):** `http://localhost:5180`
- **Nginx Proxy Manager:** `http://localhost:81`
- **Mock Provider API:** `http://localhost:4000`
- **RabbitMQ Yönetim Paneli:** `http://localhost:15672` *(Kullanıcı: admin / Şifre: test_rabbitmq_pass_xyz)*

---

## Kalite Güvencesi ve Testler

Sistemin kararlılığını ve performansını doğrulamak için aşağıdaki test prosedürleri yapılandırılmıştır:

- **Uçtan Uca (E2E) Testleri:**  
  `npm run test -w @sempeak/backend`
  
- **Duman (Smoke) Testleri:**  
  `./apps/backend/scripts/smoke-test.sh`
  
- **Webhook Yük (Load) Testi:** *(5000+ eş zamanlı webhook isteğinin işlenme kapasitesini ölçer)*  
  > ⚠️ **Not:** Testin mevcut verilerinizi etkilememesi adına farklı bir izole veritabanında çalıştırılması şiddetle önerilir. Test ortamı yapılandırması için `apps/backend` dizinindeki `docker-compose-test.yml` dosyasında yer alan `DATABASE_URL` değişkenini oluşturduğunuz test veritabanınıza göre güncelleyebilirsiniz.
  
  ```bash
  npm run test:load:webhook -w @sempeak/backend
  ```

  <details>
  <summary><b>Performans Özeti (5000 İstek)</b></summary>
  
  NestJS mimarisi ve asenkron mesaj kuyruğu yapısı sayesinde, 3. parti kanallardan gelen **5000** adet webhook mesajı (**100 eşzamanlılık/concurrency**) hiçbir kayıp yaşanmadan (%100 başarı) saniyeler içinde işlenmiştir. Sistem ortalama **40ms gecikme** ile saniyede **~2400 istek (throughput)** karşılama performansına ulaşmıştır.

  ```text
  --- Result ---
  Completed     : 5000
  Success       : 5000
  Failed        : 0
  Success rate  : 100.00%
  Duration      : 2.09s
  Throughput    : 2396.59 req/s
  Avg latency   : 40.41 ms
  P50 latency   : 23.16 ms
  P95 latency   : 35.20 ms
  P99 latency   : 876.08 ms
  ```
  </details>

---

## Gelecek Geliştirmeler (Roadmap & To-Do)

Projenin bir sonraki aşamasında, gerçek bir üretim (production) ortamı düşünülerek aşağıdaki özelliklerin eklenmesi planlanmaktadır:

- [x] **Güvenli Mesaj Geçmişi ve Sayfalama (Pagination):** Yüksek hacimli geçmiş mesajların arayüz (UI) tarafında sisteme yük bindirmeden, güvenli ve performanslı bir şekilde sayfalama mantığıyla (pagination) sunulması.
- [ ] **Gelişmiş Retry & Dead Letter Queue (DLQ) Yönetimi:** Otomatik deneme limiti (örn. 3 kez) dolduğu için `FAILED` statüsüne düşen hatalı mesajların izole edilmesi ve yöneticiler tarafından arayüz üzerinden tek tıkla tekrar gönderilmesi.
- [ ] **Monitoring & Observability:** Sistemdeki darboğazları ve mesaj kuyruk istatistiklerini anlık izlemek için **Prometheus ve Grafana** entegrasyonu.
- [ ] **Multi-Tenant (Çoklu Müşteri) Altyapısı:** Sistemin tek bir marka yerine, aynı veritabanı üzerinde izole bir şekilde birden fazla marka veya departman (Tenant) için hizmet verebilecek şekilde (SaaS) genişletilmesi.
- [ ] **Departman Bazlı Akıllı Yönlendirme & Lead Yönetimi:** Gelen mesajların içeriklerine göre ilgili departmanlardaki temsilcilere otomatik yönlendirilmesi ve bu konuşmaların birer potansiyel müşteri (Lead) yapısına dönüştürülmesi.
- [ ] **Müşteri İlişkileri Yönetimi (CRM) Alanı:** Webhook'lardan gelen kullanıcıların bilgilerinin ayrı bir "Müşteriler" modülünde toplanarak geçmiş konuşmaların tek ekrandan yönetilebilmesi.
- [ ] **Spam Koruması ve Mesaj Tekilleştirme (Deduplication):** Aynı kullanıcıdan kısa süre içinde peş peşe gelen tekrar eden veya anlamsız (spam) mesajların tespit edilip kuyruğa alınmadan filtrelenmesi (Redis & Rate Limiting).
- [ ] **Mesai Dışı AI/NLP Chatbot Entegrasyonu:** Çalışma saatleri dışında gelen müşteri mesajlarının Doğal Dil İşleme (NLP) yeteneğine sahip bir yapay zeka asistanı tarafından karşılanıp otomatik olarak yanıtlanması.