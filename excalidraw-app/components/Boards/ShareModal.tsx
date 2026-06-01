import { useCallback, useEffect, useState } from "react";

import {
  getBoardMeta,
  addBoardMember,
  removeBoardMember,
  cancelBoardInvite,
  enableShareLink,
  disableShareLink,
} from "../../data/boardsApi";

import type { BoardMeta } from "../../data/boardsApi";

const CloseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ShareModal = ({
  boardId,
  onClose,
}: {
  boardId: string;
  onClose: () => void;
}) => {
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const refetch = useCallback(async () => {
    const next = await getBoardMeta(boardId);
    setMeta(next);
    return next;
  }, [boardId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBoardMeta(boardId)
      .then((next) => {
        if (!cancelled) {
          setMeta(next);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const handleInvite = async () => {
    const value = email.trim();
    if (!value) {
      return;
    }
    setInviting(true);
    setInviteError(null);
    setInviteNotice(null);
    try {
      const res = await addBoardMember(boardId, value, role);
      setEmail("");
      setInviteNotice(
        res?.pending
          ? `Invited ${value}. They'll get access once they sign up.`
          : `Added ${value}.`,
      );
      await refetch();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err));
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeBoardMember(boardId, userId);
      await refetch();
    } catch {
      // ignore — list stays as-is
    }
  };

  const handleCancelInvite = async (inviteEmail: string) => {
    try {
      await cancelBoardInvite(boardId, inviteEmail);
      await refetch();
    } catch {
      // ignore
    }
  };

  const handleEnableLink = async () => {
    try {
      await enableShareLink(boardId, password || undefined);
      setPassword("");
      await refetch();
    } catch {
      // ignore
    }
  };

  const handleDisableLink = async () => {
    try {
      await disableShareLink(boardId);
      await refetch();
    } catch {
      // ignore
    }
  };

  const shareUrl = meta?.shareSlug
    ? `${window.location.origin}/p/${meta.shareSlug}`
    : null;

  const handleCopy = async () => {
    if (!shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div className="boards-modal-overlay" onClick={onClose}>
      <div className="boards-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="boards-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <h2 className="boards-modal-title">Share board</h2>
        <p className="boards-modal-board">{meta?.name ?? "…"}</p>

        {loading ? (
          <div className="boards-spinner boards-spinner-sm" />
        ) : (
          <>
            {/* Invite people */}
            <div className="boards-modal-section">
              <h3 className="boards-modal-section-title">Invite people</h3>
              <div className="boards-modal-row">
                <input
                  className="boards-input"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleInvite();
                    }
                  }}
                />
                <select
                  className="boards-select"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "editor" | "viewer")
                  }
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  className="boards-btn boards-btn-primary"
                  onClick={handleInvite}
                  disabled={inviting}
                >
                  Invite
                </button>
              </div>
              {inviteError && (
                <div className="boards-modal-error">{inviteError}</div>
              )}
              {inviteNotice && (
                <div className="boards-notice">{inviteNotice}</div>
              )}
            </div>

            {/* People with access */}
            <div className="boards-modal-section">
              <h3 className="boards-modal-section-title">People with access</h3>
              {(meta && meta.members.length > 0) ||
              (meta && meta.pending.length > 0) ? (
                <div className="boards-member-list">
                  {meta.members.map((member) => (
                    <div className="boards-member" key={member.user_id}>
                      <div className="boards-member-info">
                        <div className="boards-member-name">
                          {member.user?.name ||
                            member.user?.email ||
                            member.user_id}
                        </div>
                        <div className="boards-member-role">{member.role}</div>
                      </div>
                      <button
                        className="boards-icon-btn boards-icon-danger"
                        onClick={() => handleRemove(member.user_id)}
                        aria-label="Remove"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  ))}
                  {meta.pending.map((inv) => (
                    <div
                      className="boards-member boards-member-pending"
                      key={inv.email}
                    >
                      <div className="boards-member-info">
                        <div className="boards-member-name">{inv.email}</div>
                        <div className="boards-member-role">
                          {inv.role} · pending
                        </div>
                      </div>
                      <button
                        className="boards-icon-btn boards-icon-danger"
                        onClick={() => handleCancelInvite(inv.email)}
                        aria-label="Cancel invite"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="boards-member-empty">No one else yet.</div>
              )}
            </div>

            {/* Public link */}
            <div className="boards-modal-section">
              <h3 className="boards-modal-section-title">Public link</h3>
              {shareUrl ? (
                <>
                  <div className="boards-modal-row">
                    <input
                      className="boards-input"
                      type="text"
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button className="boards-btn" onClick={handleCopy}>
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="boards-link-actions">
                    <button
                      className="boards-btn boards-btn-ghost"
                      onClick={handleDisableLink}
                    >
                      Disable link
                    </button>
                  </div>
                  <p className="boards-modal-note">
                    Anyone with the link can open this board.
                  </p>
                </>
              ) : (
                <>
                  <div className="boards-modal-row">
                    <input
                      className="boards-input"
                      type="text"
                      placeholder="Optional password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      className="boards-btn boards-btn-primary"
                      onClick={handleEnableLink}
                    >
                      Create public link
                    </button>
                  </div>
                  <p className="boards-modal-note">
                    Anyone with the link
                    {password ? " and password" : ""} can open this board.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ShareModal;
