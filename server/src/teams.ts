import { randomBytes } from "node:crypto";

import { query } from "./db";

const genId = () => randomBytes(8).toString("hex");

// Emoji pool for auto-assigning a team icon on creation (Notion-style).
const TEAM_EMOJIS = [
  "🚀", "🎨", "🔥", "⚡", "🌟", "🦄", "🐙", "🦊", "🐳", "🌈",
  "🍀", "🎯", "🧩", "💡", "🛠️", "📦", "🎲", "🪐", "🌸", "🍕",
  "🐝", "🦋", "🌵", "🎸", "🧠", "👾", "🐢", "🍩", "🌊", "🏔️",
  "🎈",
];

const randomEmoji = () => {
  const i = randomBytes(1)[0] % TEAM_EMOJIS.length;
  return TEAM_EMOJIS[i];
};

export type TeamRow = {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
};

export const createTeam = async (
  ownerId: string,
  name: string,
): Promise<TeamRow> => {
  const id = genId();
  const { rows } = await query<TeamRow>(
    "INSERT INTO teams (id, name, icon, owner_id) VALUES ($1, $2, $3, $4) RETURNING id, name, icon, owner_id",
    [id, name, randomEmoji(), ownerId],
  );
  await query(
    "INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')",
    [id, ownerId],
  );
  return rows[0];
};

export const updateTeam = async (
  teamId: string,
  fields: { name?: string; icon?: string },
): Promise<void> => {
  await query(
    `UPDATE teams
        SET name = COALESCE($2, name),
            icon = COALESCE($3, icon)
      WHERE id = $1`,
    [teamId, fields.name ?? null, fields.icon ?? null],
  );
};

export const listTeamsForUser = async (
  userId: string,
): Promise<Array<TeamRow & { role: string; member_count: number }>> => {
  const { rows } = await query(
    `SELECT t.id, t.name, t.icon, t.owner_id, tm.role,
            (SELECT count(*)::int FROM team_members x WHERE x.team_id = t.id) AS member_count
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
      WHERE tm.user_id = $1
      ORDER BY t.created_at`,
    [userId],
  );
  return rows as any;
};

export const isTeamMember = async (
  teamId: string,
  userId: string,
): Promise<boolean> => {
  const { rowCount } = await query(
    "SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2",
    [teamId, userId],
  );
  return rowCount! > 0;
};

export const isTeamOwner = async (
  teamId: string,
  userId: string,
): Promise<boolean> => {
  const { rowCount } = await query(
    "SELECT 1 FROM teams WHERE id = $1 AND owner_id = $2",
    [teamId, userId],
  );
  return rowCount! > 0;
};

export const addTeamMember = async (
  teamId: string,
  userId: string,
): Promise<void> => {
  await query(
    `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'member')
     ON CONFLICT DO NOTHING`,
    [teamId, userId],
  );
};

export const removeTeamMember = async (
  teamId: string,
  userId: string,
): Promise<void> => {
  await query(
    "DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 AND role <> 'owner'",
    [teamId, userId],
  );
};

export const listTeamMembers = async (teamId: string): Promise<string[]> => {
  const { rows } = await query<{ user_id: string }>(
    "SELECT user_id FROM team_members WHERE team_id = $1",
    [teamId],
  );
  return rows.map((r) => r.user_id);
};

// ---- pending invites (invite an email before they have an account) --------

export const addPendingInvite = async (
  teamId: string,
  email: string,
  invitedBy: string,
): Promise<void> => {
  await query(
    `INSERT INTO team_invites (team_id, email, invited_by) VALUES ($1, $2, $3)
     ON CONFLICT (team_id, email) DO NOTHING`,
    [teamId, email.toLowerCase(), invitedBy],
  );
};

export const listPendingInvites = async (
  teamId: string,
): Promise<Array<{ email: string }>> => {
  const { rows } = await query<{ email: string }>(
    "SELECT email FROM team_invites WHERE team_id = $1 ORDER BY created_at",
    [teamId],
  );
  return rows;
};

export const cancelInvite = async (
  teamId: string,
  email: string,
): Promise<void> => {
  await query(
    "DELETE FROM team_invites WHERE team_id = $1 AND lower(email) = lower($2)",
    [teamId, email],
  );
};

// On sign-in: turn any pending invites for this email into real memberships.
export const claimInvites = async (
  userId: string,
  email: string,
): Promise<number> => {
  const { rows } = await query<{ team_id: string }>(
    "SELECT team_id FROM team_invites WHERE lower(email) = lower($1)",
    [email],
  );
  for (const { team_id } of rows) {
    await query(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT DO NOTHING`,
      [team_id, userId],
    );
  }
  await query("DELETE FROM team_invites WHERE lower(email) = lower($1)", [
    email,
  ]);
  return rows.length;
};
