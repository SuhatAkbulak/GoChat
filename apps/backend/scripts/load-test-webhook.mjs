#!/usr/bin/env node

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TOTAL_REQUESTS = Number(process.env.TOTAL_REQUESTS || 5000);
const CONCURRENCY = Number(process.env.CONCURRENCY || 100);
const DUPLICATE_RATE = Number(process.env.DUPLICATE_RATE || 0.0); // 0.0 - 1.0

if (TOTAL_REQUESTS <= 0 || CONCURRENCY <= 0) {
  console.error('TOTAL_REQUESTS ve CONCURRENCY sifirdan buyuk olmali.');
  process.exit(1);
}

const endpoint = `${BACKEND_URL}/webhooks/mock-meta`;
let started = 0;
let completed = 0;
let success = 0;
let failed = 0;
const latencies = [];
const duplicatePool = [];

function randomChannel() {
  return Math.random() < 0.5 ? 'whatsapp' : 'instagram';
}

function nextPayload() {
  const useDuplicate = duplicatePool.length > 0 && Math.random() < DUPLICATE_RATE;
  const eventId = useDuplicate
    ? duplicatePool[Math.floor(Math.random() * duplicatePool.length)]
    : `evt_load_${Date.now()}_${Math.random().toString(16).slice(2, 10)}_${started}`;

  if (!useDuplicate && duplicatePool.length < 500) {
    duplicatePool.push(eventId);
  }

  return {
    eventId,
    channel: randomChannel(),
    from: `user-${Math.floor(Math.random() * 3000)}`,
    text: `load-test-message-${started}`,
    timestamp: new Date().toISOString(),
  };
}

async function fireOne(index) {
  const payload = nextPayload();
  const start = performance.now();

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const latency = performance.now() - start;
    latencies.push(latency);

    if (res.ok) {
      success += 1;
    } else {
      failed += 1;
    }
  } catch {
    const latency = performance.now() - start;
    latencies.push(latency);
    failed += 1;
  } finally {
    completed += 1;
    if (completed % 500 === 0 || completed === TOTAL_REQUESTS) {
      console.log(`Progress: ${completed}/${TOTAL_REQUESTS}`);
    }
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function run() {
  console.log('--- Webhook Load Test ---');
  console.log(`Endpoint      : ${endpoint}`);
  console.log(`Total requests: ${TOTAL_REQUESTS}`);
  console.log(`Concurrency   : ${CONCURRENCY}`);
  console.log(`Duplicate rate: ${DUPLICATE_RATE}`);

  const t0 = performance.now();
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (started < TOTAL_REQUESTS) {
      const current = started;
      started += 1;
      if (current >= TOTAL_REQUESTS) break;
      await fireOne(current);
    }
  });

  await Promise.all(workers);
  const t1 = performance.now();

  const elapsedMs = t1 - t0;
  const elapsedSec = elapsedMs / 1000;
  const sorted = [...latencies].sort((a, b) => a - b);
  const avgLatency =
    latencies.length > 0
      ? latencies.reduce((sum, x) => sum + x, 0) / latencies.length
      : 0;

  console.log('\n--- Result ---');
  console.log(`Completed     : ${completed}`);
  console.log(`Success       : ${success}`);
  console.log(`Failed        : ${failed}`);
  console.log(`Success rate  : ${((success / completed) * 100).toFixed(2)}%`);
  console.log(`Duration      : ${elapsedSec.toFixed(2)}s`);
  console.log(`Throughput    : ${(completed / elapsedSec).toFixed(2)} req/s`);
  console.log(`Avg latency   : ${avgLatency.toFixed(2)} ms`);
  console.log(`P50 latency   : ${percentile(sorted, 50).toFixed(2)} ms`);
  console.log(`P95 latency   : ${percentile(sorted, 95).toFixed(2)} ms`);
  console.log(`P99 latency   : ${percentile(sorted, 99).toFixed(2)} ms`);
}

run().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
