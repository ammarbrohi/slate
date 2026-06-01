// Editor-chrome controls for a synced board: a link back to the dashboard and
// an autosave status indicator ("Saved 3s ago · by Ammar Brohi").
import { useEffect, useState } from "react";

import {
  getSaveState,
  subscribeSaveState,
  type SaveState,
} from "../data/saveStatus";
import { getBoardSession } from "../data/serverSession";
import { getBoardMeta } from "../data/boardsApi";

const relativeTime = (at: number): string => {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 5) {
    return "just now";
  }
  if (s < 60) {
    return `${s}s ago`;
  }
  const m = Math.floor(s / 60);
  if (m < 60) {
    return `${m}m ago`;
  }
  const h = Math.floor(m / 60);
  return `${h}h ago`;
};

export const BackToBoards = () => (
  <button
    type="button"
    title="Back to boards"
    onClick={() => location.assign("/")}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "0.35em",
      height: "2.5rem",
      padding: "0 0.75rem",
      borderRadius: "0.75rem",
      border: "1px solid var(--default-border-color, #e5e5e5)",
      background: "var(--island-bg-color, #fff)",
      color: "var(--text-primary-color, #1b1b1f)",
      fontSize: "0.875rem",
      fontWeight: 600,
      cursor: "pointer",
    }}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
    Boards
  </button>
);

// Badge showing whether the open board is publicly linked or shared with
// people. Self-contained: fetches the board meta on mount.
type Visibility = "private" | "public" | "shared";

export const ShareBadge = () => {
  const [vis, setVis] = useState<Visibility>("private");

  useEffect(() => {
    const session = getBoardSession();
    if (!session?.boardId) {
      return;
    }
    let alive = true;
    getBoardMeta(session.boardId)
      .then((meta) => {
        if (!alive) {
          return;
        }
        if (meta.shareSlug) {
          setVis("public");
        } else if ((meta.members?.length ?? 0) > 0) {
          setVis("shared");
        } else {
          setVis("private");
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (vis === "private") {
    return null;
  }

  const isPublic = vis === "public";
  return (
    <div
      title={
        isPublic
          ? "Anyone with the link can open this board"
          : "Shared with specific people"
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.4em",
        height: "2.5rem",
        padding: "0 0.7rem",
        borderRadius: "0.75rem",
        border: `1px solid ${isPublic ? "rgba(124,92,255,0.5)" : "rgba(46,204,113,0.5)"}`,
        background: isPublic ? "rgba(124,92,255,0.12)" : "rgba(46,204,113,0.12)",
        color: isPublic ? "#a98bff" : "#36c779",
        fontSize: "0.8rem",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {isPublic ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )}
      {isPublic ? "Public" : "Shared"}
    </div>
  );
};

export const SaveStatusIndicator = () => {
  const [status, setStatus] = useState<SaveState>(getSaveState());
  const [, force] = useState(0);

  useEffect(() => subscribeSaveState(setStatus), []);
  useEffect(() => {
    const id = window.setInterval(() => force((x) => x + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  if (status.state === "idle") {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "2.5rem",
        padding: "0 0.6rem",
        color: "var(--text-secondary-color, #6b7280)",
        fontSize: "0.8rem",
        whiteSpace: "nowrap",
      }}
    >
      {status.state === "saving"
        ? "Saving…"
        : `Saved ${relativeTime(status.at)} · by ${status.by}`}
    </div>
  );
};
