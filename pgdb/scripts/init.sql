
-- Create kv table if it doesn't exist
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value JSONB
);