/**
 * Схема «nginx → 3000 (Next.js)»: ВК бьёт в https://домен/api/vk/callback,
 * отвечает Next — добавьте этот маршрут, чтобы Next переслал тело запроса на server.cjs.
 *
 * Куда положить в проекте Next:
 *   src/app/api/vk/callback/route.ts
 *
 * В .env у Next.js (на сервере, пересборка после изменения):
 *   MEDIA_SERVER_URL=http://127.0.0.1:8765
 *
 * Отдельно запущенный server.cjs (pm2), например:
 *   PORT=8765 pm2 start server.cjs --name altdi-api
 *
 * В .env процесса server.cjs: VK_BOT_TOKEN, VK_CALLBACK_CONFIRMATION, VK_CALLBACK_SECRET.
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
