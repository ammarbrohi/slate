-- Idempotent schema: safe to re-run on every deploy/boot.
-- (Legacy one-off: if migrating from the old anonymous-projects design,
--  manually `DROP TABLE projects CASCADE;` once — not done here so a restart
--  never destroys live data.)

-- Users: thin mirror of Clerk identities (for invite-by-email + display).
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,         -- Clerk user id (sub)
  email       TEXT,
  name        TEXT,
  avatar_url  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));

-- Teams: a group of users that can collectively own boards.
CREATE TABLE IF NOT EXISTS teams (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT,
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- additive for existing DBs (idempotent)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS icon TEXT;

CREATE TABLE IF NOT EXISTS team_members (
  team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member',  -- owner | member
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- Boards: a synced, realtime Excalidraw scene.
CREATE TABLE IF NOT EXISTS boards (
  id                 TEXT PRIMARY KEY,        -- also the realtime room id
  name               TEXT NOT NULL DEFAULT 'Untitled',
  owner_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id            TEXT REFERENCES teams(id) ON DELETE SET NULL,
  room_key           TEXT NOT NULL,           -- per-board E2E key
  -- public link sharing (optional; original password-link feature)
  share_slug         TEXT UNIQUE,
  share_pw_hash      TEXT,
  -- encrypted scene snapshot (client-side E2E, server never decrypts)
  scene_version      INTEGER NOT NULL DEFAULT 0,
  scene_iv           BYTEA,
  scene_cipher       BYTEA,
  -- card/board background: an image URL, or NULL for the auto gradient
  background         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE boards ADD COLUMN IF NOT EXISTS background TEXT;
CREATE INDEX IF NOT EXISTS boards_owner_idx ON boards (owner_id);
CREATE INDEX IF NOT EXISTS boards_team_idx ON boards (team_id);

-- Per-user individual board shares.
CREATE TABLE IF NOT EXISTS board_members (
  board_id  TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'editor',   -- editor | viewer
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

-- Pending board invites: share a board with an email before they have an
-- account. Claimed (-> board_members) on first sign-in with a matching email.
CREATE TABLE IF NOT EXISTS board_invites (
  board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'editor',
  invited_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, email)
);
CREATE INDEX IF NOT EXISTS board_invites_email_idx ON board_invites (lower(email));

-- Pending team invites: invite an email before they have an account.
-- Claimed (-> team_members) the first time a user signs in with a matching email.
CREATE TABLE IF NOT EXISTS team_invites (
  team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  invited_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, email)
);
CREATE INDEX IF NOT EXISTS team_invites_email_idx ON team_invites (lower(email));

-- Bruteforce protection for the public link+password path.
CREATE TABLE IF NOT EXISTS access_attempts (
  board_id      TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  ip            TEXT NOT NULL,
  failed_count  INTEGER NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, ip)
);
