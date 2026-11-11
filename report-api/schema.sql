CREATE TABLE IF NOT EXISTS reports (
  fingerprint TEXT PRIMARY KEY,
  issue_url TEXT NOT NULL,
  issue_number INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key_hash TEXT NOT NULL,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key_hash, bucket)
);
