/**
 * PaceCast デモ動画（スマホ枠）。自宅 GPS は使わず、代々木公園付近の固定座標を使う。
 */
import { chromium } from "playwright";
import {
  mkdirSync,
  existsSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  rmSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "..", "local", "demo-video");
const VIDEO_DIR = join(OUT_DIR, "raw");
const BASE = "http://127.0.0.1:3000";

/** 代々木公園付近（公開の公園。自宅ではない） */
const GEO = { latitude: 35.6717, longitude: 139.695, accuracy: 30 };

const VIEWPORT = { width: 390, height: 844 };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function newestWebm(dir) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => {
      const path = join(dir, f);
      return { path, mtime: statSync(path).mtimeMs, size: statSync(path).size };
    })
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) {
    throw new Error("動画ファイルがありません");
  }
  return files[0].path;
}

async function main() {
  rmSync(VIDEO_DIR, { recursive: true, force: true });
  mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    colorScheme: "dark",
    geolocation: GEO,
    permissions: ["geolocation"],
    recordVideo: {
      dir: VIDEO_DIR,
      size: VIEWPORT,
    },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  try {
    // --- ログイン（API でセッション Cookie。デモはホームから開始） ---
    const loginRes = await context.request.post(`${BASE}/api/auth/login`, {
      data: { email: "dev@pacecast.local", password: "pacecast-dev" },
    });
    if (!loginRes.ok()) {
      throw new Error(`ログイン API 失敗: ${loginRes.status()} ${await loginRes.text()}`);
    }

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /天気から/ }).waitFor({ timeout: 15000 });
    await sleep(1800);

    // --- パフォーマンス予測 ---
    await page.getByRole("link", { name: /パフォーマンスを予測/ }).click();
    await page.waitForURL("**/predict**");
    await sleep(1200);

    // 気象: 予報から選ぶ（地点・日時は初期値のまま）
    await page.getByRole("button", { name: "設定する" }).first().click();
    await sleep(500);
    const weatherDialog = page.getByRole("dialog", { name: "気象の指定" });
    await weatherDialog.waitFor();
    await weatherDialog.getByLabel("予報から選ぶ").click();
    await sleep(800);
    await weatherDialog.getByRole("button", { name: "設定する" }).click();
    await sleep(800);

    // 距離: レース種別（レースペース）
    await page.getByRole("button", { name: "設定する" }).nth(1).click();
    await sleep(500);
    const distanceDialog = page.getByRole("dialog", { name: "距離/レースを指定" });
    await distanceDialog.waitFor();
    await distanceDialog.getByRole("radio", { name: "レース種別で予測" }).check();
    await sleep(500);
    await distanceDialog.locator("select").selectOption("race_half");
    await sleep(700);
    await distanceDialog.getByRole("button", { name: "設定する" }).click();
    await sleep(800);

    const predictBtn = page.getByRole("button", { name: "予測する" });
    if (await predictBtn.isEnabled()) {
      await predictBtn.click();
      await page.getByText(/予想ペース|信頼度|参考件数/).first().waitFor({ timeout: 30000 }).catch(() => {});
      await sleep(2200);
      // 予報利用時は「現在の気象」と同型の表も見せる
      await page.mouse.wheel(0, 280);
      await sleep(1400);
      await page.mouse.wheel(0, 280);
      await sleep(1200);
    } else {
      await sleep(1000);
    }

    // --- ホーム経由で天気予報 ---
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /天気から/ }).waitFor({ timeout: 10000 });
    await sleep(900);
    await page.getByRole("link", { name: /ランニング天気予報/ }).click();
    await page.waitForURL("**/forecast**");
    await page.getByText("現在の気象").waitFor({ timeout: 25000 }).catch(() => {});
    // 読み込みスピナーが消えるまで待つ
    await page
      .getByText("天気情報を取得中です...")
      .waitFor({ state: "hidden", timeout: 25000 })
      .catch(() => {});
    await sleep(2200);
    await page.mouse.wheel(0, 360);
    await sleep(1500);
    await page.mouse.wheel(0, 360);
    await sleep(1200);

    // --- コースを作る（固定座標＝代々木公園付近。GPS 自宅は使わない） ---
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await sleep(800);
    await page.getByRole("link", { name: /コースを作る/ }).click();
    await page.waitForURL("**/courses**");
    await sleep(3000);

    const km = page.getByLabel(/距離/).or(page.locator('input[type="number"]').first());
    if (await km.count()) {
      await km.first().fill("5");
    }
    await sleep(600);
    const createBtn = page.getByRole("button", { name: "コースを作る" });
    if (await createBtn.isEnabled()) {
      await createBtn.click();
      await Promise.race([
        page.getByText(/情報を取得|探索|検索を中止/).first().waitFor({ timeout: 10000 }),
        sleep(10000),
      ]).catch(() => {});
      await sleep(5000);
      const stop = page.getByRole("button", { name: "検索を中止" });
      if (await stop.isVisible().catch(() => false)) {
        await stop.click();
        await sleep(900);
      }
    } else {
      await sleep(2500);
    }

    const homeBtn = page.getByRole("link", { name: /ホームへ戻る/ }).or(page.getByRole("button", { name: /ホームへ戻る/ }));
    if (await homeBtn.count()) {
      await homeBtn.first().click();
      await sleep(1400);
    } else {
      await page.goto(`${BASE}/`);
      await sleep(1400);
    }
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const src = newestWebm(VIDEO_DIR);
  const dest = join(OUT_DIR, "pacecast-demo-phone.webm");
  if (existsSync(dest)) {
    try {
      unlinkSync(dest);
    } catch {
      /* ignore */
    }
  }
  renameSync(src, dest);

  // 容量削減: 1.35倍速 + 適度なビットレート（ffmpeg-static）
  try {
    const ffmpegPath = require("ffmpeg-static");
    const compact = join(OUT_DIR, "pacecast-demo-phone-compact.webm");
    const ff = spawnSync(
      ffmpegPath,
      [
        "-y",
        "-i",
        dest,
        "-filter:v",
        "setpts=PTS/1.35",
        "-an",
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "650k",
        "-crf",
        "32",
        "-row-mt",
        "1",
        "-deadline",
        "good",
        "-cpu-used",
        "2",
        compact,
      ],
      { encoding: "utf8" },
    );
    if (ff.status === 0 && existsSync(compact) && statSync(compact).size > 50_000) {
      unlinkSync(dest);
      renameSync(compact, dest);
    } else {
      console.warn("ffmpeg compress skipped:", ff.stderr?.slice(-500) || ff.error);
      if (existsSync(compact)) {
        unlinkSync(compact);
      }
    }
  } catch (err) {
    console.warn("ffmpeg compress unavailable:", err instanceof Error ? err.message : err);
  }

  const mb = (statSync(dest).size / (1024 * 1024)).toFixed(2);
  console.log(JSON.stringify({ ok: true, path: dest, sizeMB: mb }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
