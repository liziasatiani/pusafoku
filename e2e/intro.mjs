import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const password = process.env.TEST_PASSWORD ?? "test-pass";
mkdirSync("e2e/shots", { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const errors = [];

for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 375, height: 812 }]]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  await page.goto(`${base}/login`);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(`${base}/`);
  const t0 = Date.now();
  for (const at of [500, 1500, 2300, 3300, 5200]) {
    await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
    await page.screenshot({ path: `e2e/shots/intro-${name}-${at}.png` });
  }
  const gone = await page.locator('[role="status"][aria-label="Loading PUSAFOKU"]').count();
  console.log(name, "overlay still mounted:", gone);
  await context.close();
}
console.log("errors", errors);
await browser.close();
