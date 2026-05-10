/* Локальная отдача статики + media API: node server.cjs */
const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const Busboy = require("busboy");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");

const PORT = Number(process.env.PORT || 8765);
const ROOT = path.resolve(__dirname);
const UPLOAD_ROOT = path.resolve(process.env.MEDIA_UPLOAD_ROOT || path.join(ROOT, "uploads"));
const MEDIA_INDEX_FILE = path.join(UPLOAD_ROOT, "media-index.json");
const SQLITE_FILE = path.join(ROOT, "data", "app.db");
const LEGACY_LISTINGS_FILE = path.join(ROOT, "data", "shelf-listings.json");
const LEGACY_REMINDERS_FILE = path.join(ROOT, "data", "reminder-log.json");
const MAX_FILES = 10;
const MAX_SELLER_PORTFOLIO_FILES = 8;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const VIDEO_EXT = new Set([".mp4"]);
const OWNER_TYPES = new Set(["designers", "masters"]);
const CATEGORIES = new Set(["lighting", "texture", "decor", "furniture"]);
const VK_CODE_TTL_MS = 10 * 60 * 1000;

let db = null;

ffmpeg.setFfmpegPath(ffmpegPath);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

function underRoot(f) {
  const r = path.resolve(f);
  return r === ROOT || r.startsWith(ROOT + path.sep);
}

function underUploadRoot(f) {
  const r = path.resolve(f);
  return r === UPLOAD_ROOT || r.startsWith(UPLOAD_ROOT + path.sep);
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function toRoomSlug(category) {
  const safe = getSafeCategory(category);
  return safe;
}

function roomSlugFromPath(pathname) {
  if (pathname.includes("room-lighting")) return "lighting";
  if (pathname.includes("room-texture")) return "texture";
  if (pathname.includes("room-decor")) return "decor";
  if (pathname.includes("room-furniture")) return "furniture";
  return "";
}

function tierFromClient(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "tier-top" || v === "top") return "top";
  if (v === "tier-low" || v === "bottom") return "bottom";
  return "middle";
}

function widthFromClient(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "width-wide" || v === "wide") return "wide";
  if (v === "width-narrow" || v === "narrow") return "narrow";
  return "standard";
}

function tierToClient(value) {
  if (value === "top") return "tier-top";
  if (value === "bottom") return "tier-low";
  return "tier-mid";
}

function widthToClient(value) {
  if (value === "wide") return "width-wide";
  if (value === "narrow") return "width-narrow";
  return "width-standard";
}

function normalizeToken(value, fallback) {
  const norm = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "");
  return norm || fallback;
}

function getSafeOwnerType(value) {
  const ownerType = normalizeToken(value, "designers");
  return OWNER_TYPES.has(ownerType) ? ownerType : "designers";
}

function getSafeCategory(value) {
  const map = {
    light: "lighting",
    lighting: "lighting",
    texture: "texture",
    decor: "decor",
    furniture: "furniture",
  };
  const normalized = normalizeToken(value, "decor");
  const category = map[normalized] || normalized;
  return CATEGORIES.has(category) ? category : "decor";
}

function parseLeaseEndsAt(raw) {
  const ts = Date.parse(String(raw || ""));
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toISOString();
}

function toDeleteAfter(leaseEndsAtIso) {
  if (!leaseEndsAtIso) return "";
  const ts = Date.parse(leaseEndsAtIso);
  if (!Number.isFinite(ts)) return "";
  return new Date(ts + 24 * 60 * 60 * 1000).toISOString();
}

function relUrl(absolutePath) {
  const rel = path.relative(ROOT, absolutePath).replace(/\\/g, "/");
  return "/" + rel;
}

async function ensureUploadRoot() {
  await fsp.mkdir(UPLOAD_ROOT, { recursive: true });
  if (!(await exists(MEDIA_INDEX_FILE))) {
    await fsp.writeFile(MEDIA_INDEX_FILE, "[]", "utf8");
  }
}

async function ensureDataFiles() {
  const dataDir = path.dirname(SQLITE_FILE);
  await fsp.mkdir(dataDir, { recursive: true });
  if (!db) {
    db = new Database(SQLITE_FILE);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
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
    CREATE TABLE IF NOT EXISTS reminder_log (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      owner_user_id TEXT NOT NULL DEFAULT '',
      product_name TEXT NOT NULL DEFAULT '',
      room_slug TEXT NOT NULL DEFAULT '',
      sent_at TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vk_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      vk_handle TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      vk_handle TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shelf_listings_room_status ON shelf_listings(room_slug, status, ends_at);
    CREATE INDEX IF NOT EXISTS idx_shelf_listings_owner ON shelf_listings(owner_user_id, status);
    CREATE INDEX IF NOT EXISTS idx_vk_codes_lookup ON vk_codes(email, vk_handle, used_at, expires_at);
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const existingCount = db.prepare("SELECT COUNT(*) AS n FROM shelf_listings").get().n;
  const metaRow = db.prepare("SELECT value FROM app_meta WHERE key = ?").get("legacy_shelf_json_v1");
  const legacyImportDone = metaRow && String(metaRow.value) === "1";
  if (existingCount > 0) {
    if (!legacyImportDone) {
      db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('legacy_shelf_json_v1', '1')").run();
    }
  } else if (!legacyImportDone) {
    await migrateLegacyJsonIfExists();
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('legacy_shelf_json_v1', '1')").run();
  }
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readMediaIndex() {
  try {
    const raw = await fsp.readFile(MEDIA_INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeMediaIndex(records) {
  await fsp.writeFile(MEDIA_INDEX_FILE, JSON.stringify(records, null, 2), "utf8");
}

function rowToListing(row) {
  return {
    id: row.id,
    productId: row.product_id,
    roomSlug: row.room_slug,
    tier: row.tier,
    widthTier: row.width_tier,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    dynamicRankScore: Number(row.dynamic_rank_score || 0),
    ownerUserId: row.owner_user_id || "",
    product: JSON.parse(row.product_json || "{}"),
    lastReminderAt: row.last_reminder_at || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function migrateLegacyJsonIfExists() {
  if (!(await exists(LEGACY_LISTINGS_FILE))) return;
  try {
    const raw = await fsp.readFile(LEGACY_LISTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return;
    const ins = db.prepare(`
      INSERT OR REPLACE INTO shelf_listings
      (id, product_id, room_slug, tier, width_tier, starts_at, ends_at, status, dynamic_rank_score, owner_user_id, product_json, last_reminder_at, created_at, updated_at)
      VALUES (@id, @product_id, @room_slug, @tier, @width_tier, @starts_at, @ends_at, @status, @dynamic_rank_score, @owner_user_id, @product_json, @last_reminder_at, @created_at, @updated_at)
    `);
    const tx = db.transaction((rows) => {
      rows.forEach((it) => {
        ins.run({
          id: it.id || `lst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          product_id: it.productId || it.id || "",
          room_slug: toRoomSlug(it.roomSlug || it.category),
          tier: it.tier || "middle",
          width_tier: it.widthTier || it.width || "standard",
          starts_at: it.startsAt || new Date().toISOString(),
          ends_at: it.endsAt || it.leaseEndsAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: it.status || "active",
          dynamic_rank_score: Number(it.dynamicRankScore || 0),
          owner_user_id: String(it.ownerUserId || "").toLowerCase(),
          product_json: JSON.stringify(it.product || {}),
          last_reminder_at: it.lastReminderAt || "",
          created_at: it.createdAt || new Date().toISOString(),
          updated_at: it.updatedAt || new Date().toISOString(),
        });
      });
    });
    tx(parsed);
  } catch {}
}

async function readListings() {
  await ensureDataFiles();
  const rows = db.prepare("SELECT * FROM shelf_listings").all();
  return rows.map(rowToListing);
}

async function writeListings(rows) {
  await ensureDataFiles();
  const del = db.prepare("DELETE FROM shelf_listings");
  const ins = db.prepare(`
    INSERT INTO shelf_listings
    (id, product_id, room_slug, tier, width_tier, starts_at, ends_at, status, dynamic_rank_score, owner_user_id, product_json, last_reminder_at, created_at, updated_at)
    VALUES (@id, @product_id, @room_slug, @tier, @width_tier, @starts_at, @ends_at, @status, @dynamic_rank_score, @owner_user_id, @product_json, @last_reminder_at, @created_at, @updated_at)
  `);
  const tx = db.transaction((items) => {
    del.run();
    items.forEach((it) => {
      ins.run({
        id: it.id,
        product_id: it.productId,
        room_slug: it.roomSlug,
        tier: it.tier,
        width_tier: it.widthTier,
        starts_at: it.startsAt,
        ends_at: it.endsAt,
        status: it.status,
        dynamic_rank_score: Number(it.dynamicRankScore || 0),
        owner_user_id: it.ownerUserId || "",
        product_json: JSON.stringify(it.product || {}),
        last_reminder_at: it.lastReminderAt || "",
        created_at: it.createdAt || new Date().toISOString(),
        updated_at: it.updatedAt || new Date().toISOString(),
      });
    });
  });
  tx(rows);
}

async function readReminderLog() {
  await ensureDataFiles();
  return db
    .prepare("SELECT id, listing_id AS listingId, ends_at AS endsAt, owner_user_id AS ownerUserId, product_name AS productName, room_slug AS roomSlug, sent_at AS sentAt, channel, status FROM reminder_log")
    .all();
}

async function writeReminderLog(rows) {
  await ensureDataFiles();
  const del = db.prepare("DELETE FROM reminder_log");
  const ins = db.prepare(`
    INSERT INTO reminder_log
    (id, listing_id, ends_at, owner_user_id, product_name, room_slug, sent_at, channel, status)
    VALUES (@id, @listing_id, @ends_at, @owner_user_id, @product_name, @room_slug, @sent_at, @channel, @status)
  `);
  const tx = db.transaction((items) => {
    del.run();
    items.forEach((it) => {
      ins.run({
        id: it.id,
        listing_id: it.listingId,
        ends_at: it.endsAt,
        owner_user_id: it.ownerUserId || "",
        product_name: it.productName || "",
        room_slug: it.roomSlug || "",
        sent_at: it.sentAt,
        channel: it.channel || "email",
        status: it.status || "logged",
      });
    });
  });
  tx(rows);
}

async function appendMediaIndexRecord(record) {
  const rows = await readMediaIndex();
  const next = rows.filter((row) => row && row.productId !== record.productId);
  next.push(record);
  await writeMediaIndex(next);
}

async function createPosterFromMp4(videoPath, outputPath) {
  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(["-ss 00:00:01.000", "-frames:v 1"])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

async function processImage(tempPath, targetDir, sourceExt) {
  const mediaId = crypto.randomUUID();
  const originalName = `original-${mediaId}${sourceExt}`;
  const originalPath = path.join(targetDir, "original", originalName);
  await fsp.copyFile(tempPath, originalPath);

  const previewPath = path.join(targetDir, "images", `preview-${mediaId}.webp`);
  const cardPath = path.join(targetDir, "images", `card-${mediaId}.webp`);
  const thumbPath = path.join(targetDir, "thumbs", `thumb-${mediaId}.webp`);

  const source = sharp(tempPath);
  await source.clone().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(previewPath);
  await source.clone().resize({ width: 600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(cardPath);
  await source.clone().resize({ width: 300, withoutEnlargement: true }).webp({ quality: 76 }).toFile(thumbPath);

  return {
    id: mediaId,
    kind: "image",
    url: relUrl(previewPath),
    variants: {
      original: relUrl(originalPath),
      preview: relUrl(previewPath),
      card: relUrl(cardPath),
      thumb: relUrl(thumbPath),
    },
  };
}

async function processVideo(tempPath, targetDir) {
  const mediaId = crypto.randomUUID();
  const videoPath = path.join(targetDir, "video", `video-${mediaId}.mp4`);
  await fsp.copyFile(tempPath, videoPath);

  const posterRaw = path.join(targetDir, "video", `poster-${mediaId}.jpg`);
  const previewPath = path.join(targetDir, "images", `preview-${mediaId}.webp`);
  const cardPath = path.join(targetDir, "images", `card-${mediaId}.webp`);
  const thumbPath = path.join(targetDir, "thumbs", `thumb-${mediaId}.webp`);

  await createPosterFromMp4(tempPath, posterRaw);
  await sharp(posterRaw).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toFile(previewPath);
  await sharp(posterRaw).resize({ width: 600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(cardPath);
  await sharp(posterRaw).resize({ width: 300, withoutEnlargement: true }).webp({ quality: 76 }).toFile(thumbPath);
  await fsp.unlink(posterRaw).catch(() => {});

  return {
    id: mediaId,
    kind: "video",
    url: relUrl(previewPath),
    variants: {
      original: relUrl(videoPath),
      preview: relUrl(previewPath),
      card: relUrl(cardPath),
      thumb: relUrl(thumbPath),
    },
  };
}

async function storeMultipartFiles(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { files: MAX_FILES, fileSize: MAX_VIDEO_SIZE },
    });
    const fields = {};
    const files = [];
    let aborted = false;

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (name, stream, info) => {
      if (name !== "mediaFiles") {
        stream.resume();
        return;
      }
      const originalName = String(info.filename || "file");
      const ext = path.extname(originalName).toLowerCase();
      const isImage = IMAGE_EXT.has(ext);
      const isVideo = VIDEO_EXT.has(ext);
      if (!isImage && !isVideo) {
        aborted = true;
        stream.resume();
        reject(new Error("unsupported-format"));
        return;
      }
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      const tmpName = `upload-${Date.now()}-${crypto.randomUUID()}${ext}`;
      const tmpPath = path.join(os.tmpdir(), tmpName);
      const out = fs.createWriteStream(tmpPath);
      let written = 0;
      let tooLarge = false;

      stream.on("data", (chunk) => {
        written += chunk.length;
        if (written > maxSize) {
          tooLarge = true;
          stream.unpipe(out);
          stream.resume();
          out.destroy();
          fsp.unlink(tmpPath).catch(() => {});
        }
      });

      stream.on("limit", () => {
        tooLarge = true;
      });

      out.on("error", (err) => {
        aborted = true;
        reject(err);
      });

      stream.pipe(out);
      stream.on("end", () => {
        if (aborted) return;
        if (tooLarge) {
          aborted = true;
          reject(new Error("file-too-large"));
          return;
        }
        files.push({
          originalName,
          ext,
          kind: isVideo ? "video" : "image",
          tempPath: tmpPath,
        });
      });
    });

    busboy.on("error", (err) => reject(err));
    busboy.on("finish", () => {
      if (!aborted) resolve({ fields, files });
    });

    req.pipe(busboy);
  });
}

/** Поля brand, email, message + файлы поля portfolio (только изображения). */
async function storeSellerApplicationMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { files: MAX_SELLER_PORTFOLIO_FILES, fileSize: MAX_IMAGE_SIZE },
    });
    const fields = {};
    const files = [];
    let aborted = false;

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (name, stream, info) => {
      if (name !== "portfolio") {
        stream.resume();
        return;
      }
      const originalName = String(info.filename || "file");
      const ext = path.extname(originalName).toLowerCase();
      if (!IMAGE_EXT.has(ext)) {
        aborted = true;
        stream.resume();
        reject(new Error("unsupported-format"));
        return;
      }
      const tmpName = `seller-app-${Date.now()}-${crypto.randomUUID()}${ext}`;
      const tmpPath = path.join(os.tmpdir(), tmpName);
      const out = fs.createWriteStream(tmpPath);
      let written = 0;
      let tooLarge = false;

      stream.on("data", (chunk) => {
        written += chunk.length;
        if (written > MAX_IMAGE_SIZE) {
          tooLarge = true;
          stream.unpipe(out);
          stream.resume();
          out.destroy();
          fsp.unlink(tmpPath).catch(() => {});
        }
      });

      stream.on("limit", () => {
        tooLarge = true;
      });

      out.on("error", (err) => {
        aborted = true;
        reject(err);
      });

      stream.pipe(out);
      stream.on("end", () => {
        if (aborted) return;
        if (tooLarge) {
          aborted = true;
          reject(new Error("file-too-large"));
          return;
        }
        files.push({
          originalName,
          ext,
          tempPath: tmpPath,
        });
      });
    });

    busboy.on("error", (err) => reject(err));
    busboy.on("finish", () => {
      if (!aborted) resolve({ fields, files });
    });

    req.pipe(busboy);
  });
}

function resolveSellerApplicationRecipient() {
  const explicit = String(process.env.SELLER_APPLICATION_EMAIL || "").trim();
  if (explicit) return explicit;
  const ops = String(process.env.OPERATIONS_EMAIL || "").trim();
  if (ops) return ops;
  const admins = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (admins.length) return admins[0];
  const smtpUser = String(process.env.SMTP_USER || "").trim();
  if (smtpUser.includes("@")) return smtpUser;
  return "";
}

async function handleSellerApplication(req, res) {
  let payload;
  try {
    payload = await storeSellerApplicationMultipart(req);
  } catch (err) {
    if (String(err.message).includes("unsupported-format")) {
      return json(res, 400, { ok: false, error: "Допустимы только изображения jpg, png, webp." });
    }
    if (String(err.message).includes("file-too-large")) {
      return json(res, 400, { ok: false, error: "Файл превышает лимит размера (10 МБ)." });
    }
    return json(res, 400, { ok: false, error: "Ошибка разбора формы." });
  }

  const brand = String(payload.fields.brand || "").trim();
  const email = String(payload.fields.email || "").trim().toLowerCase();
  const message = String(payload.fields.message || "").trim();
  const files = payload.files || [];

  if (!brand || !email || !message) {
    await Promise.all(files.map((f) => fsp.unlink(f.tempPath).catch(() => {})));
    return json(res, 400, { ok: false, error: "Заполните имя/бренд, почту и сообщение." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await Promise.all(files.map((f) => fsp.unlink(f.tempPath).catch(() => {})));
    return json(res, 400, { ok: false, error: "Укажите корректный email." });
  }

  const to = resolveSellerApplicationRecipient();
  const transporter = getMailer();
  if (!to || !transporter) {
    await Promise.all(files.map((f) => fsp.unlink(f.tempPath).catch(() => {})));
    return json(res, 503, {
      ok: false,
      error:
        "Почтовый сервер не настроен или не указан получатель (SMTP_* на сервере, SELLER_APPLICATION_EMAIL или ADMIN_EMAILS).",
    });
  }

  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER || "no-reReply@example.com");
  const attachments = files.map((f) => ({
    filename: f.originalName || "portfolio.jpg",
    path: f.tempPath,
  }));

  const text =
    "Новая заявка продавца (Алтай-Витрин)\n\n" +
    `Имя / бренд: ${brand}\n` +
    `Email для ответа: ${email}\n\n` +
    "Сообщение:\n" +
    message +
    "\n\n" +
    `Вложений (фото): ${attachments.length}\n`;

  try {
    await transporter.sendMail({
      from,
      to,
      replyTo: email,
      subject: `Заявка продавца — ${brand}`,
      text,
      attachments: attachments.length ? attachments : undefined,
    });
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error("Seller application email failed:", err.message);
    return json(res, 502, { ok: false, error: "Не удалось отправить письмо." });
  } finally {
    await Promise.all(files.map((f) => fsp.unlink(f.tempPath).catch(() => {})));
  }
}

async function deletePathSafe(targetPath) {
  if (!targetPath) return;
  if (!underUploadRoot(targetPath)) return;
  await fsp.rm(targetPath, { recursive: true, force: true });
}

async function runLeaseCleanup(nowIso = new Date().toISOString()) {
  await ensureUploadRoot();
  const nowMs = Date.parse(nowIso);
  const rows = await readMediaIndex();
  const keep = [];
  let removedCount = 0;
  for (const row of rows) {
    const deleteAfterMs = Date.parse(String(row.deleteAfter || ""));
    if (!Number.isFinite(deleteAfterMs) || deleteAfterMs > nowMs) {
      keep.push(row);
      continue;
    }
    if (row.productPath) {
      await deletePathSafe(path.join(UPLOAD_ROOT, row.productPath));
    }
    removedCount += 1;
  }
  if (keep.length !== rows.length) {
    await writeMediaIndex(keep);
  }
  return { removedCount, remaining: keep.length };
}

async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 2 * 1024 * 1024) {
        reject(new Error("body-too-large"));
      }
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve(data && typeof data === "object" ? data : {});
      } catch {
        reject(new Error("invalid-json"));
      }
    });
    req.on("error", reject);
  });
}

function getMailer() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

async function sendEmailReminder(to, listing) {
  const transporter = getMailer();
  if (!transporter || !to) return { ok: false, skipped: true };
  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@example.com");
  const productName = (listing.product && listing.product.name) || "Товар";
  const endsAt = listing.endsAt || "";
  await transporter.sendMail({
    from,
    to,
    subject: "Напоминание: аренда полки заканчивается через 24 часа",
    text:
      "Здравствуйте!\n\n" +
      `Товар: ${productName}\n` +
      `Комната: ${listing.roomSlug}\n` +
      `Окончание аренды: ${endsAt}\n\n` +
      "Продлите аренду в кабинете продавца.\n",
  });
  return { ok: true };
}

async function vkApi(method, params) {
  const token = String(process.env.VK_BOT_TOKEN || "").trim();
  const version = String(process.env.VK_API_VERSION || "5.199");
  if (!token) {
    throw new Error("vk-token-missing");
  }
  const body = new URLSearchParams({ ...params, access_token: token, v: version });
  const res = await fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`vk-api-error:${data.error.error_msg || "unknown"}`);
  }
  return data.response;
}

function normalizeVkHandle(raw) {
  return String(raw || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?vk\.com\//i, "")
    .replace(/^@/, "");
}

async function resolveVkUserId(vkHandle) {
  const handle = normalizeVkHandle(vkHandle);
  if (!handle) throw new Error("vk-handle-required");
  const users = await vkApi("users.get", { user_ids: handle });
  if (!Array.isArray(users) || !users[0] || !users[0].id) throw new Error("vk-user-not-found");
  return Number(users[0].id);
}

async function sendVkMessage(vkHandle, message) {
  const userId = await resolveVkUserId(vkHandle);
  const randomId = Math.floor(Math.random() * 2147483647);
  await vkApi("messages.send", {
    user_id: String(userId),
    random_id: String(randomId),
    message,
  });
}

/** Ответ пользователю в уже открытый диалог (Callback API, peer_id из входящего сообщения). */
async function sendVkPeerMessage(peerId, message) {
  const id = Number(peerId);
  if (!Number.isFinite(id)) throw new Error("peer-id-invalid");
  const randomId = Math.floor(Math.random() * 2147483647);
  await vkApi("messages.send", {
    peer_id: String(id),
    random_id: String(randomId),
    message,
  });
}

function isVkStartTrigger(text) {
  const t = String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[\s.!,]+$/g, "")
    .trim();
  return t === "старт" || t === "start";
}

function vkCallbackPlain(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

async function handleVkCallback(req, res) {
  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    return vkCallbackPlain(res, 400, "bad request");
  }
  const type = String(body.type || "");
  const secret = String(process.env.VK_CALLBACK_SECRET || "").trim();
  const bodySecret = String(body.secret || "");
  if (secret) {
    if (bodySecret && bodySecret !== secret) {
      return vkCallbackPlain(res, 403, "forbidden");
    }
    // confirmation от ВК часто без поля secret; остальные события при включённом ключе должны его слать
    if (!bodySecret && type !== "confirmation") {
      return vkCallbackPlain(res, 403, "forbidden");
    }
  }
  if (type === "confirmation") {
    const raw = String(process.env.VK_CALLBACK_CONFIRMATION || "");
    const code = raw.trim().replace(/^\uFEFF/, "");
    if (!code) {
      console.error("VK_CALLBACK_CONFIRMATION is empty — set it to the string from VK Callback settings.");
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(code);
    return;
  }
  if (type === "message_new") {
    const obj = body.object;
    const msg =
      obj && typeof obj === "object" && obj.message && typeof obj.message === "object"
        ? obj.message
        : obj;
    if (msg && msg.peer_id != null && isVkStartTrigger(msg.text)) {
      try {
        const welcome =
          "Здравствуйте! Это Алтай-Витрин. Код регистрации вы получите на сайте: откройте altdi.ru → «Войти» → заполните форму и нажмите «Отправить код».";
        await sendVkPeerMessage(msg.peer_id, welcome);
      } catch (err) {
        console.error("VK callback reply failed:", err.message);
      }
    }
  }
  return vkCallbackPlain(res, 200, "ok");
}

async function createVkCode(email, vkHandle) {
  await ensureDataFiles();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const now = Date.now();
  const expiresAt = now + VK_CODE_TTL_MS;
  db.prepare("DELETE FROM vk_codes WHERE email = ? AND vk_handle = ? AND used_at = 0").run(email, vkHandle);
  db.prepare("INSERT INTO vk_codes (id, email, vk_handle, code, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)")
    .run(crypto.randomUUID(), email, vkHandle, code, expiresAt, now);
  return { code, expiresAt };
}

function hashUserPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hashBuf = crypto.scryptSync(String(plain), salt, 64);
  return { salt: salt.toString("hex"), hash: hashBuf.toString("hex") };
}

function verifyUserPassword(plain, saltHex, hashHex) {
  try {
    const salt = Buffer.from(saltHex, "hex");
    const hash = Buffer.from(hashHex, "hex");
    const cand = crypto.scryptSync(String(plain), salt, 64);
    if (cand.length !== hash.length) return false;
    return crypto.timingSafeEqual(cand, hash);
  } catch {
    return false;
  }
}

/** Учётка администратора в SQLite (логин/пароль по умолчанию или BOOTSTRAP_ADMIN_* в env). */
function ensureBootstrapAdmin() {
  if (!db) return;
  const login = String(process.env.BOOTSTRAP_ADMIN_LOGIN || "admin").trim().toLowerCase();
  const plain = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || "12345678");
  if (!login || plain.length < 8) return;
  for (const legacy of ["admin@altdi.ru", "admin@altay-vitrin.ru"]) {
    db.prepare("DELETE FROM users WHERE LOWER(email) = LOWER(?)").run(legacy);
  }
  const now = Date.now();
  const { salt, hash } = hashUserPassword(plain);
  const row = db.prepare("SELECT email FROM users WHERE email = ?").get(login);
  if (row) {
    db.prepare(
      "UPDATE users SET password_hash = ?, password_salt = ?, role = 'admin', updated_at = ? WHERE email = ?"
    ).run(hash, salt, now, login);
  } else {
    db.prepare(
      `INSERT INTO users (email, password_hash, password_salt, name, vk_handle, role, created_at, updated_at)
       VALUES (?, ?, ?, '', '', 'admin', ?, ?)`
    ).run(login, hash, salt, now, now);
  }
}

async function upsertUserAfterVk(email, name, vkHandle, password) {
  await ensureDataFiles();
  const { salt, hash } = hashUserPassword(password);
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (email, password_hash, password_salt, name, vk_handle, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'user', ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       password_hash = excluded.password_hash,
       password_salt = excluded.password_salt,
       name = excluded.name,
       vk_handle = excluded.vk_handle,
       updated_at = excluded.updated_at`
  ).run(email, hash, salt, name || "", vkHandle || "", now, now);
}

async function verifyVkCode(email, vkHandle, code) {
  await ensureDataFiles();
  const now = Date.now();
  const row = db
    .prepare(
      "SELECT id, code, expires_at, used_at FROM vk_codes WHERE email = ? AND vk_handle = ? ORDER BY created_at DESC LIMIT 1"
    )
    .get(email, vkHandle);
  if (!row) return false;
  if (Number(row.used_at || 0) > 0) return false;
  if (now > Number(row.expires_at || 0)) return false;
  if (String(row.code) !== String(code)) return false;
  db.prepare("UPDATE vk_codes SET used_at = ? WHERE id = ?").run(now, row.id);
  return true;
}

function isListingActive(row, nowMs) {
  if (!row || row.status !== "active") return false;
  const endsMs = Date.parse(String(row.endsAt || ""));
  if (!Number.isFinite(endsMs)) return false;
  return endsMs > nowMs;
}

function listingToPublicCard(row) {
  const product = row.product || {};
  return {
    listingId: row.id,
    productId: row.productId,
    name: product.name || "Товар",
    type: product.type || "",
    designer: product.designer || product.sellerName || "Автор",
    category: product.category || row.roomSlug,
    material: product.material || "ceramic",
    price: Number(product.price || 0),
    media: Array.isArray(product.media) ? product.media : [],
    previewMediaId: product.previewMediaId || "",
    preview: product.preview || null,
    image: (product.preview && product.preview.url) || product.image || "",
    tier: tierToClient(row.tier),
    width: widthToClient(row.widthTier),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
  };
}

async function handleGetRoomListings(req, res, roomSlug) {
  await ensureDataFiles();
  const rows = await readListings();
  const nowMs = Date.now();
  const active = rows
    .filter((row) => row.roomSlug === roomSlug)
    .filter((row) => isListingActive(row, nowMs))
    .sort((a, b) => {
      const ra = Number(a.dynamicRankScore || 0);
      const rb = Number(b.dynamicRankScore || 0);
      if (rb !== ra) return rb - ra;
      return Date.parse(String(a.startsAt || 0)) - Date.parse(String(b.startsAt || 0));
    });
  const grouped = { top: [], middle: [], bottom: [] };
  active.forEach((row) => {
    const key = row.tier === "top" ? "top" : row.tier === "bottom" ? "bottom" : "middle";
    grouped[key].push(listingToPublicCard(row));
  });
  return json(res, 200, { ok: true, roomSlug, grouped, items: active.map(listingToPublicCard) });
}

async function handleGetSellerListings(req, res, url) {
  await ensureDataFiles();
  const seller = String(url.searchParams.get("seller") || "").trim().toLowerCase();
  if (!seller) {
    return json(res, 400, { ok: false, error: "seller query param required" });
  }
  const rows = await readListings();
  const items = rows.filter((row) => String(row.ownerUserId || "").toLowerCase() === seller);
  return json(res, 200, { ok: true, items });
}

async function handleCreateSellerListing(req, res) {
  await ensureDataFiles();
  let body;
  try {
    body = await parseJsonBody(req);
  } catch (err) {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
  }
  const product = body.product && typeof body.product === "object" ? body.product : {};
  const productId = normalizeToken(body.productId || product.id, `prd-${Date.now()}`);
  const roomSlug = toRoomSlug(body.roomSlug || body.category || product.category);
  const startsAt = new Date().toISOString();
  const endsAt = parseLeaseEndsAt(body.endsAt || body.leaseEndsAt);
  if (!endsAt) return json(res, 400, { ok: false, error: "endsAt is required" });

  const ownerUserId = String(body.ownerUserId || body.sellerEmail || "").trim().toLowerCase();
  if (!ownerUserId) {
    return json(res, 400, { ok: false, error: "ownerUserId is required" });
  }
  const rawListingStatus = String(body.status || "").trim().toLowerCase();
  const listingStatus =
    rawListingStatus === "pending_review" || rawListingStatus === "active" ? rawListingStatus : "active";

  const listing = {
    id: normalizeToken(body.id, `lst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    productId,
    roomSlug,
    tier: tierFromClient(body.tier),
    widthTier: widthFromClient(body.widthTier || body.width),
    startsAt,
    endsAt,
    status: listingStatus,
    dynamicRankScore: Number(body.dynamicRankScore || 0),
    ownerUserId,
    product: {
      id: productId,
      name: String(product.name || body.name || "").trim(),
      type: String(product.type || body.type || "").trim(),
      designer: String(product.designer || body.designer || "").trim(),
      category: roomSlug,
      material: String(product.material || body.material || "ceramic").trim(),
      price: Number(product.price || body.price || 0),
      media: Array.isArray(product.media) ? product.media : [],
      previewMediaId: String(product.previewMediaId || body.previewMediaId || "").trim(),
      preview: product.preview || body.preview || null,
      image: String(product.image || body.image || "").trim(),
    },
    lastReminderAt: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const rows = await readListings();
  const next = rows.filter((row) => row.id !== listing.id && row.productId !== listing.productId);
  next.push(listing);
  await writeListings(next);
  return json(res, 200, { ok: true, item: listing });
}

async function handleRenewListing(req, res, listingId) {
  await ensureDataFiles();
  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
  }
  const endsAt = parseLeaseEndsAt(body.endsAt || body.leaseEndsAt);
  if (!endsAt) return json(res, 400, { ok: false, error: "endsAt is required" });
  const rows = await readListings();
  let changed = false;
  const next = rows.map((row) => {
    if (row.id !== listingId) return row;
    changed = true;
    return {
      ...row,
      endsAt,
      status: "active",
      lastReminderAt: "",
      updatedAt: new Date().toISOString(),
    };
  });
  if (!changed) return json(res, 404, { ok: false, error: "Listing not found" });
  await writeListings(next);
  return json(res, 200, { ok: true });
}

async function handleAdminGetListings(req, res, url) {
  await ensureDataFiles();
  const statusFilter = String(url.searchParams.get("status") || "").trim().toLowerCase();
  const roomFilter = String(url.searchParams.get("room") || "").trim().toLowerCase();
  const rows = await readListings();
  const items = rows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    if (roomFilter && row.roomSlug !== roomFilter) return false;
    return true;
  });
  return json(res, 200, { ok: true, items });
}

async function handleAdminPatchListing(req, res, listingId) {
  await ensureDataFiles();
  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
  }
  const nextStatus = String(body.status || "").trim().toLowerCase();
  const allowed = new Set(["active", "expired", "cancelled", "pending_payment", "pending_review"]);
  if (!allowed.has(nextStatus)) {
    return json(res, 400, { ok: false, error: "Invalid status" });
  }
  const rows = await readListings();
  let changed = false;
  const next = rows.map((row) => {
    if (row.id !== listingId) return row;
    changed = true;
    return { ...row, status: nextStatus, updatedAt: new Date().toISOString() };
  });
  if (!changed) return json(res, 404, { ok: false, error: "Listing not found" });
  await writeListings(next);
  return json(res, 200, { ok: true });
}

async function handleVkSendCode(req, res) {
  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const vk = normalizeVkHandle(body.vk);
  const name = String(body.name || "").trim();
  const reservedLogin = String(process.env.BOOTSTRAP_ADMIN_LOGIN || "admin").trim().toLowerCase();
  if (email === reservedLogin) {
    return json(res, 400, { ok: false, error: "Этот логин зарезервирован." });
  }
  if (!email || !vk) return json(res, 400, { ok: false, error: "email and vk are required" });
  const { code, expiresAt } = await createVkCode(email, vk);
  const message =
    `Код регистрации Алтай-Витрин: ${code}\n` +
    `Действует до: ${new Date(expiresAt).toLocaleString("ru-RU")}`;
  try {
    await sendVkMessage(vk, message);
    return json(res, 200, { ok: true, expiresAt, channel: "vk" });
  } catch (err) {
    return json(res, 502, {
      ok: false,
      error: "Не удалось отправить код в VK. Проверьте VK_BOT_TOKEN и права бота.",
      details: err.message,
      debugCode: process.env.NODE_ENV === "production" ? undefined : code,
    });
  }
}

async function handleVkVerifyCode(req, res) {
  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
  }
  const email = String(body.email || "").trim().toLowerCase();
  const vk = normalizeVkHandle(body.vk);
  const code = String(body.code || "").trim();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const reservedLogin = String(process.env.BOOTSTRAP_ADMIN_LOGIN || "admin").trim().toLowerCase();
  if (email === reservedLogin) {
    return json(res, 400, { ok: false, error: "Этот логин зарезервирован." });
  }
  if (!email || !vk || !/^\d{6}$/.test(code)) {
    return json(res, 400, { ok: false, error: "email, vk and 6-digit code are required" });
  }
  if (password.length < 8) {
    return json(res, 400, { ok: false, error: "Пароль не короче 8 символов." });
  }
  const ok = await verifyVkCode(email, vk, code);
  if (!ok) return json(res, 401, { ok: false, error: "Invalid or expired code" });
  await upsertUserAfterVk(email, name, vk, password);
  return json(res, 200, { ok: true, email, role: "user" });
}

async function handleAuthLogin(req, res) {
  let body;
  try {
    body = await parseJsonBody(req);
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
  }
  const email = String(body.email || body.login || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    return json(res, 400, { ok: false, error: "login and password required" });
  }
  await ensureDataFiles();
  const row = db.prepare("SELECT email, password_hash, password_salt, role FROM users WHERE email = ?").get(email);
  if (!row || !verifyUserPassword(password, row.password_salt, row.password_hash)) {
    return json(res, 401, { ok: false, error: "Неверный логин или пароль." });
  }
  let role = String(row.role || "user");
  const adminList = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (adminList.includes(email)) role = "admin";
  return json(res, 200, { ok: true, email: row.email, role });
}

async function runListingsJobs(nowIso = new Date().toISOString()) {
  await ensureDataFiles();
  const rows = await readListings();
  const nowMs = Date.parse(nowIso);
  const reminderWindowEnd = nowMs + 24 * 60 * 60 * 1000;
  let changed = false;
  const reminders = await readReminderLog();
  const reminderSet = new Set(reminders.map((r) => `${r.listingId}:${r.endsAt}`));
  const newReminderRows = [];

  const next = rows.map((row) => {
    const endsMs = Date.parse(String(row.endsAt || ""));
    if (!Number.isFinite(endsMs)) return row;

    let out = row;
    if (row.status === "active" && endsMs <= nowMs) {
      changed = true;
      out = { ...out, status: "expired", updatedAt: new Date().toISOString() };
    }

    if (out.status === "active" && endsMs > nowMs && endsMs <= reminderWindowEnd) {
      const key = `${out.id}:${out.endsAt}`;
      if (!reminderSet.has(key)) {
        reminderSet.add(key);
        changed = true;
        out = { ...out, lastReminderAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        newReminderRows.push({
          id: crypto.randomUUID(),
          listingId: out.id,
          endsAt: out.endsAt,
          ownerUserId: out.ownerUserId || "",
          productName: (out.product && out.product.name) || "",
          roomSlug: out.roomSlug || "",
          sentAt: new Date().toISOString(),
          channel: "email",
          status: "logged",
        });
      }
    }
    return out;
  });

  if (changed) {
    await writeListings(next);
  }
  if (newReminderRows.length) {
    await writeReminderLog(reminders.concat(newReminderRows));
  }

  if (newReminderRows.length) {
    for (const reminder of newReminderRows) {
      const row = next.find((x) => x.id === reminder.listingId);
      if (!row) continue;
      const owner = String(row.ownerUserId || "").trim().toLowerCase();
      const vkHandle =
        row.product && row.product.vk ? normalizeVkHandle(row.product.vk) : "";
      try {
        await sendEmailReminder(owner, row);
      } catch (err) {
        console.error("Email reminder failed:", err.message);
      }
      if (vkHandle) {
        try {
          await sendVkMessage(
            vkHandle,
            `Напоминание от Алтай-Витрин: аренда товара "${(row.product && row.product.name) || "Товар"}" заканчивается ${new Date(
              row.endsAt
            ).toLocaleString("ru-RU")}.`
          );
        } catch (err) {
          console.error("VK reminder failed:", err.message);
        }
      }
    }
  }
  return { changed, remindersLogged: newReminderRows.length };
}

async function handleUpload(req, res) {
  const uploadStarted = Date.now();
  await ensureUploadRoot();
  let payload;
  try {
    payload = await storeMultipartFiles(req);
  } catch (err) {
    if (String(err.message).includes("unsupported-format")) {
      return json(res, 400, { ok: false, error: "Поддерживаются только jpg/jpeg/png/webp/mp4." });
    }
    if (String(err.message).includes("file-too-large")) {
      return json(res, 400, { ok: false, error: "Файл превышает лимит размера." });
    }
    return json(res, 400, { ok: false, error: "Ошибка загрузки файлов." });
  }

  const { fields, files } = payload;
  if (!files.length) {
    return json(res, 400, { ok: false, error: "Передайте хотя бы один файл." });
  }

  const productId = normalizeToken(fields.productId, `product-${Date.now()}`);
  const ownerType = getSafeOwnerType(fields.ownerType);
  const category = getSafeCategory(fields.category);
  const leaseEndsAt = parseLeaseEndsAt(fields.leaseEndsAt);
  const deleteAfter = toDeleteAfter(leaseEndsAt);
  const previewIndexRaw = Number.parseInt(String(fields.previewIndex || "0"), 10);
  const previewIndex = Number.isFinite(previewIndexRaw) ? previewIndexRaw : 0;

  if (!leaseEndsAt) {
    await Promise.all(files.map((f) => fsp.unlink(f.tempPath).catch(() => {})));
    return json(res, 400, { ok: false, error: "Поле leaseEndsAt обязательно." });
  }

  const productFolderName = `product-${productId}`;
  const productPathRel = path.join(ownerType, category, productFolderName);
  const productAbsPath = path.join(UPLOAD_ROOT, productPathRel);
  await fsp.mkdir(path.join(productAbsPath, "original"), { recursive: true });
  await fsp.mkdir(path.join(productAbsPath, "images"), { recursive: true });
  await fsp.mkdir(path.join(productAbsPath, "thumbs"), { recursive: true });
  await fsp.mkdir(path.join(productAbsPath, "video"), { recursive: true });

  const media = [];
  try {
    for (const file of files) {
      if (file.kind === "video") {
        media.push(await processVideo(file.tempPath, productAbsPath));
      } else {
        media.push(await processImage(file.tempPath, productAbsPath, file.ext));
      }
    }
  } catch (err) {
    await deletePathSafe(productAbsPath);
    await Promise.all(files.map((f) => fsp.unlink(f.tempPath).catch(() => {})));
    return json(res, 500, { ok: false, error: "Не удалось обработать медиа (sharp/ffmpeg)." });
  } finally {
    await Promise.all(files.map((f) => fsp.unlink(f.tempPath).catch(() => {})));
  }

  const safePreviewIndex = Math.max(0, Math.min(previewIndex, media.length - 1));
  const previewMediaId = media[safePreviewIndex] ? media[safePreviewIndex].id : media[0].id;
  const preview = media.find((m) => m.id === previewMediaId) || media[0];

  await appendMediaIndexRecord({
    productId,
    ownerType,
    category,
    productPath: productPathRel,
    leaseEndsAt,
    deleteAfter,
    mediaIds: media.map((m) => m.id),
    updatedAt: new Date().toISOString(),
  });

  console.log(
    `[upload] ok productId=${productId} files=${media.length} ${Date.now() - uploadStarted}ms`
  );

  return json(res, 200, {
    ok: true,
    productId,
    leaseEndsAt,
    deleteAfter,
    media,
    previewMediaId,
    preview,
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = path.posix.normalize(url.pathname);
  if (pathname.includes("..")) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  let file =
    pathname === "/" || pathname === ""
      ? path.join(ROOT, "index.html")
      : path.join(ROOT, pathname.replace(/^\//, ""));

  if (!underRoot(file)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      return res.end("Not found");
    }
    fs.readFile(file, (readErr, data) => {
      if (readErr) {
        res.writeHead(404);
        return res.end("Not found");
      }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      if (req.method === "HEAD") return res.end();
      res.end(data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "POST" && url.pathname === "/api/media/upload") {
    return handleUpload(req, res);
  }
  if (req.method === "POST" && url.pathname === "/api/auth/vk/send-code") {
    return handleVkSendCode(req, res);
  }
  if (req.method === "POST" && url.pathname === "/api/auth/vk/verify-code") {
    return handleVkVerifyCode(req, res);
  }
  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    return handleAuthLogin(req, res);
  }
  if (req.method === "POST" && url.pathname === "/api/contact/seller-application") {
    return handleSellerApplication(req, res);
  }
  if (req.method === "POST" && url.pathname === "/api/vk/callback") {
    return handleVkCallback(req, res);
  }
  if (req.method === "POST" && url.pathname === "/api/media/run-cleanup") {
    const result = await runLeaseCleanup();
    return json(res, 200, { ok: true, result });
  }
  if (req.method === "GET" && url.pathname.startsWith("/api/rooms/")) {
    const roomSlug = normalizeToken(url.pathname.split("/").pop(), "");
    if (!CATEGORIES.has(roomSlug)) return json(res, 404, { ok: false, error: "Room not found" });
    return handleGetRoomListings(req, res, roomSlug);
  }
  if (req.method === "GET" && url.pathname === "/api/seller/listings") {
    return handleGetSellerListings(req, res, url);
  }
  if (req.method === "POST" && url.pathname === "/api/seller/listings") {
    return handleCreateSellerListing(req, res);
  }
  if (req.method === "PATCH" && url.pathname.startsWith("/api/seller/listings/") && url.pathname.endsWith("/renew")) {
    const listingId = normalizeToken(url.pathname.split("/")[4], "");
    if (!listingId) return json(res, 404, { ok: false, error: "Listing not found" });
    return handleRenewListing(req, res, listingId);
  }
  if (req.method === "GET" && url.pathname === "/api/admin/listings") {
    return handleAdminGetListings(req, res, url);
  }
  if (req.method === "PATCH" && url.pathname.startsWith("/api/admin/listings/")) {
    const listingId = normalizeToken(url.pathname.split("/").pop(), "");
    if (!listingId) return json(res, 404, { ok: false, error: "Listing not found" });
    return handleAdminPatchListing(req, res, listingId);
  }
  if (req.method === "POST" && url.pathname === "/api/jobs/run-listings") {
    const result = await runListingsJobs();
    return json(res, 200, { ok: true, result });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    return res.end("Method not allowed");
  }
  if (req.method === "GET") {
    const roomSlug = roomSlugFromPath(url.pathname.toLowerCase());
    if (roomSlug) {
      runListingsJobs().catch((err) => {
        console.error("Listings job failed:", err.message);
      });
    }
  }
  return serveStatic(req, res);
});

setInterval(() => {
  runLeaseCleanup().catch((err) => {
    console.error("Cleanup failed:", err.message);
  });
}, 60 * 60 * 1000);

setInterval(() => {
  runListingsJobs().catch((err) => {
    console.error("Listings jobs failed:", err.message);
  });
}, 60 * 1000);

server.listen(PORT, "127.0.0.1", async () => {
  await ensureUploadRoot();
  await ensureDataFiles();
  ensureBootstrapAdmin();
  console.log(`Local site: http://127.0.0.1:${PORT}/`);
  console.log("Media API: POST /api/media/upload");
  console.log("Listings API: /api/rooms/:slug, /api/seller/listings, /api/admin/listings");
  console.log("Seller application: POST /api/contact/seller-application (multipart, SMTP)");
  console.log("VK Callback: POST /api/vk/callback (VK_CALLBACK_CONFIRMATION, optional VK_CALLBACK_SECRET)");
  console.log("Press Ctrl+C to stop.");
});
