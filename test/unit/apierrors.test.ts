import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("api JSON errors", () => {
  it("404 JSON for unknown api routes", async () => {
    for (const p of ["/api/nope", "/api/links/a/b", "/api/x/y/z"]) {
      const r = await SELF.fetch("http://x.test" + p);
      expect(r.status).toBe(404);
      expect(r.headers.get("content-type")).toContain("application/json");
      expect(typeof ((await r.json()) as { error: string }).error).toBe("string");
    }
    const r = await SELF.fetch("http://x.test/api/nope", { method: "POST" });
    expect(r.status).toBe(404);
  });
  it("405 JSON for unsupported methods", async () => {
    for (const [m, p] of [["PUT", "/api/links"], ["DELETE", "/api/links"], ["PUT", "/api/links/abc"], ["POST", "/api/links/abc"]]) {
      const r = await SELF.fetch("http://x.test" + p, { method: m });
      expect(r.status).toBe(405);
      expect(r.headers.get("content-type")).toContain("application/json");
      expect(typeof ((await r.json()) as { error: string }).error).toBe("string");
    }
  });
  it("existing routes unchanged", async () => {
    expect((await SELF.fetch("http://x.test/healthz")).status).toBe(200);
    expect((await SELF.fetch("http://x.test/api/links")).status).toBe(401);
    expect((await SELF.fetch("http://x.test/zzzzzz")).status).toBe(404);
  });
});
