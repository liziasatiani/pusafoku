import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const password = process.env.TEST_PASSWORD ?? "test-pass";
const out = "e2e/shots";
mkdirSync(out, { recursive: true });

const executablePath = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const problems = [];

async function session(viewport, name, scheme = "dark") {
  const context = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (e) => problems.push(`${name}: ${e}`));
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${name} console ${m.type()}: ${m.text()}`);
  });
  await page.goto(`${base}/login`);
  await page.screenshot({ path: `${out}/${name}-login.png` });
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(`${base}/`);
  await page.waitForTimeout(5500);
  await page.screenshot({ path: `${out}/${name}-real.png`, fullPage: true });
  await page.fill("#cmd", "start my day");
  await page.press("#cmd", "Enter");
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${out}/${name}-answer.png`, fullPage: true });
  await page.getByRole("button", { name: /^Open .* file$/ }).first().click().catch(async () => {
    await page.locator("button", { hasText: /Authorizations/ }).first().click();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-file.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) problems.push(`${name}: horizontal overflow ${overflow}px`);
  await context.close();
}

await session({ width: 1440, height: 900 }, "desktop");
await session({ width: 375, height: 812 }, "phone");
await session({ width: 1440, height: 900 }, "desktop-light", "light");
await session({ width: 375, height: 812 }, "phone-light", "light");
await browser.close();
console.log(problems.length ? problems.join("\n") : "no problems");
