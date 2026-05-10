/**
 * Удаляет все записи о товарах на полках (таблица shelf_listings) и лог напоминаний.
 * Запуск на сервере из корня репозитория:
 *   node scripts/clear-all-shelf-listings.cjs
 *
 * Файлы в uploads/ не трогаются — при необходимости очистите вручную или дождитесь job по lease.
 */
const path = require("path");
const Database = require("better-sqlite3");

const ROOT = path.resolve(__dirname, "..");
const SQLITE_FILE = path.join(ROOT, "data", "app.db");

const db = new Database(SQLITE_FILE);
db.pragma("journal_mode = WAL");

const listings = db.prepare("DELETE FROM shelf_listings").run();
const reminders = db.prepare("DELETE FROM reminder_log").run();

console.log(`Удалено объявлений (shelf_listings): ${listings.changes}`);
console.log(`Удалено записей напоминаний (reminder_log): ${reminders.changes}`);

db.close();
