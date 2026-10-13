import { env } from "cloudflare:workers";
import { exports } from "cloudflare:workers";
import { describe, it, expect } from "vitest";

const call = (path: string, init?: RequestInit) =>
  exports.default.fetch(new Request(`http://x${path}`, { redirect: "manual", ...init }));
const create = (body: unknown) =>
  call("/api/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("custom slugs and permanent redirects", () => {
  it("stores and returns a custom slug", async () => {
    const r = await create({ url: "https://example.com/x", slug: "my-slug_1" });
    expect(r.status).toBe(201);
    expect((await r.json<{ slug: string }>()).slug).toBe("my-slug_1");
    const row = await env.DB.prepare("SELECT url FROM links WHERE slug = ?").bind("my-slug_1").first();
    expect(row).toBeTruthy();
  });
  it("rejects invalid or reserved slugs", async () => {
    for (const slug of ["ab", "a".repeat(33), "bad slug", "bad.slug", "api", "healthz", "version", 5, ""]) {
      expect((await create({ url: "https://e.com", slug })).status).toBe(400);
    }
    expect((await create({ url: "https://e.com", slug: "abc" })).status).toBe(201);
    expect((await create({ url: "https://e.com", slug: "a".repeat(32) })).status).toBe(201);
  });
  it("rejects non-boolean permanent", async () => {
    expect((await create({ url: "https://e.com", permanent: "yes" })).status).toBe(400);
  });
  it("409 on duplicate and leaves existing unchanged", async () => {
    expect((await create({ url: "https://first.com/", slug: "dupe" })).status).toBe(201);
    expect((await create({ url: "https://second.com/", slug: "dupe", permanent: true })).status).toBe(409);
    const r = await call("/dupe");
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("https://first.com/");
  });
  it("redirects 302 by default and 301 when permanent", async () => {
    const url = "https://example.com/a?b=1&c=%20d#frag";
    await create({ url, slug: "temp1" });
    await create({ url, slug: "perm1", permanent: true });
    const a = await call("/temp1");
    expect(a.status).toBe(302);
    expect(a.headers.get("Location")).toBe(url);
    const b = await call("/perm1");
    expect(b.status).toBe(301);
    expect(b.headers.get("Location")).toBe(url);
    const g = await (await create({ url, permanent: true })).json<{ slug: string }>();
    expect((await call(`/${g.slug}`)).status).toBe(301);
  });
});
