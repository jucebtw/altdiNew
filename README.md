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

На чистой БД после деплоя демо-пользователи создаются автоматически ([`scripts/seed-if-empty.ts`](scripts/seed-if-empty.ts) из [`scripts/deploy-on-server.sh`](scripts/deploy-on-server.sh)). Если вход не работает, на сервере: `npx tsx prisma/seed.ts` (полностью пересоздаёт демо-данные).

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

## Деплой (git pull на сервере + GitHub Actions)

Код на VPS лежит в **git clone**; обновление — **`git fetch` + `reset` на `origin`** (не rsync). В [`DEPLOY_PATH`](.github/workflows/deploy.yml) должен быть **репозиторий с `.git`**.

### Один раз на сервере

1. Клонировать репозиторий в каталог деплоя, например:
   ```bash
   git clone git@github.com:USER/REPO.git /var/www/altdi.ru
   ```
   либо по HTTPS (для приватного репо — [Personal Access Token](https://github.com/settings/tokens) или [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) с доступом **read**).
2. Убедиться, что **`git fetch` / `git pull`** работают без запроса пароля (SSH-ключ на сервере или `credential.helper`).

### Что делает GitHub Actions при push в `main`

1. Генерирует **`.env`** из секретов и **копирует** его на сервер (`scp`).
2. По SSH: `git fetch`, `checkout`, **`git reset --hard origin/<ветка>`** (ветка — секрет `DEPLOY_BRANCH`, по умолчанию `main`), затем [`scripts/deploy-on-server.sh`](scripts/deploy-on-server.sh) (Node/pm2, Prisma, сборка, PM2).
3. Если задан **`CERTBOT_EMAIL`**: [`scripts/setup-nginx-ssl.sh`](scripts/setup-nginx-ssl.sh) — Nginx + Let's Encrypt.

### Деплой только с сервера (без Actions)

В корне клона:

```bash
./scripts/server-pull-deploy.sh
```

Или вручную: `DEPLOY_BRANCH=main git pull origin main && ./scripts/deploy-on-server.sh`. Без CI создай **`.env`** по образцу `.env.example`; при деплое через Actions `.env` подставляется из секретов.

### Один раз: секреты в GitHub

**Settings** → **Secrets and variables** → **Actions**:

| Секрет | Обязательно | Описание |
|--------|-------------|----------|
| `SSH_HOST` | да | IP или домен VPS |
| `SSH_USER` | да | пользователь SSH |
| `SSH_PRIVATE_KEY` | да | приватный ключ целиком (`BEGIN … END`) |
| `DEPLOY_PATH` | да | абсолютный путь к **корню git clone** (каталог с `.git`) |
| `AUTH_SECRET` | да | секрет сессий (например `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) |
| `NEXTAUTH_URL` | нет | по умолчанию `https://altdi.ru` |
| `DATABASE_URL` | нет | по умолчанию `file:./prisma/prod.db` (SQLite на сервере) |
| `SSH_PORT` | нет | по умолчанию `22` |
| `DEPLOY_BRANCH` | нет | ветка на сервере, по умолчанию `main` |
| `CERTBOT_EMAIL` | нет | если задан — авто-установка **Nginx + Let's Encrypt** |
| `PUBLIC_DOMAIN` | нет | домен для сертификата, по умолчанию `altdi.ru` |
| `INCLUDE_WWW` | нет | `true` или `1` — добавить `www` (нужна **A-запись** для `www`) |
| `APP_PORT` | нет | порт Next за Nginx, по умолчанию `3000` |

**DNS:** до деплоя **A-запись** домена (и при `INCLUDE_WWW` — для `www`) должна указывать на IP сервера — иначе Certbot не пройдёт проверку.

**Sudo:** пользователь SSH должен уметь выполнять **`sudo` без пароля** для `apt`, `nginx`, `certbot` (часто так на облачных VPS; иначе настройте `/etc/sudoers` под вашего пользователя деплоя).

Если **`CERTBOT_EMAIL` не задан**, шаг Nginx пропускается — приложение доступно по порту PM2 (например `:3000`), HTTPS нужно настроить вручную.

### Каждый деплой через CI

Локально:

```bash
git push origin main
```

Скрипт [`scripts/ensure-toolchain.sh`](scripts/ensure-toolchain.sh) на сервере ставит **Node.js** и **pm2** в `~/.local/share/altdi-ru`. Переменная **`NODE_VERSION`** переопределяет версию Node.

## Безопасность

Периодически обновляйте зависимости, в том числе `next` (`npm info next version`).
