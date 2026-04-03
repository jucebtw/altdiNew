const fs = require("fs");
const path = require("path");

function nodeInterpreter() {
  if (process.env.TOOLCHAIN_NODE) return process.env.TOOLCHAIN_NODE;
  try {
    const p = path.join(__dirname, ".node-bin");
    if (fs.existsSync(p)) {
      const v = fs.readFileSync(p, "utf8").trim();
      if (v) return v;
    }
  } catch {
    /* ignore */
  }
  return "node";
}

/** PM2: на сервере — после деплоя toolchain подставляет интерпретатор из .node-bin */
module.exports = {
  apps: [
    {
      name: "altdi-ru",
      cwd: __dirname,
      interpreter: nodeInterpreter(),
      script: path.join(__dirname, "node_modules/next/dist/bin/next"),
      args: "start",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3000",
      },
    },
  ],
};
