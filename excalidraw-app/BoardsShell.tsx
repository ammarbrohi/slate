// Top-level router for the boards experience. Decides between the dashboard,
// an open board (/b/:id), a public-link guest gate (/p/:slug), or a sign-in
// screen, and prepares the serverSession before mounting the editor.
import { useEffect, useState } from "react";

import ExcalidrawApp from "./App";
import { useAppAuth } from "./auth/AppAuth";
import { Dashboard } from "./components/Boards/Dashboard";
import { Landing } from "./components/Boards/Landing";
import { authLink, getBoardMeta, getLinkInfo } from "./data/boardsApi";
import { setAuthProvider, setBoardSession } from "./data/serverSession";

import "./components/Boards/Boards.scss";

const BOARD_RE = /^\/b\/([a-zA-Z0-9]+)$/;
const LINK_RE = /^\/p\/([A-Za-z0-9_-]+)$/;

const Spinner = () => (
  <div className="boards-signin">
    <div className="boards-spinner" />
  </div>
);

// Loads board meta, primes the session, then mounts the editor.
const BoardLoader = ({ id }: { id: string }) => {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getBoardMeta(id)
      .then((meta) => {
        if (!alive) {
          return;
        }
        setBoardSession({ boardId: meta.id, roomKey: meta.roomKey });
        // tab title reflects the open board so tabs are distinguishable
        document.title = `${meta.name} - Slate`;
        setState("ready");
      })
      .catch((e) => {
        if (!alive) {
          return;
        }
        setError(
          e.message === "forbidden"
            ? "You don't have access to this board."
            : "Board not found.",
        );
        setState("error");
      });
    return () => {
      alive = false;
      // restore default when leaving the board
      document.title = "Slate - lovely whiteboard";
    };
  }, [id]);

  if (state === "loading") {
    return <Spinner />;
  }
  if (state === "error") {
    return (
      <div className="boards-signin">
        <p>{error}</p>
        <button className="boards-btn boards-btn-primary" onClick={() => location.assign("/")}>
          Back to boards
        </button>
      </div>
    );
  }
  return <ExcalidrawApp />;
};

// Public-link guest: optional password, then mount the editor as a guest.
const LinkGate = ({ slug }: { slug: string }) => {
  const [phase, setPhase] = useState<"loading" | "password" | "ready">(
    "loading",
  );
  const [name, setName] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const enter = async (pw: string) => {
    try {
      const res = await authLink(slug, pw);
      setAuthProvider({
        getAuthHeaders: async () => ({ Authorization: `Bearer ${res.token}` }),
        getSocketAuth: async () => ({ token: res.token }),
      });
      setBoardSession({ boardId: res.boardId, roomKey: res.roomKey });
      setPhase("ready");
    } catch (e: any) {
      if (e.message === "locked") {
        setError("Too many attempts. Try again later.");
      } else if (e.message === "bad_password") {
        setError("Wrong password.");
      } else {
        setError("Could not open this board.");
      }
    }
  };

  useEffect(() => {
    getLinkInfo(slug)
      .then((info) => {
        setName(info.name);
        if (info.needsPassword) {
          setNeedsPassword(true);
          setPhase("password");
        } else {
          enter("");
        }
      })
      .catch(() => {
        setError("This link is invalid or was disabled.");
        setPhase("password");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (phase === "ready") {
    return <ExcalidrawApp />;
  }
  if (phase === "loading") {
    return <Spinner />;
  }
  return (
    <div className="boards-signin">
      <h1>{name || "Shared board"}</h1>
      {needsPassword && <p>This board is password protected.</p>}
      {needsPassword && (
        <input
          className="boards-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enter(password)}
          autoFocus
        />
      )}
      {error && <p className="boards-error">{error}</p>}
      {needsPassword && (
        <button className="boards-btn boards-btn-primary" onClick={() => enter(password)}>
          Open board
        </button>
      )}
    </div>
  );
};

export const BoardsShell = () => {
  const auth = useAppAuth();
  const path = window.location.pathname;

  const linkMatch = path.match(LINK_RE);
  if (linkMatch) {
    return <LinkGate slug={linkMatch[1]} />;
  }

  if (!auth.ready) {
    return <Spinner />;
  }

  if (!auth.signedIn) {
    if (path === "/sign-in") {
      return <div className="boards-signin">{auth.signInPanel}</div>;
    }
    if (path === "/sign-up") {
      return <div className="boards-signin">{auth.signUpPanel}</div>;
    }
    return <Landing />;
  }

  // signed in but sitting on an auth/landing path → send to the dashboard
  if (path === "/sign-in" || path === "/sign-up") {
    location.assign("/");
    return <Spinner />;
  }

  const boardMatch = path.match(BOARD_RE);
  if (boardMatch) {
    return <BoardLoader id={boardMatch[1]} />;
  }

  return <Dashboard onOpen={(id) => location.assign(`/b/${id}`)} />;
};
