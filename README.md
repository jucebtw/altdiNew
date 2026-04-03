# Atelier Local — маркетплейс декора

Full-stack учебный проект: витрина предметов интерьера ручной работы от локальных дизайнеров и мастерских. **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Prisma + SQLite**, **NextAuth.js (Credentials + JWT)**.

## Требования

- Node.js 20+
- npm

## Установка и запуск

```bash
cd "C:\Users\pavel\OneDrive\Рабочий стол\CursorTests\SiteGovna"
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

Переменные окружения: скопируйте `.env.example` в `.env` (в репозитории уже есть `.env` для локальной разработки). Для продакшена сгенерируйте новый `AUTH_SECRET`, например:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Демо-аккаунты (пароль у всех одинаковый)

| Роль    | Email               | Пароль    |
|---------|---------------------|-----------|
| Покупатель | `buyer@atelier.local`   | `Demo123!` |
| Продавец   | `maria@atelier.local`   | `Demo123!` |
| Продавец 2 | `ogon@atelier.local`    | `Demo123!` |
| Админ      | `admin@atelier.local`   | `Demo123!` |

## Возможности

- **Витрина**: главная, каталог с фильтром по категориям, быстрый просмотр товара (модалка), корзина, оформление заказа (сохранение в БД).
- **Гости**: корзина в cookie-сессии; после входа корзина переносится на аккаунт.
- **Дизайнеры**: список и страница профиля `/designers/[slug]`.
- **Продавец** (`/seller/dashboard`, `/seller/products/new`): добавление товара (уходит на модерацию `PENDING`).
- **Админ** (`/admin/dashboard`): метрики, модерация товаров и заявок дизайнеров.

## Скрипты

- `npm run dev` — разработка (Turbopack)
- `npm run build` / `npm run start` — продакшен-сборка
- `npm run db:studio` — Prisma Studio для просмотра БД
- `npm run db:seed` — повторный сид данных

## Структура

- `src/app/(marketing)/` — публичные страницы
- `src/app/seller/` — кабинет продавца
- `src/app/admin/` — админ-панель
- `src/app/actions/` — server actions (корзина, модерация, товары)
- `prisma/schema.prisma` — схема БД
- `prisma/seed.ts` — демо-данные

## Автодеплой (VPS + GitHub Actions)

Репозиторий на GitHub, ветка `main`: при push срабатывает [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — `rsync` на сервер и `./scripts/deploy-on-server.sh` (сборка, `prisma db push`, перезапуск PM2).

**Секреты** (Settings → Secrets and variables → Actions): `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH` (например `/var/www/atelier-local`). Опционально `SSH_PORT`.

**На сервере (Ubuntu 24.04):** достаточно пользователя с SSH и каталога `DEPLOY_PATH`. При деплое скрипт [`scripts/ensure-toolchain.sh`](scripts/ensure-toolchain.sh) сам ставит **Node.js** и **pm2** в `~/.local/share/atelier-marketplace` (без системного Node из apt). Если нет `curl`/`wget`, при **безпарольном sudo** для пользователя деплоя один раз подтянется `curl` через `apt`.

В `DEPLOY_PATH` положите `.env` (из `.env.example`: `NEXTAUTH_URL=https://ваш-домен`, `AUTH_SECRET`, `DATABASE_URL` для SQLite). Перед сервером — reverse proxy (Nginx/Caddy) на порт приложения (по умолчанию `3000` в `ecosystem.config.cjs`).

Версию Node для скачивания можно переопределить: `NODE_VERSION=20.19.0` в переменных окружения перед деплоем.

## Примечание по безопасности

Используемая версия Next.js при первой установке может иметь известные уязвимости; для деплоя обновите `next` до актуального патча (`npm info next version`).
