import { exports } from "cloudflare:workers";
import { describe, it, expect } from "vitest";

const create = (body: unknown) =>
  exports.default.fetch(
    new Request("http://x/api/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  );

describe("destination URL validation", () => {
  it("rejects non-http(s), unparsable, empty and missing urls", async () => {
    for (const url of ["javascript:alert(1)", "ftp://a.com/x", "data:text/plain,hi", "not a url", "/relative", "", undefined, 5]) {
      expect((await create({ url })).status).toBe(400);
    }
  });
  it("enforces 2048 char limit", async () => {
    const base = "https://example.com/";
    expect((await create({ url: base + "a".repeat(2048 - base.length) })).status).toBe(201);
    expect((await create({ url: base + "a".repeat(2049 - base.length) })).status).toBe(400);
  });
  it("rejects own hostname", async () => {
    expect((await create({ url: "http://x/abc" })).status).toBe(400);
    expect((await create({ url: "https://X./abc" })).status).toBe(400);
  });
  it("accepts valid https url", async () => {
    expect((await create({ url: "https://example.com/path?q=1" })).status).toBe(201);
  });
});
