import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeEach } from "vitest";

const call = (path: string, init?: RequestInit) =>
  exports.default.fetch(new Request(`http://x${path}`, { redirect: "manual", ...init }));
const auth = { authorization: "Bearer test-admin-token" };

type Page = { links: { slug: string; url: string; hits: number; created_at: string }[]; next_cursor: string | null };

async function seed(slug: string, created_at: string) {
  await env.DB.prepare("INSERT INTO links (slug, url, created_at) VALUES (?, ?, ?)")
    .bind(slug, `https://e.com/${slug}`, created_at).run();
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM links").run();
});

describe("admin auth", () => {
  it("rejects missing/wrong token with 401 and changes nothing", async () => {
    await seed("aaaaaaa", "2026-01-01T00:00:00.000Z");
    expect((await call("/api/links")).status).toBe(401);
    expect((await call("/api/links", { headers: { authorization: "Bearer nope" } })).status).toBe(401);
    expect((await call("/api/links/aaaaaaa", { method: "DELETE" })).status).toBe(401);
    expect((await call("/api/links/aaaaaaa", { method: "DELETE", headers: { authorization: "Bearer x" } })).status).toBe(401);
    expect((await call("/aaaaaaa")).status).toBe(302);
  });
});

describe("DELETE /api/links/:slug", () => {
  it("deletes and then 404s", async () => {
    await seed("aaaaaaa", "2026-01-01T00:00:00.000Z");
    expect((await call("/api/links/aaaaaaa", { method: "DELETE", headers: auth })).status).toBe(204);
    expect((await call("/aaaaaaa")).status).toBe(404);
    expect((await call("/api/links/aaaaaaa", { headers: auth })).status).toBe(404);
    expect((await call("/api/links/aaaaaaa", { method: "DELETE", headers: auth })).status).toBe(404);
  });
});

describe("GET /api/links", () => {
  it("lists newest first with ties by insertion order and paginates", async () => {
    await seed("s1", "2026-01-01T00:00:00.000Z");
    await seed("s2", "2026-01-02T00:00:00.000Z");
    await seed("s3", "2026-01-02T00:00:00.000Z");
    await seed("s4", "2026-01-02T00:00:00.000Z");
    await seed("s5", "2026-01-03T00:00:00.000Z");
    const all = await (await call("/api/links", { headers: auth })).json<Page>();
    expect(all.links.map((l) => l.slug)).toEqual(["s5", "s4", "s3", "s2", "s1"]);
    expect(all.next_cursor).toBeNull();
    expect(Object.keys(all.links[0]).sort()).toEqual(["created_at", "hits", "slug", "url"]);

    const got: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 10; i++) {
      const q: string = `/api/links?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const p: Page = await (await call(q, { headers: auth })).json<Page>();
      got.push(...p.links.map((l) => l.slug));
      cursor = p.next_cursor;
      if (!cursor) break;
      expect(p.links.length).toBe(2);
    }
    expect(got).toEqual(["s5", "s4", "s3", "s2", "s1"]);
  });
  it("next_cursor null when exactly one full page", async () => {
    await seed("s1", "2026-01-01T00:00:00.000Z");
    await seed("s2", "2026-01-02T00:00:00.000Z");
    const p = await (await call("/api/links?limit=2", { headers: auth })).json<Page>();
    expect(p.links.length).toBe(2);
    expect(p.next_cursor).toBeNull();
  });
  it("validates limit and cursor; defaults to 20", async () => {
    for (let i = 0; i < 25; i++) await seed(`d${i}`, `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`);
    const p = await (await call("/api/links", { headers: auth })).json<Page>();
    expect(p.links.length).toBe(20);
    expect(p.next_cursor).not.toBeNull();
    for (const l of ["0", "101", "abc", "-1"]) expect((await call(`/api/links?limit=${l}`, { headers: auth })).status).toBe(400);
    expect((await call("/api/links?cursor=garbage", { headers: auth })).status).toBe(400);
  });
});
