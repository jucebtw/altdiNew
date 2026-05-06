/**
 * Прокси Callback ВК → server.cjs (см. doc/vk-callback-setup.txt).
 * Next .env: MEDIA_SERVER_URL=http://127.0.0.1:8765
 * pm2: отдельный процесс server.cjs с PORT=8765 и VK_* в его .env
 */
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const base = (process.env.MEDIA_SERVER_URL || "http://127.0.0.1:8765").replace(/\/+$/, "");
  const bodyText = await req.text();

  const upstream = await fetch(`${base}/api/vk/callback`, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("content-type") || "application/json",
    },
    body: bodyText,
  });

  const text = await upstream.text();
  const ct = upstream.headers.get("content-type") || "text/plain; charset=utf-8";

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": ct },
  });
}
