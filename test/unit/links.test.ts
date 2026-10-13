import { env } from "cloudflare:workers";
import { exports } from "cloudflare:workers";
import { describe, it, expect } from "vitest";

const call = (path: string, init?: RequestInit) =>
  exports.default.fetch(new Request(`http://x${path}`, { redirect: "manual", ...init }));
const create = (body: unknown) =>
  call("/api/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("links", () => {
  it("POST /api/links creates a link", async () => {
    const r = await create({ url: "https://example.com/a?b=1#c" });
    expect(r.status).toBe(201);
    const j = await r.json<{ slug: string; url: string; short_url: string }>();
    expect(j.slug).toMatch(/^[A-Za-z0-9]{7}$/);
    expect(j.url).toBe("https://example.com/a?b=1#c");
    expect(j.short_url).toBe(`http://x/${j.slug}`);
    const row = await env.DB.prepare("SELECT url FROM links WHERE slug = ?").bind(j.slug).first<{ url: string }>();
    expect(row?.url).toBe(j.url);
  });
  it("slugs are unique", async () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 20; i++) slugs.add((await (await create({ url: "http://e.com" })).json<{ slug: string }>()).slug);
    expect(slugs.size).toBe(20);
  });
  it("rejects invalid urls", async () => {
    expect((await create({ url: "ftp://e.com" })).status).toBe(400);
    expect((await create({ url: "nope" })).status).toBe(400);
    expect((await create({})).status).toBe(400);
    expect((await call("/api/links", { method: "POST", body: "not json" })).status).toBe(400);
  });
  it("GET /<slug> redirects 302 to exact url", async () => {
    const url = "https://example.com/a?b=1&c=%20d#frag";
    const { slug } = await (await create({ url })).json<{ slug: string }>();
    const r = await call(`/${slug}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("Location")).toBe(url);
  });
  it("GET unknown slug -> 404", async () => {
    expect((await call("/zzzzzzz")).status).toBe(404);
  });
  it("healthz and version still work", async () => {
    expect((await call("/healthz")).status).toBe(200);
    expect(await (await call("/version")).text()).toBe("dev");
  });
});

describe("link stats", () => {
  const auth = { authorization: "Bearer test-admin-token" };
  it("counts redirects atomically", async () => {
    const { slug } = await (await create({ url: "https://example.com/s" })).json<{ slug: string }>();
    await Promise.all(Array.from({ length: 10 }, () => call(`/${slug}`)));
    const r = await call(`/api/links/${slug}`, { headers: auth });
    expect(r.status).toBe(200);
    const j = await r.json<{ slug: string; url: string; hits: number; created_at: string }>();
    expect(j.slug).toBe(slug);
    expect(j.url).toBe("https://example.com/s");
    expect(j.hits).toBe(10);
    expect(typeof j.created_at).toBe("string");
  });
  it("does not count unknown slugs and returns 404", async () => {
    expect((await call("/zzzzzzz")).status).toBe(404);
    expect((await call("/api/links/zzzzzzz", { headers: auth })).status).toBe(404);
  });
  it("requires the admin token", async () => {
    const { slug } = await (await create({ url: "https://example.com/t" })).json<{ slug: string }>();
    expect((await call(`/api/links/${slug}`)).status).toBe(401);
    expect((await call(`/api/links/${slug}`, { headers: { authorization: "Bearer wrong" } })).status).toBe(401);
    expect((await call(`/api/links/${slug}`, { headers: { authorization: "test-admin-token" } })).status).toBe(401);
    expect((await call("/api/links/zzzzzzz")).status).toBe(401);
  });
});
