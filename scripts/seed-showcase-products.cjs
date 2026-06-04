/**
 * Добавляет 5 витринных товаров из data/seed-showcase-listings.json в SQLite.
 * Существующие записи с другими product_id не удаляются.
 *
 * node scripts/seed-showcase-products.cjs
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const ROOT = path.resolve(__dirname, "..");
const SQLITE_FILE = path.join(ROOT, "data", "app.db");
const SEED_FILE = path.join(ROOT, "data", "seed-showcase-listings.json");

const db = new Database(SQLITE_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS shelf_listings (
    id TEXT PRIMARY KEY,
    product_id TEXT UNIQUE NOT NULL,
    room_slug TEXT NOT NULL,
    tier TEXT NOT NULL,
    width_tier TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    status TEXT NOT NULL,
    dynamic_rank_score REAL NOT NULL DEFAULT 0,
    owner_user_id TEXT NOT NULL DEFAULT '',
    product_json TEXT NOT NULL,
    last_reminder_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const raw = fs.readFileSync(SEED_FILE, "utf8");
const items = JSON.parse(raw);
if (!Array.isArray(items) || !items.length) {
  console.error("Пустой seed-showcase-listings.json");
  process.exit(1);
}

const endsAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
const startsAt = new Date().toISOString();

const upsert = db.prepare(`
  INSERT INTO shelf_listings
  (id, product_id, room_slug, tier, width_tier, starts_at, ends_at, status, dynamic_rank_score, owner_user_id, product_json, last_reminder_at, created_at, updated_at)
  VALUES (@id, @product_id, @room_slug, @tier, @width_tier, @starts_at, @ends_at, @status, @dynamic_rank_score, @owner_user_id, @product_json, @last_reminder_at, @created_at, @updated_at)
  ON CONFLICT(product_id) DO UPDATE SET
    room_slug = excluded.room_slug,
    tier = excluded.tier,
    width_tier = excluded.width_tier,
    ends_at = excluded.ends_at,
    status = excluded.status,
    dynamic_rank_score = excluded.dynamic_rank_score,
    product_json = excluded.product_json,
    updated_at = excluded.updated_at
`);

const tx = db.transaction((rows) => {
  rows.forEach((it) => {
    const product = it.product || {};
    const now = new Date().toISOString();
    upsert.run({
      id: it.id || `lst-${crypto.randomUUID()}`,
      product_id: it.productId || product.id,
      room_slug: it.roomSlug,
      tier: it.tier || "middle",
      width_tier: it.widthTier || "standard",
      starts_at: it.startsAt || startsAt,
      ends_at: it.endsAt || endsAt,
      status: it.status || "active",
      dynamic_rank_score: Number(it.dynamicRankScore || 0),
      owner_user_id: String(it.ownerUserId || "altay-vitrin@yandex.ru").toLowerCase(),
      product_json: JSON.stringify(product),
      last_reminder_at: "",
      created_at: it.createdAt || now,
      updated_at: now,
    });
  });
});

tx(items);
db.close();

console.log(`Добавлено/обновлено товаров: ${items.length}`);
items.forEach((it) => {
  const p = it.product || {};
  console.log(`  · ${p.name} — ${it.roomSlug}, ${p.price} ₽`);
});
