import { exports } from "cloudflare:workers";
import { describe, it, expect } from "vitest";

describe("home page", () => {
  it("GET / serves the shorten form", async () => {
    const r = await exports.default.fetch(new Request("http://x/"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
    const html = await r.text();
    expect(html).toMatch(/<form[^>]*data-testid="shorten-form"/);
    expect(html).toMatch(/<input[^>]*name="url"[^>]*data-testid="url-input"|<input[^>]*data-testid="url-input"[^>]*name="url"/);
    expect(html).toMatch(/<button[^>]*data-testid="shorten-submit"/);
  });
});
