/**
 * Центрированный квадратный кроп исходника → favicon.png + apple-touch-icon (png).
 * Запуск: node scripts/build-favicon.cjs
 */
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets", "favicon-source.png");
const OUT_FAVICON = path.join(ROOT, "favicon.png");
const OUT_APPLE = path.join(ROOT, "apple-touch-icon.png");

async function main() {
  const meta = await sharp(SRC).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (!w || !h) throw new Error("Cannot read source dimensions");
  const side = Math.min(w, h);
  const left = Math.floor((w - side) / 2);
  const top = Math.floor((h - side) / 2);

  const base = sharp(SRC).extract({ left, top, width: side, height: side });

  await base.clone().resize(64, 64, { fit: "cover" }).png().toFile(OUT_FAVICON);
  await base.clone().resize(180, 180, { fit: "cover" }).png().toFile(OUT_APPLE);

  console.log("Written:", path.relative(ROOT, OUT_FAVICON), "64×64 (вкладка, чётко на Retina)");
  console.log("Written:", path.relative(ROOT, OUT_APPLE), "180×180 (apple-touch-icon)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
