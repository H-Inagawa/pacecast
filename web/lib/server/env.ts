import fs from "node:fs";
import path from "node:path";

let loaded = false;

function applyEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

export function loadEnv(): void {
  if (loaded) {
    return;
  }
  loaded = true;
  const cwd = process.cwd();
  applyEnvFile(path.resolve(cwd, ".env.local"));
  applyEnvFile(path.resolve(cwd, ".env"));
  applyEnvFile(path.resolve(cwd, "..", ".env"));
}
