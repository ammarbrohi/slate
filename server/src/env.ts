const required = (key: string, fallback?: string): string => {
  const v = process.env[key] ?? fallback;
  if (v == null) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
};

export const env = {
  port: Number(process.env.PORT ?? 3002),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3001",
  databaseUrl: required("DATABASE_URL"),
  // signing secret for the public-link scoped tokens we issue ourselves
  jwtSecret: required("JWT_SECRET", "dev-insecure-change-me"),
  maxFailedAttempts: Number(process.env.MAX_FAILED_ATTEMPTS ?? 5),
  lockoutMinutes: Number(process.env.LOCKOUT_MINUTES ?? 15),
  clerk: {
    // e.g. https://your-app.clerk.accounts.dev — used to fetch JWKS + verify iss
    issuer: process.env.CLERK_ISSUER ?? "",
    // dev only: trust `x-dev-user-*` headers so we can build without Clerk keys
    devBypass: (process.env.AUTH_DEV_BYPASS ?? "false") === "true",
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    region: process.env.S3_REGION ?? "auto",
    bucket: process.env.S3_BUCKET ?? "excalidraw-files",
    accessKeyId: required("S3_ACCESS_KEY_ID", "minioadmin"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY", "minioadmin"),
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
  },
};
