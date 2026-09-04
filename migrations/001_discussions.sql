CREATE TABLE discussion_items (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('lesson', 'example')),
  title text NOT NULL,
  source_url text,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE comments (
  id uuid PRIMARY KEY,
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  discussion_id text NOT NULL REFERENCES discussion_items(id),
  parent_id uuid,
  display_name text,
  body text,
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  request_id uuid NOT NULL UNIQUE,
  request_hash text NOT NULL,
  UNIQUE (id, discussion_id),
  FOREIGN KEY (parent_id, discussion_id) REFERENCES comments(id, discussion_id),
  CHECK (parent_id IS NULL OR parent_id <> id),
  CHECK ((deleted_at IS NULL AND display_name IS NOT NULL AND body IS NOT NULL AND char_length(display_name) BETWEEN 1 AND 60 AND char_length(body) BETWEEN 1 AND 5000)
      OR (deleted_at IS NOT NULL AND display_name IS NULL AND body IS NULL))
);
CREATE INDEX comments_discussion_sequence ON comments (discussion_id, sequence);
CREATE INDEX comments_parent ON comments (parent_id);

CREATE TABLE owner_sessions (
  token_hash text PRIMARY KEY,
  credential_version text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX owner_sessions_expiry ON owner_sessions (expires_at);

CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits (expires_at);
