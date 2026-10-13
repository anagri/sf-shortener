import { env } from "cloudflare:workers";
import { exports } from "cloudflare:workers";   // primary API; `SELF` from cloudflare:test is deprecated, use only if `exports` is missing
import { describe, it, expect } from "vitest";

const fetchApp = (path: string) => exports.default.fetch(new Request(`http://x${path}`));

describe("skeleton", () => {
  it("GET /healthz -> ok", async () => {
    const r = await fetchApp("/healthz");
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("ok");
  });
  it("GET /version -> BUILD_SHA var", async () => {
    expect(await (await fetchApp("/version")).text()).toBe("dev");
  });
  it("D1 migrations applied", async () => {
    await env.DB.prepare("INSERT INTO _meta (k, v) VALUES (?, ?)").bind("t", "1").run();
    const row = await env.DB.prepare("SELECT v FROM _meta WHERE k = ?").bind("t").first<{ v: string }>();
    expect(row?.v).toBe("1");
  });
});
