import { Hono } from "hono";
import { createMiddleware } from "hono/factory";

export type Bindings = { DB: D1Database; ASSETS: Fetcher; BUILD_SHA: string; ADMIN_TOKEN?: string };
const app = new Hono<{ Bindings: Bindings }>();

app.get("/healthz", (c) => c.text("ok"));
app.get("/version", (c) => c.text(c.env.BUILD_SHA || "dev"));

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function genSlug(): string {
  const out: string[] = [];
  while (out.length < 7) {
    const b = crypto.getRandomValues(new Uint8Array(1))[0];
    if (b < 248) out.push(ALPHABET[b % 62]); // 248 = 62*4, avoids modulo bias
  }
  return out.join("");
}

function isHttpUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

app.post("/api/links", async (c) => {
  const body = await c.req.json().catch(() => null);
  const url = body && typeof body === "object" ? (body as { url?: unknown }).url : undefined;
  if (!isHttpUrl(url)) return c.json({ error: "url must be an absolute http or https URL" }, 400);
  for (let i = 0; i < 5; i++) {
    const slug = genSlug();
    const res = await c.env.DB.prepare("INSERT OR IGNORE INTO links (slug, url) VALUES (?, ?)").bind(slug, url).run();
    if (res.meta.changes === 1) {
      return c.json({ slug, url, short_url: `${new URL(c.req.url).origin}/${slug}` }, 201);
    }
  }
  return c.json({ error: "could not allocate slug" }, 500);
});

async function digest(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

async function tokenOk(header: string | undefined, expected: string | undefined): Promise<boolean> {
  const m = /^Bearer (.+)$/.exec(header ?? "");
  const [a, b] = await Promise.all([digest(m ? m[1] : ""), digest(expected ?? "")]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0 && !!m && !!expected;
}

const admin = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  if (!(await tokenOk(c.req.header("Authorization"), c.env.ADMIN_TOKEN))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

app.get("/api/links", admin, async (c) => {
  const limitRaw = c.req.query("limit");
  let limit = 20;
  if (limitRaw !== undefined) {
    if (!/^\d+$/.test(limitRaw)) return c.json({ error: "invalid limit" }, 400);
    limit = Number(limitRaw);
    if (limit < 1 || limit > 100) return c.json({ error: "invalid limit" }, 400);
  }
  const cursorRaw = c.req.query("cursor");
  let after: { t: string; r: number } | null = null;
  if (cursorRaw) {
    try {
      const v = JSON.parse(atob(cursorRaw.replace(/-/g, "+").replace(/_/g, "/")));
      if (typeof v.t !== "string" || !Number.isInteger(v.r)) throw new Error("bad");
      after = v;
    } catch {
      return c.json({ error: "invalid cursor" }, 400);
    }
  }
  const base = "SELECT rowid AS rid, slug, url, hits, created_at FROM links";
  const order = " ORDER BY created_at DESC, rowid DESC LIMIT ?";
  const stmt = after
    ? c.env.DB.prepare(`${base} WHERE created_at < ? OR (created_at = ? AND rowid < ?)${order}`).bind(after.t, after.t, after.r, limit + 1)
    : c.env.DB.prepare(`${base}${order}`).bind(limit + 1);
  const { results } = await stmt.all<{ rid: number; slug: string; url: string; hits: number; created_at: string }>();
  const page = results.slice(0, limit);
  let next_cursor: string | null = null;
  if (results.length > limit) {
    const last = page[page.length - 1];
    next_cursor = btoa(JSON.stringify({ t: last.created_at, r: last.rid })).replace(/\+/g, "-").replace(/\//g, "_");
  }
  return c.json({
    links: page.map(({ slug, url, hits, created_at }) => ({ slug, url, hits, created_at })),
    next_cursor,
  });
});

app.delete("/api/links/:slug", admin, async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM links WHERE slug = ?").bind(c.req.param("slug")).run();
  if (res.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.body(null, 204);
});

app.get("/api/links/:slug", async (c) => {
  if (!(await tokenOk(c.req.header("Authorization"), c.env.ADMIN_TOKEN))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const row = await c.env.DB.prepare("SELECT slug, url, hits, created_at FROM links WHERE slug = ?")
    .bind(c.req.param("slug"))
    .first();
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

app.get("/:slug", async (c) => {
  const row = await c.env.DB.prepare("SELECT url FROM links WHERE slug = ?")
    .bind(c.req.param("slug"))
    .first<{ url: string }>();
  if (!row) return c.text("not found", 404);
  await c.env.DB.prepare("UPDATE links SET hits = hits + 1 WHERE slug = ?").bind(c.req.param("slug")).run();
  return new Response(null, { status: 302, headers: { Location: row.url } });
});

export default app;
