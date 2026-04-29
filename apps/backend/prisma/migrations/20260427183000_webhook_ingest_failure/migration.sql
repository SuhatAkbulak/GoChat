-- CreateTable
CREATE TABLE "WebhookIngestFailure" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookIngestFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookIngestFailure_provider_eventId_idx" ON "WebhookIngestFailure"("provider", "eventId");

-- CreateIndex
CREATE INDEX "WebhookIngestFailure_createdAt_idx" ON "WebhookIngestFailure"("createdAt");
