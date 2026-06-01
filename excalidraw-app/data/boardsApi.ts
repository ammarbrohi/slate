import { apiFetch } from "./serverSession";

export type Board = {
  id: string;
  name: string;
  owner_id: string;
  team_id: string | null;
  updated_at: string;
  share_slug: string | null;
  background: string | null;
  access: "owner" | "member" | "team";
};

export type Team = {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  role: string;
  member_count: number;
};

export type BoardMeta = {
  id: string;
  name: string;
  access: string;
  roomKey: string;
  ownerId: string;
  teamId: string | null;
  shareSlug: string | null;
  members: Array<{
    user_id: string;
    role: string;
    user: { id: string; email: string | null; name: string | null } | null;
  }>;
  pending: Array<{ email: string; role: string }>;
};

const json = async (res: Response) => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `http_${res.status}`);
  }
  return res.json();
};

export const syncMe = (profile: {
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}) =>
  apiFetch("/api/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  }).then(json);

export const listBoards = (): Promise<{ boards: Board[] }> =>
  apiFetch("/api/me/boards").then(json);

export const createBoard = (
  name: string,
  teamId?: string | null,
  background?: string | null,
): Promise<{ id: string }> =>
  apiFetch("/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      teamId: teamId ?? null,
      background: background ?? null,
    }),
  }).then(json);

export const renameBoard = (id: string, name: string) =>
  apiFetch(`/api/boards/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }).then(json);

export const deleteBoard = (id: string) =>
  apiFetch(`/api/boards/${id}`, { method: "DELETE" }).then(json);

export const setBoardBackground = (id: string, background: string | null) =>
  apiFetch(`/api/boards/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ background }),
  }).then(json);

export const getBoardMeta = (id: string): Promise<BoardMeta> =>
  apiFetch(`/api/boards/${id}`).then(json);

export const addBoardMember = (id: string, email: string, role = "editor") =>
  apiFetch(`/api/boards/${id}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  }).then(json);

export const removeBoardMember = (id: string, userId: string) =>
  apiFetch(`/api/boards/${id}/members/${userId}`, { method: "DELETE" }).then(
    json,
  );

export const cancelBoardInvite = (id: string, email: string) =>
  apiFetch(`/api/boards/${id}/invites/${encodeURIComponent(email)}`, {
    method: "DELETE",
  }).then(json);

export const enableShareLink = (
  id: string,
  password?: string,
): Promise<{ slug: string }> =>
  apiFetch(`/api/boards/${id}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: password || null }),
  }).then(json);

export const disableShareLink = (id: string) =>
  apiFetch(`/api/boards/${id}/share`, { method: "DELETE" }).then(json);

export const listTeams = (): Promise<{ teams: Team[] }> =>
  apiFetch("/api/me/teams").then(json);

export const createTeam = (name: string): Promise<{ team: Team }> =>
  apiFetch("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }).then(json);

export const leaveTeam = (teamId: string) =>
  apiFetch(`/api/teams/${teamId}/leave`, { method: "POST" }).then(json);

export const updateTeam = (
  teamId: string,
  fields: { name?: string; icon?: string },
) =>
  apiFetch(`/api/teams/${teamId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  }).then(json);

export const addTeamMember = (teamId: string, email: string) =>
  apiFetch(`/api/teams/${teamId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  }).then(json);

export type TeamMember = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url?: string | null;
};

export type PendingInvite = { email: string };

export const listTeamMembers = (
  teamId: string,
): Promise<{ members: TeamMember[]; pending: PendingInvite[] }> =>
  apiFetch(`/api/teams/${teamId}/members`).then(json);

export const removeTeamMember = (teamId: string, userId: string) =>
  apiFetch(`/api/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  }).then(json);

export const cancelTeamInvite = (teamId: string, email: string) =>
  apiFetch(`/api/teams/${teamId}/invites/${encodeURIComponent(email)}`, {
    method: "DELETE",
  }).then(json);

// ---- public link guest path ------------------------------------------------

export const getLinkInfo = (
  slug: string,
): Promise<{ name: string; needsPassword: boolean }> =>
  apiFetch(`/api/links/${slug}`).then(json);

export const authLink = (
  slug: string,
  password: string,
): Promise<{ token: string; boardId: string; name: string; roomKey: string }> =>
  apiFetch(`/api/links/${slug}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  }).then(json);
