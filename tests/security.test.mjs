import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { randomBytes, scryptSync } from "node:crypto";

const PASSWORD = "test-password-for-the-suite";
const salt = randomBytes(16);
const SENTINELS = {
  PUSAFOKU_SESSION_SECRET: "sentinel-session-secret-0123456789abcdef0123456789",
  PUSAFOKU_PASSWORD_HASH: `scrypt$${salt.toString("hex")}$${scryptSync(PASSWORD, salt, 64).toString("hex")}`,
  SUPABASE_URL: "https://sentinel-database-host.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "sentinel-service-role-key-not-for-browsers-0001",
  INBOX_TOKEN: "sentinel-inbox-token-abcdefghijklmnop",
  CRON_SECRET: "sentinel-cron-secret-abcdefghijklmnop",
  CALENDAR_ICS_URL: "https://sentinel-calendar-host.invalid/private-token/basic.ics",
};
const ID = "d9754cdb-3084-4e3e-b2b5-f6f5fbcd81d8";

let server;
let base = "";
let cookie = "";

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
    probe.on("error", reject);
  });
}

async function call(method, path, { headers = {}, body, authed = false, redirect = "manual" } = {}) {
  const h = { ...headers };
  if (authed) h.cookie = cookie;
  if (body !== undefined && !h["content-type"]) h["content-type"] = "application/json";
  return fetch(base + path, { method, headers: h, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body), redirect });
}

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { env: { ...process.env, ...SENTINELS }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/login")).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const login = await call("POST", "/api/auth/login", { body: { password: PASSWORD } });
  assert.equal(login.status, 200, "test login must work");
  cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
});

after(() => server?.kill());

describe("logged-out visitors", () => {
  test("pages send you to the login screen", async () => {
    const res = await call("GET", "/");
    assert.ok([307, 308].includes(res.status));
    assert.ok(res.headers.get("location").endsWith("/login"));
  });

  const PROTECTED = [
    ["GET", "/api/modules/weather"], ["GET", "/api/modules/tasks"], ["GET", "/api/modules/notes"], ["GET", "/api/modules/monitor"],
    ["GET", "/api/modules/rss"], ["GET", "/api/modules/inbox"], ["GET", "/api/modules/calendar"],
    ["POST", "/api/tasks"], ["PATCH", `/api/tasks/${ID}`], ["DELETE", `/api/tasks/${ID}`],
    ["POST", "/api/notes"], ["DELETE", `/api/notes/${ID}`],
    ["POST", "/api/feeds"], ["DELETE", `/api/feeds/${ID}`],
    ["POST", "/api/events"], ["DELETE", `/api/events/${ID}`],
    ["POST", "/api/calendar/sources"], ["DELETE", `/api/calendar/sources/${ID}`],
    ["POST", "/api/monitor/sites"], ["DELETE", `/api/monitor/sites/${ID}`], ["POST", "/api/monitor/check"],
    ["PATCH", `/api/approvals/${ID}`], ["POST", "/api/auth/logout"],
  ];
  for (const [method, path] of PROTECTED) {
    test(`${method} ${path} is blocked`, async () => {
      const res = await call(method, path, { body: method === "GET" ? undefined : {} });
      assert.equal(res.status, 401);
    });
  }
});

describe("open doors guard themselves", () => {
  test("the login page loads", async () => assert.equal((await call("GET", "/login")).status, 200));
  test("a wrong password is refused", async () => assert.equal((await call("POST", "/api/auth/login", { body: { password: "nope" }, headers: { "x-forwarded-for": "198.51.100.1" } })).status, 401));
  test("the inbox needs its token", async () => {
    assert.equal((await call("POST", "/api/inbox", { body: { title: "x" } })).status, 401);
    assert.equal((await call("POST", "/api/inbox", { body: { title: "x" }, headers: { authorization: "Bearer wrong-wrong-wrong-wrong-wrong" } })).status, 401);
    assert.equal((await call("GET", "/api/inbox")).status, 401);
  });
  test("the inbox rejects bad bodies even with the token", async () => {
    const auth = { authorization: `Bearer ${SENTINELS.INBOX_TOKEN}` };
    assert.equal((await call("POST", "/api/inbox", { body: { draft: "no title" }, headers: auth })).status, 400);
    assert.equal((await call("POST", "/api/inbox", { body: { title: "x", draft: "a".repeat(20000) }, headers: auth })).status, 413);
    assert.equal((await call("POST", "/api/inbox", { body: "not json", headers: auth })).status, 400);
  });
  test("the cron route needs its secret", async () => {
    assert.equal((await call("GET", "/api/cron/monitor")).status, 401);
    assert.equal((await call("GET", "/api/cron/monitor", { headers: { authorization: "Bearer wrong" } })).status, 401);
  });
  test("too many wrong passwords lock the door", async () => {
    const headers = { "x-forwarded-for": "203.0.113.77" };
    let last = 0;
    for (let i = 0; i < 7; i++) last = (await call("POST", "/api/auth/login", { body: { password: "nope" }, headers })).status;
    assert.equal(last, 429);
  });
});

describe("logged-in visitors", () => {
  test("the session cookie is locked down", async () => {
    const res = await call("POST", "/api/auth/login", { body: { password: PASSWORD } });
    const raw = res.headers.getSetCookie().join(";").toLowerCase();
    assert.ok(raw.includes("httponly"));
    assert.ok(raw.includes("samesite=strict"));
  });
  test("the main page loads", async () => assert.equal((await call("GET", "/", { authed: true })).status, 200));
  test("writes from another site are refused", async () => {
    const forms = [
      ["POST", "/api/tasks", { title: "x" }], ["POST", "/api/notes", { text: "x" }], ["POST", "/api/feeds", { url: "https://example.com/feed" }],
      ["POST", "/api/events", { title: "x", day: "2026-10-13" }], ["POST", "/api/calendar/sources", { url: "https://example.com/a.ics" }],
      ["POST", "/api/monitor/sites", { url: "https://example.com" }], ["POST", "/api/monitor/check", {}], ["PATCH", `/api/approvals/${ID}`, { action: "approve" }],
      ["DELETE", `/api/tasks/${ID}`, undefined],
    ];
    for (const [method, path, body] of forms) {
      assert.equal((await call(method, path, { authed: true, body })).status, 403, `${method} ${path} without Origin`);
      assert.equal((await call(method, path, { authed: true, body, headers: { origin: "https://evil.example" } })).status, 403, `${method} ${path} from another site`);
    }
  });
  test("malformed ids and bodies are refused with the right codes", async () => {
    const same = { origin: base };
    assert.equal((await call("DELETE", "/api/tasks/not-a-uuid", { authed: true, headers: same })).status, 404);
    assert.equal((await call("PATCH", "/api/approvals/not-a-uuid", { authed: true, headers: same, body: { action: "approve" } })).status, 404);
    assert.equal((await call("PATCH", `/api/approvals/${ID}`, { authed: true, headers: same, body: { action: "delete" } })).status, 400);
    assert.equal((await call("POST", "/api/events", { authed: true, headers: same, body: { title: "x", day: "2026-02-30" } })).status, 400);
    for (const url of ["http://example.com", "https://localhost", "https://127.0.0.1", "https://169.254.169.254/x", "https://10.0.0.1/a", "https://intranet/a", "https://u:p@example.com/a", "https://example.com:8443/a"]) {
      assert.equal((await call("POST", "/api/feeds", { authed: true, headers: same, body: { url } })).status, 400, url);
      assert.equal((await call("POST", "/api/monitor/sites", { authed: true, headers: same, body: { url } })).status, 400, url);
      assert.equal((await call("POST", "/api/calendar/sources", { authed: true, headers: same, body: { url } })).status, 400, url);
    }
  });
});

describe("secrets stay on the server", () => {
  const values = Object.values(SENTINELS).flatMap((v) => (v.startsWith("https://") ? [v, new URL(v).hostname] : [v]));
  const leaks = (text) => values.filter((v) => text.includes(v));

  test("nothing in the pages or panel data contains a secret", async () => {
    const paths = ["/login", "/", "/api/modules/weather", "/api/modules/tasks", "/api/modules/notes", "/api/modules/monitor", "/api/modules/rss", "/api/modules/inbox", "/api/modules/calendar"];
    for (const path of paths) {
      const res = await call("GET", path, { authed: true });
      assert.deepEqual(leaks(await res.text()), [], path);
    }
  });
  test("error answers do not contain a secret", async () => {
    const same = { origin: base };
    for (const [method, path, body] of [["POST", "/api/tasks", { title: "x" }], ["POST", "/api/inbox", { title: "x" }], ["GET", "/api/cron/monitor", undefined], ["POST", "/api/monitor/check", {}]]) {
      const res = await call(method, path, { authed: true, headers: path === "/api/cron/monitor" ? { authorization: `Bearer ${SENTINELS.CRON_SECRET}` } : path === "/api/inbox" ? { authorization: `Bearer ${SENTINELS.INBOX_TOKEN}`, ...same } : same, body });
      assert.deepEqual(leaks(await res.text()), [], `${method} ${path}`);
    }
  });
  test("nothing in the files sent to the browser contains a secret", () => {
    const found = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(js|css|html|json|txt|map)$/.test(name)) found.push(...leaks(readFileSync(full, "utf8")).map((v) => `${v} in ${full}`));
      }
    };
    walk(".next/static");
    assert.deepEqual(found, []);
  });
});

describe("the repository", () => {
  test("no secret files are tracked", () => {
    const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
    assert.deepEqual(files.filter((f) => /(^|\/)\.env/.test(f) && !f.endsWith(".env.example")), []);
  });
  test("no key-looking strings are tracked", () => {
    const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter((f) => f && !f.endsWith("package-lock.json") && !/\.(png|jpg|svg|webp|ico)$/.test(f));
    const hits = files.filter((f) => /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}/.test(readFileSync(f, "utf8")));
    assert.deepEqual(hits, []);
  });
  test("the words kept out of the repository do not appear", () => {
    const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter((f) => f && !f.endsWith("package-lock.json") && !/\.(png|jpg|svg|webp|ico)$/.test(f));
    const banned = new RegExp(["cl" + "aude", "\\b" + "A" + "I\\b", "generated " + "by", "LL" + "M"].join("|"), "i");
    assert.deepEqual(files.filter((f) => banned.test(readFileSync(f, "utf8")) || banned.test(f)), []);
  });
});
