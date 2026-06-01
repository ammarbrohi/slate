// Unified auth layer. Uses Clerk when VITE_APP_CLERK_PUBLISHABLE_KEY is set,
// otherwise a local dev identity (no external dependency) so the whole boards
// flow is testable before Clerk keys are configured. Either way it registers
// the credential provider into serverSession so Collab / boardSync can auth.
import {
  ClerkProvider,
  SignIn,
  SignUp,
  UserButton,
  useAuth,
  useClerk,
  useUser,
} from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { syncMe } from "../data/boardsApi";
import { setAuthProvider, setCurrentUserName } from "../data/serverSession";

import type { ReactNode } from "react";

export type AppUser = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl?: string | null;
};

type AppAuthValue = {
  ready: boolean;
  signedIn: boolean;
  user: AppUser | null;
  signIn: () => void;
  signOut: () => void;
  // header account control: Clerk's profile menu, or a dev name + sign out
  accountControl: ReactNode;
  // full auth surfaces rendered as pages (no dismissable modal)
  signInPanel: ReactNode;
  signUpPanel: ReactNode;
};

const AppAuthContext = createContext<AppAuthValue>({
  ready: false,
  signedIn: false,
  user: null,
  signIn: () => {},
  signOut: () => {},
  accountControl: null,
  signInPanel: null,
  signUpPanel: null,
});

export const useAppAuth = () => useContext(AppAuthContext);

const CLERK_KEY = import.meta.env.VITE_APP_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

// ---- Dev identity (no Clerk) ----------------------------------------------

const DEV_KEY = "excalidraw-dev-user";

const loadDevUser = (): AppUser | null => {
  try {
    const raw = localStorage.getItem(DEV_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
};

const DevAuthCard = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <div className="boards-signin-card">
    <div className="boards-glyph">
      <span style={{ fontSize: 32 }}>▦</span>
    </div>
    <h1 className="boards-signin-title">Boards</h1>
    <p className="boards-signin-sub">
      Sign in to create, share, and collaborate on boards.
    </p>
    <button className="boards-btn boards-btn-primary" onClick={onClick}>
      {label}
    </button>
  </div>
);

const DevAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(loadDevUser);

  // register synchronously during render so child effects (which may call the
  // API) see credentials before they run
  setAuthProvider({
    getAuthHeaders: async (): Promise<Record<string, string>> =>
      user
        ? {
            "x-dev-user-id": user.id,
            "x-dev-email": user.email ?? "",
            "x-dev-name": user.name ?? "",
          }
        : {},
    getSocketAuth: async () => (user ? { devUserId: user.id } : {}),
  });
  setCurrentUserName(user?.name ?? null);

  useEffect(() => {
    if (user) {
      syncMe({ email: user.email, name: user.name }).catch(() => {});
    }
  }, [user]);

  const devSignIn = () => {
    const name = window.prompt("Display name (dev login)")?.trim();
    if (!name) {
      return;
    }
    const email = window.prompt("Email (used for sharing)")?.trim() || null;
    const id = `dev_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    const u = { id, name, email };
    localStorage.setItem(DEV_KEY, JSON.stringify(u));
    setUser(u);
  };

  const value = useMemo<AppAuthValue>(
    () => ({
      ready: true,
      signedIn: !!user,
      user,
      signIn: devSignIn,
      signInPanel: <DevAuthCard label="Sign in (dev)" onClick={devSignIn} />,
      signUpPanel: <DevAuthCard label="Sign up (dev)" onClick={devSignIn} />,
      signOut: () => {
        localStorage.removeItem(DEV_KEY);
        setUser(null);
      },
      accountControl: user ? (
        <>
          <span className="boards-user-name">{user.name}</span>
          <button
            className="boards-signout"
            onClick={() => {
              localStorage.removeItem(DEV_KEY);
              setUser(null);
            }}
          >
            Sign out
          </button>
        </>
      ) : null,
    }),
    [user],
  );

  return (
    <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
  );
};

// ---- Clerk identity --------------------------------------------------------

const ClerkBridge = ({ children }: { children: ReactNode }) => {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();

  setAuthProvider({
    getAuthHeaders: async (): Promise<Record<string, string>> => {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
    getSocketAuth: async () => {
      const token = await getToken();
      return token ? { token } : {};
    },
  });
  setCurrentUserName(
    user?.fullName ??
      user?.username ??
      user?.primaryEmailAddress?.emailAddress ??
      null,
  );

  useEffect(() => {
    if (isSignedIn && user) {
      syncMe({
        email: user.primaryEmailAddress?.emailAddress ?? null,
        name: user.fullName ?? user.username ?? null,
        avatarUrl: user.imageUrl ?? null,
      }).catch(() => {});
    }
  }, [isSignedIn, user, getToken]);

  const value: AppAuthValue = {
    ready: isLoaded,
    signedIn: !!isSignedIn,
    user: user
      ? {
          id: user.id,
          name: user.fullName ?? user.username ?? null,
          email: user.primaryEmailAddress?.emailAddress ?? null,
          avatarUrl: user.imageUrl,
        }
      : null,
    signIn: () => clerk.openSignIn(),
    signOut: () => signOut(),
    signInPanel: (
      <SignIn routing="virtual" forceRedirectUrl="/" signUpUrl="/sign-up" />
    ),
    signUpPanel: (
      <SignUp routing="virtual" forceRedirectUrl="/" signInUrl="/sign-in" />
    ),
    accountControl: isSignedIn ? (
      <UserButton
        afterSignOutUrl="/"
        showName
        appearance={{
          baseTheme: dark,
          variables: { colorPrimary: "#7c5cff" },
          elements: { userButtonOuterIdentifier: { color: "#e5e7eb" } },
        }}
      />
    ) : null,
  };

  return (
    <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
  );
};

export const AppAuthProvider = ({ children }: { children: ReactNode }) => {
  if (CLERK_KEY) {
    return (
      <ClerkProvider
        publishableKey={CLERK_KEY}
        appearance={{
          baseTheme: dark,
          variables: {
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            colorPrimary: "#7c5cff",
          },
        }}
      >
        <ClerkBridge>{children}</ClerkBridge>
      </ClerkProvider>
    );
  }
  return <DevAuthProvider>{children}</DevAuthProvider>;
};
