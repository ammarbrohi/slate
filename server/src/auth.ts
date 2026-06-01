import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";

import { env } from "./env";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

// ---- Password hashing (public link share path) -----------------------------

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
};

export const verifyPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) {
    return false;
  }
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

// ---- Link tokens: scoped JWTs we sign for password-link guests --------------

const linkKey = new TextEncoder().encode(env.jwtSecret);

export type LinkToken = { boardId: string; scope: "link" };

export const signLinkToken = async (boardId: string): Promise<string> =>
  new SignJWT({ boardId, scope: "link" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(linkKey);

export const verifyLinkToken = async (
  token: string,
): Promise<LinkToken | null> => {
  try {
    const { payload } = await jwtVerify(token, linkKey);
    if (payload.scope === "link" && typeof payload.boardId === "string") {
      return { boardId: payload.boardId, scope: "link" };
    }
    return null;
  } catch {
    return null;
  }
};

// ---- Clerk session verification (RS256 via JWKS) ---------------------------

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
const getJwks = () => {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${env.clerk.issuer}/.well-known/jwks.json`),
    );
  }
  return jwks;
};

// Returns the Clerk user id (sub) or null.
export const verifyClerkToken = async (
  token: string,
): Promise<string | null> => {
  if (!env.clerk.issuer) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: env.clerk.issuer,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
};
