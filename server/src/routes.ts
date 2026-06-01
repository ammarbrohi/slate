import { Hono } from "hono";
import { cors } from "hono/cors";

import {
  signLinkToken,
  verifyClerkToken,
  verifyLinkToken,
  verifyPassword,
} from "./auth";
import {
  accessFor,
  addBoardInvite,
  addMember,
  cancelBoardInvite,
  checkLock,
  claimBoardInvites,
  clearFailures,
  createBoard,
  deleteBoard,
  disableLink,
  enableLink,
  getBoard,
  getBoardBySlug,
  listBoardInvites,
  listBoardsForUser,
  listMembers,
  recordFailure,
  removeMember,
  renameBoard,
  saveScene,
  setBoardBackground,
} from "./boards";
import { env } from "./env";
import { getFile, putFile } from "./r2";
import {
  addPendingInvite,
  addTeamMember,
  cancelInvite,
  claimInvites,
  createTeam,
  isTeamMember,
  isTeamOwner,
  listPendingInvites,
  listTeamMembers,
  listTeamsForUser,
  removeTeamMember,
  updateTeam,
} from "./teams";
import { findUserByEmail, getUsers, upsertUser } from "./users";

type Vars = { userId: string; boardId: string; access: string };

export const app = new Hono<{ Variables: Vars }>();

app.use(
  "/api/*",
  cors({
    origin: env.corsOrigin,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-dev-user-id",
      "x-dev-email",
      "x-dev-name",
    ],
  }),
);

const clientIp = (c: any): string => {
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) {
    return fwd.split(",")[0].trim();
  }
  return c.env?.incoming?.socket?.remoteAddress ?? "unknown";
};

const bearer = (c: any): string => {
  const h = c.req.header("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
};

// Resolve the Clerk user id (or dev-bypass header). Returns null if unauthed.
const resolveUserId = async (c: any): Promise<string | null> => {
  if (env.clerk.devBypass) {
    const devId = c.req.header("x-dev-user-id");
    if (devId) {
      await upsertUser({
        id: devId,
        email: c.req.header("x-dev-email") ?? null,
        name: c.req.header("x-dev-name") ?? null,
      });
      return devId;
    }
  }
  const uid = await verifyClerkToken(bearer(c));
  if (uid) {
    await upsertUser({ id: uid });
  }
  return uid;
};

// Middleware: require a signed-in app user.
const requireUser = async (c: any, next: any) => {
  const uid = await resolveUserId(c);
  if (!uid) {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("userId", uid);
  await next();
};

app.get("/health", (c) => c.text("ok"));

// ---- Identity sync (frontend pushes Clerk profile) -------------------------
app.post("/api/me", requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  await upsertUser({
    id: c.get("userId"),
    email: body?.email ?? null,
    name: body?.name ?? null,
    avatarUrl: body?.avatarUrl ?? null,
  });
  // claim any pending invites addressed to this email
  if (body?.email) {
    await claimInvites(c.get("userId"), String(body.email));
    await claimBoardInvites(c.get("userId"), String(body.email));
  }
  return c.json({ ok: true, id: c.get("userId") });
});

// ---- Boards list / create --------------------------------------------------
app.get("/api/me/boards", requireUser, async (c) => {
  const boards = await listBoardsForUser(c.get("userId"));
  return c.json({ boards });
});

app.post("/api/boards", requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = String(body?.name ?? "Untitled").slice(0, 120);
  const teamId = body?.teamId ? String(body.teamId) : null;
  const background =
    typeof body?.background === "string" && /^https?:\/\//.test(body.background)
      ? body.background.slice(0, 1000)
      : null;
  if (teamId && !(await isTeamMember(teamId, c.get("userId")))) {
    return c.json({ error: "not_team_member" }, 403);
  }
  const board = await createBoard(c.get("userId"), name, teamId, background);
  return c.json({ id: board.id, name: board.name, team_id: board.team_id });
});

// ---- Owner-only board management -------------------------------------------
const requireOwner = async (c: any, next: any) => {
  const board = await getBoard(c.req.param("id"));
  if (!board) {
    return c.json({ error: "not_found" }, 404);
  }
  if (board.owner_id !== c.get("userId")) {
    return c.json({ error: "forbidden" }, 403);
  }
  await next();
};

app.patch("/api/boards/:id", requireUser, requireOwner, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  // background update (null clears -> auto gradient). Only allow http(s) urls.
  if ("background" in body) {
    const bg = body.background;
    if (bg === null) {
      await setBoardBackground(id, null);
    } else if (typeof bg === "string" && /^https?:\/\//.test(bg)) {
      await setBoardBackground(id, bg.slice(0, 1000));
    } else {
      return c.json({ error: "bad_request" }, 400);
    }
    if (body?.name == null) {
      return c.json({ ok: true });
    }
  }

  const name = String(body?.name ?? "").slice(0, 120);
  if (!name) {
    return c.json({ error: "bad_request" }, 400);
  }
  await renameBoard(id, name);
  return c.json({ ok: true });
});

app.delete("/api/boards/:id", requireUser, requireOwner, async (c) => {
  await deleteBoard(c.req.param("id"));
  return c.json({ ok: true });
});

// ---- Board meta (any user with access) -------------------------------------
app.get("/api/boards/:id", requireUser, async (c) => {
  const board = await getBoard(c.req.param("id"));
  if (!board) {
    return c.json({ error: "not_found" }, 404);
  }
  const access = await accessFor(board, c.get("userId"));
  if (!access) {
    return c.json({ error: "forbidden" }, 403);
  }
  const memberRows = await listMembers(board.id);
  const userIds = [board.owner_id, ...memberRows.map((m) => m.user_id)];
  const users = await getUsers([...new Set(userIds)]);
  return c.json({
    id: board.id,
    name: board.name,
    access,
    roomKey: board.room_key,
    ownerId: board.owner_id,
    teamId: board.team_id,
    shareSlug: board.share_slug,
    members: memberRows.map((m) => ({
      ...m,
      user: users.find((u) => u.id === m.user_id) ?? null,
    })),
    pending: await listBoardInvites(board.id),
  });
});

// ---- Individual sharing (owner) --------------------------------------------
app.post("/api/boards/:id/members", requireUser, requireOwner, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim();
  const role = body?.role === "viewer" ? "viewer" : "editor";
  if (!email) {
    return c.json({ error: "bad_request" }, 400);
  }
  const user = await findUserByEmail(email);
  if (user) {
    await addMember(c.req.param("id"), user.id, role);
    return c.json({ ok: true, user });
  }
  // no account yet: store a pending invite, claimed when they sign up
  await addBoardInvite(c.req.param("id"), email, role, c.get("userId"));
  return c.json({ ok: true, pending: true, email });
});

app.delete(
  "/api/boards/:id/members/:userId",
  requireUser,
  requireOwner,
  async (c) => {
    await removeMember(c.req.param("id"), c.req.param("userId"));
    return c.json({ ok: true });
  },
);

app.delete(
  "/api/boards/:id/invites/:email",
  requireUser,
  requireOwner,
  async (c) => {
    await cancelBoardInvite(
      c.req.param("id"),
      decodeURIComponent(c.req.param("email")),
    );
    return c.json({ ok: true });
  },
);

// ---- Public link sharing (owner) -------------------------------------------
app.post("/api/boards/:id/share", requireUser, requireOwner, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const password = body?.password ? String(body.password) : null;
  const board = await getBoard(c.req.param("id"));
  const slug = await enableLink(board!.id, password, board!.share_slug);
  return c.json({ slug });
});

app.delete("/api/boards/:id/share", requireUser, requireOwner, async (c) => {
  await disableLink(c.req.param("id"));
  return c.json({ ok: true });
});

// ---- Teams -----------------------------------------------------------------
app.get("/api/me/teams", requireUser, async (c) => {
  return c.json({ teams: await listTeamsForUser(c.get("userId")) });
});

app.post("/api/teams", requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = String(body?.name ?? "").slice(0, 80).trim();
  if (!name) {
    return c.json({ error: "bad_request" }, 400);
  }
  return c.json({ team: await createTeam(c.get("userId"), name) });
});

app.patch("/api/teams/:id", requireUser, async (c) => {
  const teamId = c.req.param("id");
  if (!(await isTeamOwner(teamId, c.get("userId")))) {
    return c.json({ error: "forbidden" }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const name =
    body?.name != null ? String(body.name).slice(0, 80).trim() : undefined;
  const icon =
    body?.icon != null ? String(body.icon).slice(0, 16) : undefined;
  if (name === "" || (name === undefined && icon === undefined)) {
    return c.json({ error: "bad_request" }, 400);
  }
  await updateTeam(teamId, { name, icon });
  return c.json({ ok: true });
});

app.post("/api/teams/:id/members", requireUser, async (c) => {
  const teamId = c.req.param("id");
  if (!(await isTeamOwner(teamId, c.get("userId")))) {
    return c.json({ error: "forbidden" }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim();
  if (!email) {
    return c.json({ error: "bad_request" }, 400);
  }
  const user = await findUserByEmail(email);
  if (user) {
    await addTeamMember(teamId, user.id);
    return c.json({ ok: true, user });
  }
  // no account yet: store a pending invite, claimed when they sign up
  await addPendingInvite(teamId, email, c.get("userId"));
  return c.json({ ok: true, pending: true, email });
});

app.delete("/api/teams/:id/members/:userId", requireUser, async (c) => {
  const teamId = c.req.param("id");
  if (!(await isTeamOwner(teamId, c.get("userId")))) {
    return c.json({ error: "forbidden" }, 403);
  }
  await removeTeamMember(teamId, c.req.param("userId"));
  return c.json({ ok: true });
});

app.post("/api/teams/:id/leave", requireUser, async (c) => {
  const teamId = c.req.param("id");
  const userId = c.get("userId");
  if (await isTeamOwner(teamId, userId)) {
    return c.json({ error: "owner_cannot_leave" }, 400);
  }
  await removeTeamMember(teamId, userId);
  return c.json({ ok: true });
});

app.delete("/api/teams/:id/invites/:email", requireUser, async (c) => {
  const teamId = c.req.param("id");
  if (!(await isTeamOwner(teamId, c.get("userId")))) {
    return c.json({ error: "forbidden" }, 403);
  }
  await cancelInvite(teamId, decodeURIComponent(c.req.param("email")));
  return c.json({ ok: true });
});

app.get("/api/teams/:id/members", requireUser, async (c) => {
  const teamId = c.req.param("id");
  if (!(await isTeamMember(teamId, c.get("userId")))) {
    return c.json({ error: "forbidden" }, 403);
  }
  const ids = await listTeamMembers(teamId);
  return c.json({
    members: await getUsers(ids),
    pending: await listPendingInvites(teamId),
  });
});

// ---- Public link guest access (no account) ---------------------------------
app.get("/api/links/:slug", async (c) => {
  const board = await getBoardBySlug(c.req.param("slug"));
  if (!board) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json({ name: board.name, needsPassword: !!board.share_pw_hash });
});

app.post("/api/links/:slug/auth", async (c) => {
  const board = await getBoardBySlug(c.req.param("slug"));
  if (!board) {
    return c.json({ error: "not_found" }, 404);
  }
  const ip = clientIp(c);
  const lock = await checkLock(board.id, ip);
  if (lock.locked) {
    return c.json({ error: "locked", retryAfter: lock.until.toISOString() }, 429);
  }
  if (board.share_pw_hash) {
    const body = await c.req.json().catch(() => ({}));
    const ok = await verifyPassword(String(body?.password ?? ""), board.share_pw_hash);
    if (!ok) {
      const after = await recordFailure(board.id, ip);
      return c.json(
        after.locked
          ? { error: "locked", retryAfter: after.until.toISOString() }
          : { error: "bad_password" },
        after.locked ? 429 : 401,
      );
    }
  }
  await clearFailures(board.id, ip);
  const token = await signLinkToken(board.id);
  return c.json({
    token,
    boardId: board.id,
    name: board.name,
    roomKey: board.room_key,
  });
});

// ---- Board access middleware: app user OR link token -----------------------
const boardAuth = async (c: any, next: any) => {
  const id = c.req.param("id");
  const token = bearer(c);

  // link guest token?
  const link = await verifyLinkToken(token);
  if (link && link.boardId === id) {
    c.set("boardId", id);
    c.set("access", "link");
    return next();
  }
  // app user?
  const uid = await resolveUserId(c);
  if (uid) {
    const board = await getBoard(id);
    if (board && (await accessFor(board, uid))) {
      c.set("boardId", id);
      c.set("access", "user");
      return next();
    }
  }
  return c.json({ error: "unauthorized" }, 401);
};

// ---- Scene snapshot --------------------------------------------------------
app.get("/api/boards/:id/scene", boardAuth, async (c) => {
  const board = await getBoard(c.get("boardId"));
  if (!board) {
    return c.json({ error: "not_found" }, 404);
  }
  if (!board.scene_cipher || !board.scene_iv) {
    return c.json({ sceneVersion: 0, iv: null, cipher: null });
  }
  return c.json({
    sceneVersion: board.scene_version,
    iv: board.scene_iv.toString("base64"),
    cipher: board.scene_cipher.toString("base64"),
  });
});

app.put("/api/boards/:id/scene", boardAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const sceneVersion = Number(body?.sceneVersion);
  const iv = body?.iv ? Buffer.from(String(body.iv), "base64") : null;
  const cipher = body?.cipher ? Buffer.from(String(body.cipher), "base64") : null;
  if (!Number.isFinite(sceneVersion) || !iv || !cipher) {
    return c.json({ error: "bad_request" }, 400);
  }
  await saveScene(c.get("boardId"), sceneVersion, iv, cipher);
  return c.json({ ok: true, sceneVersion });
});

// ---- Files (R2) ------------------------------------------------------------
app.put("/api/boards/:id/files/:fileId", boardAuth, async (c) => {
  const buf = Buffer.from(await c.req.arrayBuffer());
  if (buf.length === 0) {
    return c.json({ error: "empty" }, 400);
  }
  await putFile(c.get("boardId"), c.req.param("fileId"), buf);
  return c.json({ ok: true, id: c.req.param("fileId") });
});

app.get("/api/boards/:id/files/:fileId", boardAuth, async (c) => {
  const buf = await getFile(c.get("boardId"), c.req.param("fileId"));
  if (!buf) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.body(buf, 200, {
    "Content-Type": "application/octet-stream",
    "Cache-Control": "private, max-age=31536000",
  });
});
