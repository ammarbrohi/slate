// Manage a team's members: list them, invite by email, remove (owner only).
import { useCallback, useEffect, useRef, useState } from "react";

import {
  listTeamMembers,
  addTeamMember,
  removeTeamMember,
  cancelTeamInvite,
  leaveTeam,
  updateTeam,
} from "../../data/boardsApi";

import { Modal } from "./Modal";
import { EmojiPicker } from "./EmojiPicker";

import type { Team, TeamMember, PendingInvite } from "../../data/boardsApi";

const initials = (m: TeamMember) =>
  (m.name || m.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const ManageMembersModal = ({
  team,
  currentUserId,
  onClose,
  onChanged,
}: {
  team: Team;
  currentUserId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // editable team identity (owner only)
  const [name, setName] = useState(team.name);
  const [icon, setIcon] = useState(team.icon ?? "📋");
  const [pickerOpen, setPickerOpen] = useState(false);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);

  const isOwner = team.role === "owner";
  const dirty = name.trim() !== team.name || icon !== (team.icon ?? "📋");

  const saveSettings = async (nextIcon?: string) => {
    const newIcon = nextIcon ?? icon;
    const newName = name.trim();
    if (!newName) {
      return;
    }
    setError(null);
    try {
      await updateTeam(team.id, { name: newName, icon: newIcon });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await listTeamMembers(team.id);
      setMembers(res.members);
      setPending(res.pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [team.id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const invite = async () => {
    const value = email.trim();
    if (!value || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await addTeamMember(team.id, value);
      setEmail("");
      setNotice(
        res?.pending
          ? `Invited ${value}. They'll join automatically once they sign up.`
          : `Added ${value} to the team.`,
      );
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: TeamMember) => {
    setError(null);
    try {
      await removeTeamMember(team.id, m.id);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const cancel = async (inv: PendingInvite) => {
    setError(null);
    try {
      await cancelTeamInvite(team.id, inv.email);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const leave = async () => {
    if (!window.confirm(`Leave ${team.name}? You'll lose access to its boards.`)) {
      return;
    }
    setError(null);
    try {
      await leaveTeam(team.id);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Modal title="Team settings" onClose={onClose} width={460}>
      <div className="boards-team-settings">
        <div className="boards-emoji-wrap">
          <button
            ref={emojiBtnRef}
            type="button"
            className="boards-emoji-btn"
            disabled={!isOwner}
            onClick={() => setPickerOpen((v) => !v)}
            title={isOwner ? "Change icon" : undefined}
          >
            {icon}
          </button>
          {pickerOpen && (
            <EmojiPicker
              anchorEl={emojiBtnRef.current}
              onClose={() => setPickerOpen(false)}
              onPick={(e) => {
                setIcon(e);
                saveSettings(e);
              }}
            />
          )}
        </div>
        {isOwner ? (
          <>
            <input
              className="boards-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dirty) {
                  saveSettings();
                }
              }}
            />
            {dirty && (
              <button
                className="boards-btn boards-btn-primary"
                onClick={() => saveSettings()}
              >
                Save
              </button>
            )}
          </>
        ) : (
          <span className="boards-team-name-static">{team.name}</span>
        )}
      </div>

      {isOwner && (
        <div className="boards-invite-row">
          <input
            className="boards-input"
            type="email"
            placeholder="Invite by email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                invite();
              }
            }}
          />
          <button
            className="boards-btn boards-btn-primary"
            onClick={invite}
            disabled={busy || !email.trim()}
          >
            {busy ? "…" : "Invite"}
          </button>
        </div>
      )}

      {error && <div className="boards-error">{error}</div>}
      {notice && <div className="boards-notice">{notice}</div>}

      {loading ? (
        <div className="boards-loading">
          <div className="boards-spinner" />
        </div>
      ) : (
        <ul className="boards-member-list">
          {members.map((m) => {
            const owner = m.id === team.owner_id;
            return (
              <li className="boards-member" key={m.id}>
                <span className="boards-member-avatar">{initials(m)}</span>
                <span className="boards-member-info">
                  <span className="boards-member-name">
                    {m.name || m.email || m.id}
                    {m.id === currentUserId && " (you)"}
                  </span>
                  {m.email && m.name && (
                    <span className="boards-member-email">{m.email}</span>
                  )}
                </span>
                {owner ? (
                  <span className="boards-member-role">Owner</span>
                ) : (
                  isOwner && (
                    <button
                      className="boards-link-danger"
                      onClick={() => remove(m)}
                    >
                      Remove
                    </button>
                  )
                )}
              </li>
            );
          })}

          {pending.map((inv) => (
            <li className="boards-member boards-member-pending" key={inv.email}>
              <span className="boards-member-avatar boards-member-avatar-pending">
                {inv.email[0]?.toUpperCase()}
              </span>
              <span className="boards-member-info">
                <span className="boards-member-name">{inv.email}</span>
                <span className="boards-member-email">
                  Waiting for sign-up
                </span>
              </span>
              <span className="boards-pending-badge">Pending</span>
              {isOwner && (
                <button
                  className="boards-link-danger"
                  onClick={() => cancel(inv)}
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isOwner && (
        <div className="boards-modal-footer">
          <button className="boards-btn boards-btn-danger" onClick={leave}>
            Leave team
          </button>
        </div>
      )}
    </Modal>
  );
};
