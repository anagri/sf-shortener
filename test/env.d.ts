declare global {
  namespace Cloudflare {
    interface Env { TEST_MIGRATIONS: import("cloudflare:test").D1Migration[] }
    // types `exports` from cloudflare:workers (exports.default.fetch in tests)
    interface GlobalProps { mainModule: typeof import("../src/index") }
  }
}
export {};
