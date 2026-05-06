/**
 * Если сайт на Next.js, ВК шлёт POST на https://altdi.ru/api/vk/callback —
 * по умолчанию отвечает Next.js (404/HTML), а не server.cjs → «Invalid response code».
 *
 * Вариант A (предпочтительно): в nginx проксировать только этот путь на процесс server.cjs
 *   см. doc/nginx-vk-callback-snippet.conf
 *
 * Вариант B: положите этот файл как:
 *   src/app/api/vk/callback/route.ts
 * В .env на сервере у Next.js добавьте:
 *   MEDIA_SERVER_URL=http://127.0.0.1:8765
 * И держите второй процесс: pm2 start server.cjs на порту 8765 (или как у вас настроено).
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
