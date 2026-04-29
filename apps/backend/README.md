# Backend

NestJS backend case implementasyonu bu klasorde gelistirilecektir.

## Run

```bash
npm run start:dev
```

Swagger:

- `http://localhost:3000/api`

## Test

- E2E:
  - `npm run test:e2e -- --runInBand`
- Smoke:
  - `./scripts/smoke-test.sh`
- Webhook load test:
  - `npm run test:load:webhook`

## Prisma Notlari
 
- Hızlı komutlar:
  - `npm run prisma:generate`
  - `npm run prisma:migrate:dev -- --name <migration_adi>`

## Dokumantasyon

- DB iliski ve concurrency kararlari: `SCHEMA.md`
