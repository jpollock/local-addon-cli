-- LWP Analytics Schema
-- Stores anonymous CLI usage events

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
  received_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_installation ON events(installation_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_command ON events(command);
CREATE INDEX IF NOT EXISTS idx_cli_version ON events(cli_version);
