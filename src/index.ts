import { Hono } from "hono";

export type Bindings = { DB: D1Database; ASSETS: Fetcher; BUILD_SHA: string; ADMIN_TOKEN?: string };
const app = new Hono<{ Bindings: Bindings }>();

app.get("/healthz", (c) => c.text("ok"));
app.get("/version", (c) => c.text(c.env.BUILD_SHA || "dev"));

export default app;
