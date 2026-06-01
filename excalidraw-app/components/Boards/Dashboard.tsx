import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listBoards,
  createBoard,
  listTeams,
  createTeam,
} from "../../data/boardsApi";
import { useAppAuth } from "../../auth/AppAuth";

import { PromptModal } from "./Modal";
import { ManageMembersModal } from "./ManageMembersModal";
import { BoardSettingsModal } from "./BoardSettingsModal";
import { CreateBoardModal } from "./CreateBoardModal";

import "./Boards.scss";

import type { Board, Team } from "../../data/boardsApi";
import type { ReactNode } from "react";

// ---- icons (inline, currentColor) -----------------------------------------

const GridGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const GearIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const UsersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// ---- helpers --------------------------------------------------------------

const formatUpdated = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) {
    return "just now";
  }
  const m = Math.floor(s / 60);
  if (m < 60) {
    return `${m}m ago`;
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    return `${h}h ago`;
  }
  const d = Math.floor(h / 24);
  if (d < 7) {
    return `${d}d ago`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// Deterministic hue from board id, so each board's thumbnail has a stable color.
const hueFromId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 360;
  }
  return h;
};

// ---- board card -----------------------------------------------------------

const BoardCard = ({
  board,
  onOpen,
  onSettings,
}: {
  board: Board;
  onOpen: (id: string) => void;
  onSettings: (board: Board) => void;
}) => {
  const isOwner = board.access === "owner";
  const hue = hueFromId(board.id);
  const thumbStyle = board.background
    ? {
        backgroundImage: `url(${board.background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        background: `linear-gradient(135deg, hsl(${hue}, 55%, 42%), hsl(${(hue + 45) % 360}, 50%, 30%))`,
      };
  return (
    <div
      className="boards-card"
      onClick={() => onOpen(board.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onOpen(board.id);
        }
      }}
    >
      <div className="boards-card-thumb" style={thumbStyle}>
        {!board.background && <div className="boards-card-thumb-grid" />}
        <div className="boards-card-open">Open ↗</div>
      </div>

      <div className="boards-card-footer">
        <div className="boards-card-name">{board.name}</div>
        <div className="boards-card-footer-row">
          <span className="boards-card-sub">
            Updated {formatUpdated(board.updated_at)}
          </span>
          <div className="boards-card-tail">
            {board.share_slug && (
              <span className="boards-card-badge" title="Public link enabled">
                <GlobeIcon />
                Public
              </span>
            )}
            {isOwner && (
              <div className="boards-card-actions">
                <button className="boards-icon-btn" aria-label="Board settings" onClick={(e) => { e.stopPropagation(); onSettings(board); }}>
                  <GearIcon />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CreateCard = ({ onClick }: { onClick: () => void }) => (
  <button className="boards-create-card" onClick={onClick} type="button">
    <span className="boards-create-plus">
      <PlusIcon />
    </span>
    <span className="boards-create-label">Create board</span>
  </button>
);

// ---- dashboard ------------------------------------------------------------

type CreateTarget = { teamId: string | null };

export const Dashboard = ({ onOpen }: { onOpen: (boardId: string) => void }) => {
  const auth = useAppAuth();

  const [boards, setBoards] = useState<Board[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // modal state
  const [settingsTarget, setSettingsTarget] = useState<Board | null>(null);
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [manageTeam, setManageTeam] = useState<Team | null>(null);
  const [newTeamOpen, setNewTeamOpen] = useState(false);

  const refetch = useCallback(async () => {
    setError(null);
    try {
      const [boardsRes, teamsRes] = await Promise.all([listBoards(), listTeams()]);
      setBoards(boardsRes.boards);
      setTeams(teamsRes.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refetch().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  const personalBoards = useMemo(
    () => boards.filter((b) => b.team_id === null),
    [boards],
  );
  const boardsByTeam = useMemo(() => {
    const map = new Map<string, Board[]>();
    for (const b of boards) {
      if (b.team_id) {
        (map.get(b.team_id) ?? map.set(b.team_id, []).get(b.team_id)!).push(b);
      }
    }
    return map;
  }, [boards]);


  // ---- sign-in gate -------------------------------------------------------

  if (auth.ready && !auth.signedIn) {
    return <div className="boards-signin">{auth.signInPanel}</div>;
  }

  const renderSection = (
    key: string,
    title: ReactSectionHeader,
    sectionBoards: Board[],
    target: CreateTarget,
  ) => (
    <section className="boards-section" key={key}>
      <div className="boards-section-head">
        <div className="boards-section-title">{title.title}</div>
        <div className="boards-section-tools">{title.tools}</div>
      </div>
      <div className="boards-grid">
        {sectionBoards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            onOpen={onOpen}
            onSettings={(b) => setSettingsTarget(b)}
          />
        ))}
        <CreateCard onClick={() => setCreateTarget(target)} />
      </div>
    </section>
  );

  return (
    <div className="boards-page">
      <div className="boards-container">
        <header className="boards-header">
          <div className="boards-header-left">
            <span className="boards-glyph">
              <GridGlyph />
            </span>
            <h1 className="boards-title">Boards</h1>
          </div>
          <div className="boards-header-right">{auth.accountControl}</div>
        </header>

        {error && <div className="boards-error">{error}</div>}

        {loading ? (
          <div className="boards-loading">
            <div className="boards-spinner" />
          </div>
        ) : (
          <>
            {renderSection(
              "personal",
              {
                title: (
                  <>
                    <span className="boards-section-icon">🔒</span>
                    <span>Private</span>
                  </>
                ),
                tools: null,
              },
              personalBoards,
              { teamId: null },
            )}

            {teams.map((team) =>
              renderSection(
                team.id,
                {
                  title: (
                    <>
                      <span className="boards-section-icon">
                        {team.icon ?? "📋"}
                      </span>
                      <span>{team.name}</span>
                      <span className="boards-count-chip">
                        <UsersIcon />
                        {team.member_count}
                      </span>
                    </>
                  ),
                  tools: (
                    <button
                      className="boards-btn boards-btn-ghost"
                      onClick={() => setManageTeam(team)}
                    >
                      Manage
                    </button>
                  ),
                },
                boardsByTeam.get(team.id) ?? [],
                { teamId: team.id },
              ),
            )}

            <div className="boards-newteam-row">
              <button
                className="boards-btn boards-btn-dashed"
                onClick={() => setNewTeamOpen(true)}
              >
                <PlusIcon />
                New team
              </button>
            </div>
          </>
        )}
      </div>

      {settingsTarget && (
        <BoardSettingsModal
          board={settingsTarget}
          onChanged={refetch}
          onClose={() => setSettingsTarget(null)}
        />
      )}

      {createTarget && (
        <CreateBoardModal
          onCreate={async (name, background) => {
            const res = await createBoard(name, createTarget.teamId, background);
            onOpen(res.id);
          }}
          onClose={() => setCreateTarget(null)}
        />
      )}

      {newTeamOpen && (
        <PromptModal
          title="New team"
          label="Team name"
          placeholder="Team Alpha"
          confirmLabel="Create team"
          onConfirm={async (name) => {
            await createTeam(name);
            await refetch();
          }}
          onClose={() => setNewTeamOpen(false)}
        />
      )}

      {manageTeam && (
        <ManageMembersModal
          team={manageTeam}
          currentUserId={auth.user?.id ?? null}
          onClose={() => setManageTeam(null)}
          onChanged={refetch}
        />
      )}
    </div>
  );
};

type ReactSectionHeader = {
  title: ReactNode;
  tools: ReactNode;
};

export default Dashboard;
