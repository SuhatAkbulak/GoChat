import { NextResponse } from "next/server";

export const runtime = "nodejs";

function backendBase() {
  return (
    process.env.BACKEND_PROXY_TARGET?.trim() ||
    process.env.INTERNAL_API_URL?.trim() ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

/** Next surumune gore params.path bazen bos gelebilir; URL'den yol kirpilir */
async function resolveSegments(req, routeCtx) {
  let rawParams = routeCtx.params;
  if (typeof rawParams?.then === "function") {
    rawParams = await rawParams;
  }

  const fromCatchAll = rawParams?.path;
  if (Array.isArray(fromCatchAll) && fromCatchAll.length > 0) {
    return fromCatchAll;
  }
  if (typeof fromCatchAll === "string" && fromCatchAll.length > 0) {
    return [fromCatchAll];
  }

  const pathname = new URL(req.url).pathname;
  return pathname
    .replace(/^\/api-proxy\/?/i, "")
    .split("/")
    .filter(Boolean);
}

/**
 * Tarayıcıdan gelen /api-proxy/* isteklerini Nest REST'e iletir.
 */
async function proxy(req, routeCtx) {
  const segments = await resolveSegments(req, routeCtx);
  if (segments.length === 0) {
    return NextResponse.json({ error: "Eksik yol" }, { status: 400 });
  }

  const pathStr = segments.join("/");
  const inbound = new URL(req.url);
  const targetUrl = `${backendBase()}/${pathStr}${inbound.search}`;

  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("Authorization", auth);
  const ct = req.headers.get("content-type");
  if (ct) headers.set("Content-Type", ct);

  const init = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    init.body = await req.arrayBuffer();
  }

  let res;
  try {
    res = await fetch(targetUrl, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "Nest backend'e baglanilamadi",
        backendUrl: backendBase(),
        detail: msg,
      },
      { status: 502 },
    );
  }

  const out = new Headers();
  const outCt = res.headers.get("content-type");
  if (outCt) out.set("content-type", outCt);

  return new NextResponse(res.body, { status: res.status, headers: out });
}

export async function GET(req, ctx) {
  return proxy(req, ctx);
}

export async function POST(req, ctx) {
  return proxy(req, ctx);
}

export async function PATCH(req, ctx) {
  return proxy(req, ctx);
}

export async function PUT(req, ctx) {
  return proxy(req, ctx);
}

export async function DELETE(req, ctx) {
  return proxy(req, ctx);
}
