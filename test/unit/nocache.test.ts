import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("no-store on health and version", () => {
  for (const path of ["/healthz", "/version"]) {
    it(`GET ${path} sends cache-control: no-store`, async () => {
      const r = await SELF.fetch(`http://x.test${path}`);
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("no-store");
      await r.text();
    });
  }
});
