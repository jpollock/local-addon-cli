-- LWP Analytics Schema
-- Stores anonymous CLI usage events with HMAC authentication

-- Installations table: stores secret keys for signature verification
CREATE TABLE IF NOT EXISTS installations (
  installation_id TEXT PRIMARY KEY,
  secret_key TEXT NOT NULL,
  registered_at TEXT NOT NULL
);

-- Events table: stores usage analytics
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  installation_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  command TEXT NOT NULL,
  success INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  error_category TEXT,
  cli_version TEXT NOT NULL,
  os TEXT NOT NULL,
  node_version TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  received_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (installation_id) REFERENCES installations(installation_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_events_installation ON events(installation_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_command ON events(command);
CREATE INDEX IF NOT EXISTS idx_events_cli_version ON events(cli_version);
