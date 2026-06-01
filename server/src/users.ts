import { query } from "./db";

export type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
};

// Upsert the Clerk identity into our mirror table. Called on authed requests.
export const upsertUser = async (u: {
  id: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}): Promise<void> => {
  await query(
    `INSERT INTO users (id, email, name, avatar_url, updated_at)
       VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE
       SET email = COALESCE(EXCLUDED.email, users.email),
           name = COALESCE(EXCLUDED.name, users.name),
           avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
           updated_at = now()`,
    [u.id, u.email ?? null, u.name ?? null, u.avatarUrl ?? null],
  );
};

export const findUserByEmail = async (
  email: string,
): Promise<UserRow | null> => {
  const { rows } = await query<UserRow>(
    "SELECT id, email, name, avatar_url FROM users WHERE lower(email) = lower($1)",
    [email],
  );
  return rows[0] ?? null;
};

export const getUsers = async (ids: string[]): Promise<UserRow[]> => {
  if (ids.length === 0) {
    return [];
  }
  const { rows } = await query<UserRow>(
    "SELECT id, email, name, avatar_url FROM users WHERE id = ANY($1)",
    [ids],
  );
  return rows;
};
