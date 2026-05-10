/**
 * Полная очистка товаров витрины: SQLite, старые JSON-файлы, индекс медиа.
 * Файлы в uploads/ не удаляются — только записи в media-index.json.
 *
 * Запуск из корня репозитория:
 *   node scripts/clear-all-shelf-listings.cjs
 *
 * Почему не только SQL: server.cjs при пустой БД снова подмешивал data/shelf-listings.json;
 * в room-*.html остаётся демо-вёрстка, но main.js при ответе API с пустым items очищает полки.
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const ROOT = path.resolve(__dirname, "..");
const SQLITE_FILE = path.join(ROOT, "data", "app.db");
const LEGACY_LISTINGS_FILE = path.join(ROOT, "data", "shelf-listings.json");
const LEGACY_REMINDERS_FILE = path.join(ROOT, "data", "reminder-log.json");
const UPLOAD_ROOT = path.resolve(process.env.MEDIA_UPLOAD_ROOT || path.join(ROOT, "uploads"));
const MEDIA_INDEX_FILE = path.join(UPLOAD_ROOT, "media-index.json");

function writeJsonEmpty(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "[]\n", "utf8");
}

const db = new Database(SQLITE_FILE);
db.pragma("journal_mode = WAL");

const listings = db.prepare("DELETE FROM shelf_listings").run();
const reminders = db.prepare("DELETE FROM reminder_log").run();

console.log(`Удалено объявлений (shelf_listings): ${listings.changes}`);
console.log(`Удалено записей напоминаний (reminder_log): ${reminders.changes}`);

db.close();

writeJsonEmpty(LEGACY_LISTINGS_FILE);
writeJsonEmpty(LEGACY_REMINDERS_FILE);
console.log(`Обнулены файлы: data/shelf-listings.json, data/reminder-log.json`);

writeJsonEmpty(MEDIA_INDEX_FILE);
console.log(`Обнулён индекс медиа: ${path.relative(ROOT, MEDIA_INDEX_FILE)}`);
console.log(
  "(Файлы в uploads/ не трогались — удалите вручную при необходимости; в браузере может остаться localStorage «черновиков».)"
);
