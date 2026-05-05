/* Локальная отдача статики: node server.cjs */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8765;
const ROOT = path.resolve(__dirname);

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
};

function underRoot(f) {
  const r = path.resolve(f);
  return r === ROOT || r.startsWith(ROOT + path.sep);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    return res.end("Method not allowed");
  }
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

  const send = (f) => {
    fs.readFile(f, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not found");
      }
      const ext = path.extname(f).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      if (req.method === "HEAD") {
        return res.end();
      }
      res.end(data);
    });
  };

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      return res.end("Not found");
    }
    send(file);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Local site: http://127.0.0.1:${PORT}/`);
  console.log("Press Ctrl+C to stop.");
});
