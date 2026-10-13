CREATE TABLE links (
  slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  permanent INTEGER NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_links_created_at ON links (created_at);
