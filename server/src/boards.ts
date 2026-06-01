import { randomBytes } from "node:crypto";

import { hashPassword } from "./auth";
import { query } from "./db";
import { env } from "./env";

const genId = () => randomBytes(10).toString("hex");
const genRoomKey = () => randomBytes(16).toString("base64url").slice(0, 22);
const genSlug = () => randomBytes(9).toString("base64url");

export type BoardRow = {
  id: string;
  name: string;
  owner_id: string;
  team_id: string | null;
  room_key: string;
  share_slug: string | null;
  share_pw_hash: string | null;
  scene_version: number;
  scene_iv: Buffer | null;
  scene_cipher: Buffer | null;
  updated_at: Date;
};

export type BoardAccess = "owner" | "member" | "team" | "link" | null;

export const createBoard = async (
  ownerId: string,
  name: string,
  teamId: string | null,
  background: string | null = null,
): Promise<BoardRow> => {
  const id = genId();
  const { rows } = await query<BoardRow>(
    `INSERT INTO boards (id, name, owner_id, team_id, room_key, background)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, name || "Untitled", ownerId, teamId, genRoomKey(), background],
  );
  return rows[0];
};

export const getBoard = async (id: string): Promise<BoardRow | null> => {
  const { rows } = await query<BoardRow>("SELECT * FROM boards WHERE id = $1", [
    id,
  ]);
  return rows[0] ?? null;
};

export const getBoardBySlug = async (
  slug: string,
): Promise<BoardRow | null> => {
  const { rows } = await query<BoardRow>(
    "SELECT * FROM boards WHERE share_slug = $1",
    [slug],
  );
  return rows[0] ?? null;
};

// What access does this user have to this board?
export const accessFor = async (
  board: BoardRow,
  userId: string,
): Promise<BoardAccess> => {
  if (board.owner_id === userId) {
    return "owner";
  }
  const member = await query(
    "SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2",
    [board.id, userId],
  );
  if (member.rowCount! > 0) {
    return "member";
  }
  if (board.team_id) {
    const team = await query(
      "SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2",
      [board.team_id, userId],
    );
    if (team.rowCount! > 0) {
      return "team";
    }
  }
  return null;
};

// Boards visible to a user: owned + individually shared + via team membership.
export const listBoardsForUser = async (userId: string) => {
  const { rows } = await query(
    `SELECT b.id, b.name, b.owner_id, b.team_id, b.updated_at, b.share_slug,
            b.background,
            CASE
              WHEN b.owner_id = $1 THEN 'owner'
              WHEN bm.user_id IS NOT NULL THEN 'member'
              ELSE 'team'
            END AS access
       FROM boards b
       LEFT JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = $1
       LEFT JOIN team_members tm ON tm.team_id = b.team_id AND tm.user_id = $1
      WHERE b.owner_id = $1 OR bm.user_id IS NOT NULL OR tm.user_id IS NOT NULL
      ORDER BY b.updated_at DESC`,
    [userId],
  );
  return rows as Array<{
    id: string;
    name: string;
    owner_id: string;
    team_id: string | null;
    updated_at: Date;
    share_slug: string | null;
    background: string | null;
    access: string;
  }>;
};

export const renameBoard = async (id: string, name: string): Promise<void> => {
  await query("UPDATE boards SET name = $2, updated_at = now() WHERE id = $1", [
    id,
    name,
  ]);
};

// Set (or clear, with null) the board background image URL.
export const setBoardBackground = async (
  id: string,
  background: string | null,
): Promise<void> => {
  await query(
    "UPDATE boards SET background = $2, updated_at = now() WHERE id = $1",
    [id, background],
  );
};

export const deleteBoard = async (id: string): Promise<void> => {
  await query("DELETE FROM boards WHERE id = $1", [id]);
};

export const saveScene = async (
  boardId: string,
  sceneVersion: number,
  iv: Buffer,
  cipher: Buffer,
): Promise<void> => {
  await query(
    `UPDATE boards
       SET scene_version = $2, scene_iv = $3, scene_cipher = $4, updated_at = now()
     WHERE id = $1 AND $2 >= scene_version`,
    [boardId, sceneVersion, iv, cipher],
  );
};

// ---- Sharing ---------------------------------------------------------------

export const addMember = async (
  boardId: string,
  userId: string,
  role = "editor",
): Promise<void> => {
  await query(
    `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [boardId, userId, role],
  );
};

export const removeMember = async (
  boardId: string,
  userId: string,
): Promise<void> => {
  await query(
    "DELETE FROM board_members WHERE board_id = $1 AND user_id = $2",
    [boardId, userId],
  );
};

export const listMembers = async (boardId: string) => {
  const { rows } = await query<{ user_id: string; role: string }>(
    "SELECT user_id, role FROM board_members WHERE board_id = $1",
    [boardId],
  );
  return rows;
};

// ---- pending board invites (share before the invitee has an account) ------

export const addBoardInvite = async (
  boardId: string,
  email: string,
  role: string,
  invitedBy: string,
): Promise<void> => {
  await query(
    `INSERT INTO board_invites (board_id, email, role, invited_by)
       VALUES ($1, $2, $3, $4)
     ON CONFLICT (board_id, email) DO UPDATE SET role = EXCLUDED.role`,
    [boardId, email.toLowerCase(), role, invitedBy],
  );
};

export const listBoardInvites = async (
  boardId: string,
): Promise<Array<{ email: string; role: string }>> => {
  const { rows } = await query<{ email: string; role: string }>(
    "SELECT email, role FROM board_invites WHERE board_id = $1 ORDER BY created_at",
    [boardId],
  );
  return rows;
};

export const cancelBoardInvite = async (
  boardId: string,
  email: string,
): Promise<void> => {
  await query(
    "DELETE FROM board_invites WHERE board_id = $1 AND lower(email) = lower($2)",
    [boardId, email],
  );
};

// On sign-in: turn pending board invites for this email into memberships.
export const claimBoardInvites = async (
  userId: string,
  email: string,
): Promise<void> => {
  const { rows } = await query<{ board_id: string; role: string }>(
    "SELECT board_id, role FROM board_invites WHERE lower(email) = lower($1)",
    [email],
  );
  for (const { board_id, role } of rows) {
    await query(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (board_id, user_id) DO NOTHING`,
      [board_id, userId, role],
    );
  }
  await query("DELETE FROM board_invites WHERE lower(email) = lower($1)", [
    email,
  ]);
};

// Enable/refresh public link. Empty password => link with no password.
export const enableLink = async (
  boardId: string,
  password: string | null,
  existingSlug: string | null,
): Promise<string> => {
  const slug = existingSlug ?? genSlug();
  const hash = password ? await hashPassword(password) : null;
  await query(
    "UPDATE boards SET share_slug = $2, share_pw_hash = $3 WHERE id = $1",
    [boardId, slug, hash],
  );
  return slug;
};

export const disableLink = async (boardId: string): Promise<void> => {
  await query(
    "UPDATE boards SET share_slug = NULL, share_pw_hash = NULL WHERE id = $1",
    [boardId],
  );
};

// ---- Bruteforce protection (public link auth) ------------------------------

export type LockState = { locked: true; until: Date } | { locked: false };

export const checkLock = async (
  boardId: string,
  ip: string,
): Promise<LockState> => {
  const { rows } = await query<{ locked_until: Date | null }>(
    "SELECT locked_until FROM access_attempts WHERE board_id = $1 AND ip = $2",
    [boardId, ip],
  );
  const until = rows[0]?.locked_until;
  if (until && until.getTime() > Date.now()) {
    return { locked: true, until };
  }
  return { locked: false };
};

export const recordFailure = async (
  boardId: string,
  ip: string,
): Promise<LockState> => {
  const lockMs = env.lockoutMinutes * 60_000;
  const { rows } = await query<{ locked_until: Date | null }>(
    `INSERT INTO access_attempts (board_id, ip, failed_count, updated_at)
       VALUES ($1, $2, 1, now())
     ON CONFLICT (board_id, ip) DO UPDATE
       SET failed_count = access_attempts.failed_count + 1,
           updated_at = now(),
           locked_until = CASE
             WHEN access_attempts.failed_count + 1 >= $3
             THEN now() + ($4 || ' milliseconds')::interval
             ELSE access_attempts.locked_until
           END
     RETURNING locked_until`,
    [boardId, ip, env.maxFailedAttempts, String(lockMs)],
  );
  const until = rows[0]?.locked_until;
  if (until && until.getTime() > Date.now()) {
    return { locked: true, until };
  }
  return { locked: false };
};

export const clearFailures = async (
  boardId: string,
  ip: string,
): Promise<void> => {
  await query("DELETE FROM access_attempts WHERE board_id = $1 AND ip = $2", [
    boardId,
    ip,
  ]);
};
