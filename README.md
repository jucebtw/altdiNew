# altdi.ru

Продакшен-сайт: **[https://altdi.ru](https://altdi.ru)** — маркетплейс предметов интерьера и декора ручной работы от локальных дизайнеров и мастерских.

Стек: **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma + SQLite**, **NextAuth.js** (Credentials + JWT).

## Требования

- Node.js 20+
- npm

## Установка и запуск (локально)

Из корня репозитория:

```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Переменные окружения: скопируйте `.env.example` в `.env`. Для локалки в `NEXTAUTH_URL` укажите `http://localhost:3000`. Для продакшена на **altdi.ru**:

```env
NEXTAUTH_URL="https://altdi.ru"
```

Сгенерируйте свой `AUTH_SECRET`, например:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Демо-аккаунты (пароль у всех одинаковый)

| Роль       | Email              | Пароль     |
|------------|-------------------|------------|
| Покупатель | `buyer@altdi.ru`  | `Demo123!` |
| Продавец   | `maria@altdi.ru`  | `Demo123!` |
| Продавец 2 | `ogon@altdi.ru`   | `Demo123!` |
| Админ      | `admin@altdi.ru`  | `Demo123!` |

## Возможности

- **Витрина**: главная, каталог с фильтром по категориям, быстрый просмотр товара (модалка), корзина, оформление заказа (сохранение в БД).
- **Гости**: корзина в cookie-сессии; после входа корзина переносится на аккаунт.
- **Дизайнеры**: список и страница профиля `/designers/[slug]`.
- **Продавец** (`/seller/dashboard`, `/seller/products/new`): добавление товара (модерация `PENDING`).
- **Админ** (`/admin/dashboard`): метрики, модерация товаров и заявок дизайнеров.

## Скрипты

- `npm run dev` — разработка (Turbopack)
- `npm run build` / `npm run start` — продакшен-сборка
- `npm run db:studio` — Prisma Studio
- `npm run db:seed` — повторный сид данных

## Структура

- `src/app/(marketing)/` — публичные страницы
- `src/app/seller/` — кабинет продавца
- `src/app/admin/` — админ-панель
- `src/app/actions/` — server actions (корзина, модерация, товары)
- `prisma/schema.prisma` — схема БД
- `prisma/seed.ts` — демо-данные

## Деплой (VPS + GitHub Actions)

Репозиторий на GitHub, ветка `main`: при push запускается [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — `rsync` на сервер и [`scripts/deploy-on-server.sh`](scripts/deploy-on-server.sh) (сборка, `prisma db push`, перезапуск PM2).

**Секреты** (Settings → Secrets and variables → Actions): `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH` (например `/var/www/altdi.ru`). Опционально `SSH_PORT`.

**Сервер (Ubuntu 24.04):** пользователь с SSH и каталог `DEPLOY_PATH`. Скрипт [`scripts/ensure-toolchain.sh`](scripts/ensure-toolchain.sh) ставит **Node.js** и **pm2** в `~/.local/share/altdi-ru`. При отсутствии `curl`/`wget` и при **безпарольном sudo** подтянется `curl` через `apt`.

В `DEPLOY_PATH` лежит `.env`: `NEXTAUTH_URL=https://altdi.ru`, `AUTH_SECRET`, `DATABASE_URL` (SQLite). Перед приложением — reverse proxy (Nginx/Caddy) на порт процесса (по умолчанию `3000`, см. `ecosystem.config.cjs`).

Версию Node для bootstrap можно задать переменной `NODE_VERSION` перед деплоем.

## Безопасность

Периодически обновляйте зависимости, в том числе `next` (`npm info next version`).
